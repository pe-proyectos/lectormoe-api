// Reparto de la Suscripcion Capibara.
//
// Cada cobro de PayPal de un plan de plataforma se parte en tres:
//   - 50% Capibara. De ahi sale la comision de PayPal; no genera transaccion
//     para ningun scan.
//   - 25% para el scan de ORIGEN (desde cuya pagina se suscribio). Se abona en
//     cuanto se registra el cobro.
//   - 25% por LECTURA: se reparte al cerrar cada mes entre los scans que leyo
//     ese suscriptor, en proporcion a los capitulos que leyo de cada uno. Un
//     cobro anual cubre 12 meses y se reparte en 12 partes, una por mes.
// Si el suscriptor no tiene scan de origen (se suscribio desde la pagina
// general), su 25% de origen se suma al reparto por lectura.
//
// Reembolsos y contracargos: se revierte exactamente lo que se abono (origen y
// cada mes ya repartido) y los meses pendientes de un anual dejan de repartirse.
//
// Todo es idempotente: los cobros se identifican por el id de transaccion de
// PayPal (el mismo que llega por webhook y por el listado de transacciones) y
// las transacciones de los scans por un transactionId determinista.

import { prisma } from '../models/prisma'
import { REPARTO } from '../util/capibara-plans'
import { getTransactionsOfSubscription } from '../util/paypal'

const redondea = (n: number) => Math.round(n * 100) / 100
const etiquetaMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const indiceMes = (d: Date) => d.getFullYear() * 12 + d.getMonth()

/** Clave de allocations para lo que se queda la plataforma. */
const CLAVE_CAPIBARA = 'capibara'

export interface CobroPaypal {
  id: string
  gross: number
  fee: number
  currency?: string
  time: string | Date
}

type SubParaCobro = {
  id: number
  userId: number
  originOrganizationId: number | null
  subscriptionPlan: { name: string; interval: string } | null
}

/**
 * Registra un cobro de una suscripcion Capibara y abona el 25% de origen.
 * Devuelve false si ya estaba registrado (llego antes por webhook o por cron).
 */
export async function registrarCobro(sub: SubParaCobro, cobro: CobroPaypal): Promise<boolean> {
  if (!(cobro.gross > 0)) return false
  const existe = await prisma.platformPayment.findUnique({ where: { paypalTransactionId: cobro.id } })
  if (existe) return false

  const meses = sub.subscriptionPlan?.interval === 'YEAR' ? 12 : 1
  const origen = sub.originOrganizationId ? redondea(cobro.gross * REPARTO.origen) : 0
  const pagadoEn = new Date(cobro.time)

  try {
    await prisma.platformPayment.create({
      data: {
        subscriptionId: sub.id,
        userId: sub.userId,
        paypalTransactionId: cobro.id,
        gross: cobro.gross,
        paypalFee: cobro.fee || 0,
        currency: cobro.currency || 'USD',
        originOrganizationId: sub.originOrganizationId,
        paidAt: pagadoEn,
        months: meses,
        originCredited: origen,
      },
    })
  } catch (e: any) {
    // Webhook y cron pueden llegar a la vez: el unique del id de PayPal hace
    // que solo uno lo registre.
    if (String(e?.code) === 'P2002') return false
    throw e
  }

  if (sub.originOrganizationId && origen > 0) {
    const transactionId = `${cobro.id}:origen`
    const ya = await prisma.organizationTransaction.findFirst({ where: { transactionId } })
    if (!ya) {
      await prisma.organizationTransaction.create({
        data: {
          organizationId: sub.originOrganizationId,
          subscriptionId: sub.id,
          origin: 'CAPIBARA_ORIGEN',
          type: 'EARNING',
          status: 'COMPLETED',
          paymentMethod: 'PAYPAL',
          transactionId,
          description: `Suscripción Capibara ${sub.subscriptionPlan?.name ?? ''}${meses === 12 ? ' anual' : ''} · 25% por traer al suscriptor`,
          beforeFeesAmount: origen,
          amount: origen,
          capibaraFee: 0,
          paypalFee: 0,
          currency: 'USD',
          transactionDate: pagadoEn,
        },
      })
    }
  }
  return true
}

/**
 * Revierte un cobro reembolsado o con contracargo: descuenta a cada scan
 * exactamente lo que recibio de el (origen y meses ya repartidos) y marca el
 * cobro para que los meses pendientes de un anual no se repartan.
 * El descuento es un EARNING negativo: asi resta del saldo del scan sin
 * contarse como un pago hecho al scan en las estadisticas.
 */
export async function revertirCobro(paypalTransactionId: string, motivo = 'reembolso') {
  const pago = await prisma.platformPayment.findUnique({
    where: { paypalTransactionId },
    include: { distributions: true },
  })
  if (!pago || pago.refundedAt) return { revertido: false }

  const porScan = new Map<number, number>()
  if (pago.originOrganizationId && pago.originCredited > 0) {
    porScan.set(pago.originOrganizationId, pago.originCredited)
  }
  for (const d of pago.distributions) {
    const alloc = (d.allocations || {}) as Record<string, number>
    for (const [clave, monto] of Object.entries(alloc)) {
      if (clave === CLAVE_CAPIBARA) continue
      const orgId = Number(clave)
      porScan.set(orgId, (porScan.get(orgId) ?? 0) + Number(monto))
    }
  }

  for (const [orgId, montoCrudo] of porScan) {
    const monto = redondea(montoCrudo)
    if (monto <= 0) continue
    const transactionId = `${paypalTransactionId}:${motivo}:org-${orgId}`
    const ya = await prisma.organizationTransaction.findFirst({ where: { transactionId } })
    if (ya) continue
    await prisma.organizationTransaction.create({
      data: {
        organizationId: orgId,
        subscriptionId: pago.subscriptionId,
        origin: 'CAPIBARA_REEMBOLSO',
        type: 'EARNING',
        status: 'COMPLETED',
        paymentMethod: 'PAYPAL',
        transactionId,
        description: `Suscripción Capibara · ${motivo} del suscriptor: se descuenta lo abonado por ese cobro`,
        beforeFeesAmount: -monto,
        amount: -monto,
        capibaraFee: 0,
        paypalFee: 0,
        currency: 'USD',
        transactionDate: new Date(),
      },
    })
  }

  await prisma.platformPayment.update({ where: { id: pago.id }, data: { refundedAt: new Date() } })
  return { revertido: true, scans: porScan.size }
}

const ESTADOS_REEMBOLSO = new Set(['REFUNDED', 'REVERSED'])

/**
 * Trae de PayPal los cobros de las suscripciones de plataforma: registra los
 * nuevos (con su 25% de origen) y revierte los que se reembolsaron. Se revisan
 * tambien las suscripciones que terminaron hace poco, para no perder su
 * ultimo cobro ni un reembolso tardio.
 */
export async function sincronizarPagosPlataforma() {
  const hace45dias = new Date(Date.now() - 45 * 86400_000)
  const subs = await prisma.subscription.findMany({
    where: {
      subscriptionPlan: { isPlatform: true },
      OR: [{ active: true }, { endDate: { gte: hace45dias } }, { updatedAt: { gte: hace45dias } }],
    },
    include: { subscriptionPlan: { select: { name: true, interval: true } } },
  })

  let nuevos = 0
  let revertidos = 0
  let errores = 0
  for (const sub of subs) {
    if (!sub.paypalSubscriptionId) continue
    let txs: any[] = []
    try {
      txs = await getTransactionsOfSubscription(sub.paypalSubscriptionId)
    } catch (e: any) {
      errores++
      console.error(`[capibara] no se pudieron leer los cobros de la sub ${sub.id}:`, e?.message || e)
      continue
    }
    if (!Array.isArray(txs)) continue

    for (const tx of txs) {
      if (!tx?.id) continue
      if (tx.status === 'COMPLETED') {
        const nuevo = await registrarCobro(sub, {
          id: tx.id,
          gross: Number.parseFloat(tx.amount_with_breakdown?.gross_amount?.value || '0'),
          fee: Number.parseFloat(tx.amount_with_breakdown?.fee_amount?.value || '0'),
          currency: tx.amount_with_breakdown?.gross_amount?.currency_code,
          time: tx.time,
        })
        if (nuevo) nuevos++
      } else if (ESTADOS_REEMBOLSO.has(tx.status)) {
        const r = await revertirCobro(tx.id, tx.status === 'REVERSED' ? 'contracargo' : 'reembolso')
        if (r.revertido) revertidos++
      } else if (tx.status === 'PARTIALLY_REFUNDED') {
        // PayPal no indica cuanto se devolvio en este listado: se deja para
        // revision manual antes que descontar de mas a los scans.
        console.warn(`[capibara] cobro ${tx.id} reembolsado en parte: revisar a mano`)
      }
    }
  }
  return { suscripciones: subs.length, nuevos, revertidos, errores }
}

/**
 * Reparte el 25% por lectura correspondiente a un mes. `monthIndex` es 0-11.
 * Entran los cobros cuyo periodo cubre ese mes (el propio mes si es mensual;
 * cualquiera de sus 12 meses si es anual), sin reembolso y aun no repartidos
 * para ese mes. Se puede relanzar sin riesgo.
 */
export async function repartirLecturaDelMes(year: number, monthIndex: number) {
  const desde = new Date(year, monthIndex, 1)
  const hasta = new Date(year, monthIndex + 1, 1)
  const etiqueta = etiquetaMes(desde)
  const objetivo = indiceMes(desde)

  const candidatos = await prisma.platformPayment.findMany({
    where: {
      refundedAt: null,
      paidAt: { gte: new Date(year, monthIndex - 11, 1), lt: hasta },
      distributions: { none: { month: etiqueta } },
    },
  })
  const pagos = candidatos.filter((p) => {
    const inicio = indiceMes(p.paidAt)
    return objetivo >= inicio && objetivo < inicio + p.months
  })
  if (pagos.length === 0) return { mes: etiqueta, pagos: 0, scans: 0, repartido: 0, sinLectura: 0 }

  // Peso de lectura de cada suscriptor ese mes, por scan. Un capitulo vale 1;
  // los de un joint se reparten a partes iguales entre sus miembros.
  const pesosPorUsuario = new Map<number, Map<number, number>>()
  for (const userId of new Set(pagos.map((p) => p.userId))) {
    const lecturas = await prisma.userChapterHistory.findMany({
      where: { userId, lastReadAt: { gte: desde, lt: hasta } },
      select: {
        chapter: {
          select: {
            mangaCustom: { select: { organizationId: true } },
            joint: { select: { members: { where: { status: 'ACCEPTED' }, select: { organizationId: true } } } },
          },
        },
      },
    })
    const pesos = new Map<number, number>()
    for (const l of lecturas) {
      const ch = l.chapter
      if (ch?.mangaCustom?.organizationId) {
        pesos.set(ch.mangaCustom.organizationId, (pesos.get(ch.mangaCustom.organizationId) ?? 0) + 1)
      } else if (ch?.joint?.members?.length) {
        const parte = 1 / ch.joint.members.length
        for (const m of ch.joint.members) pesos.set(m.organizationId, (pesos.get(m.organizationId) ?? 0) + parte)
      }
    }
    pesosPorUsuario.set(userId, pesos)
  }

  const porScan = new Map<number, number>()
  let sinLectura = 0

  for (const p of pagos) {
    const cuotaPorMes = p.originOrganizationId ? REPARTO.lectura : REPARTO.lectura + REPARTO.origen
    const bolsa = (p.gross * cuotaPorMes) / p.months
    const pesos = pesosPorUsuario.get(p.userId) ?? new Map<number, number>()
    const total = [...pesos.values()].reduce((a, b) => a + b, 0)

    const alloc: Record<string, number> = {}
    if (total === 0) {
      // No leyo nada ese mes: va a su scan de origen si lo tiene; si no, se
      // queda en la plataforma.
      if (p.originOrganizationId) alloc[String(p.originOrganizationId)] = bolsa
      else alloc[CLAVE_CAPIBARA] = bolsa
    } else {
      for (const [orgId, peso] of pesos) alloc[String(orgId)] = (bolsa * peso) / total
    }

    for (const [clave, monto] of Object.entries(alloc)) {
      if (clave === CLAVE_CAPIBARA) sinLectura += monto
      else porScan.set(Number(clave), (porScan.get(Number(clave)) ?? 0) + monto)
    }

    await prisma.platformPaymentDistribution.create({
      data: {
        paymentId: p.id,
        month: etiqueta,
        allocations: Object.fromEntries(Object.entries(alloc).map(([k, v]) => [k, redondea(v)])),
      },
    })
  }

  let repartido = 0
  for (const [orgId, montoCrudo] of porScan) {
    const monto = redondea(montoCrudo)
    if (monto <= 0) continue
    const transactionId = `cap-lectura-${etiqueta}-org-${orgId}`
    const previa = await prisma.organizationTransaction.findFirst({ where: { transactionId } })
    if (previa) {
      // Si el mes se relanza con cobros nuevos, el importe se acumula.
      await prisma.organizationTransaction.update({
        where: { id: previa.id },
        data: {
          beforeFeesAmount: redondea(previa.beforeFeesAmount + monto),
          amount: redondea(previa.amount + monto),
        },
      })
    } else {
      await prisma.organizationTransaction.create({
        data: {
          organizationId: orgId,
          origin: 'CAPIBARA_LECTURA',
          type: 'EARNING',
          status: 'COMPLETED',
          paymentMethod: 'PAYPAL',
          transactionId,
          description: `${etiqueta} | Suscripción Capibara · 25% por lecturas de suscriptores`,
          beforeFeesAmount: monto,
          amount: monto,
          capibaraFee: 0,
          paypalFee: 0,
          currency: 'USD',
          transactionDate: hasta,
        },
      })
    }
    repartido += monto
  }

  return {
    mes: etiqueta,
    pagos: pagos.length,
    scans: porScan.size,
    repartido: redondea(repartido),
    sinLectura: redondea(sinLectura),
  }
}
