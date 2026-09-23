// Reparto de la Suscripcion Capibara.
//
// Cada cobro de PayPal de un plan de plataforma se parte en tres:
//   - 50% Capibara. De ahi sale la comision de PayPal; no genera transaccion
//     para ningun scan.
//   - 25% para el scan de ORIGEN (desde cuya pagina se suscribio). Se abona en
//     cuanto se registra el cobro.
//   - 25% por LECTURA: se reparte una vez al mes entre los scans que leyo ese
//     suscriptor, en proporcion a los capitulos que leyo de cada uno.
// Si el suscriptor no tiene scan de origen (se suscribio desde la pagina
// general), su 25% de origen se suma al reparto por lectura.
//
// Todo es idempotente: los cobros se identifican por el id de transaccion de
// PayPal y las transacciones de los scans por un transactionId determinista,
// asi que ejecutar dos veces no duplica nada.

import { prisma } from '../models/prisma'
import { REPARTO } from '../util/capibara-plans'
import { getTransactionsOfSubscription } from '../util/paypal'

const redondea = (n: number) => Math.round(n * 100) / 100

/**
 * Trae de PayPal los cobros de las suscripciones de plataforma, guarda los
 * nuevos y abona el 25% de origen. Se revisan tambien las suscripciones que
 * terminaron hace poco para no perder su ultimo cobro.
 */
export async function sincronizarPagosPlataforma() {
  const hace45dias = new Date(Date.now() - 45 * 86400_000)
  const subs = await prisma.subscription.findMany({
    where: {
      subscriptionPlan: { isPlatform: true },
      OR: [{ active: true }, { endDate: { gte: hace45dias } }, { updatedAt: { gte: hace45dias } }],
    },
    include: { subscriptionPlan: { select: { name: true } } },
  })

  let nuevos = 0
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
      if (!tx?.id || tx.status !== 'COMPLETED') continue
      const gross = Number.parseFloat(tx.amount_with_breakdown?.gross_amount?.value || '0')
      if (!(gross > 0)) continue
      const fee = Number.parseFloat(tx.amount_with_breakdown?.fee_amount?.value || '0')

      const existe = await prisma.platformPayment.findUnique({ where: { paypalTransactionId: tx.id } })
      if (existe) continue

      await prisma.platformPayment.create({
        data: {
          subscriptionId: sub.id,
          userId: sub.userId,
          paypalTransactionId: tx.id,
          gross,
          paypalFee: fee,
          currency: tx.amount_with_breakdown?.gross_amount?.currency_code || 'USD',
          originOrganizationId: sub.originOrganizationId,
          paidAt: new Date(tx.time),
        },
      })
      nuevos++

      if (sub.originOrganizationId) {
        const monto = redondea(gross * REPARTO.origen)
        const transactionId = `${tx.id}:origen`
        // Defensa extra: el cobro ya era nuevo, pero si una ejecucion anterior
        // murio entre crear el cobro y abonar el origen, no se duplica.
        const yaAbonado = await prisma.organizationTransaction.findFirst({ where: { transactionId } })
        if (!yaAbonado) await prisma.organizationTransaction.create({
          data: {
            organizationId: sub.originOrganizationId,
            subscriptionId: sub.id,
            origin: 'CAPIBARA_ORIGEN',
            type: 'EARNING',
            status: 'COMPLETED',
            paymentMethod: 'PAYPAL',
            transactionId,
            description: `Suscripción Capibara ${sub.subscriptionPlan?.name ?? ''} · 25% por traer al suscriptor`,
            beforeFeesAmount: monto,
            amount: monto,
            capibaraFee: 0,
            paypalFee: 0,
            currency: 'USD',
            transactionDate: new Date(tx.time),
          },
        })
      }
    }
  }
  return { suscripciones: subs.length, nuevos, errores }
}

/**
 * Reparte el 25% por lectura de los cobros de un mes. `monthIndex` es 0-11.
 * Solo toca cobros aun no repartidos, asi que se puede relanzar sin riesgo.
 */
export async function repartirLecturaDelMes(year: number, monthIndex: number) {
  const desde = new Date(year, monthIndex, 1)
  const hasta = new Date(year, monthIndex + 1, 1)
  const etiqueta = `${year}-${String(monthIndex + 1).padStart(2, '0')}`

  const pagos = await prisma.platformPayment.findMany({
    where: { paidAt: { gte: desde, lt: hasta }, readingDistributedAt: null },
  })
  if (pagos.length === 0) return { mes: etiqueta, pagos: 0, scans: 0, repartido: 0, sinLectura: 0 }

  // Bolsa de cada suscriptor: su 25% de lectura, mas el de origen si no lo tiene.
  const bolsaPorUsuario = new Map<number, { monto: number; origen: number | null }>()
  for (const p of pagos) {
    const extra = p.originOrganizationId ? 0 : p.gross * REPARTO.origen
    const actual = bolsaPorUsuario.get(p.userId) ?? { monto: 0, origen: p.originOrganizationId }
    actual.monto += p.gross * REPARTO.lectura + extra
    bolsaPorUsuario.set(p.userId, actual)
  }

  const porScan = new Map<number, number>()
  let sinLectura = 0

  for (const [userId, bolsa] of bolsaPorUsuario) {
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

    // Peso por scan: un capitulo leido vale 1. Los capitulos de un joint se
    // reparten a partes iguales entre sus miembros.
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

    const total = [...pesos.values()].reduce((a, b) => a + b, 0)
    if (total === 0) {
      // No leyo nada ese mes: la bolsa va a su scan de origen si lo tiene; si
      // no, se queda en Capibara.
      if (bolsa.origen) porScan.set(bolsa.origen, (porScan.get(bolsa.origen) ?? 0) + bolsa.monto)
      else sinLectura += bolsa.monto
      continue
    }
    for (const [orgId, peso] of pesos) {
      porScan.set(orgId, (porScan.get(orgId) ?? 0) + (bolsa.monto * peso) / total)
    }
  }

  let repartido = 0
  for (const [orgId, montoCrudo] of porScan) {
    const monto = redondea(montoCrudo)
    if (monto <= 0) continue
    const transactionId = `cap-lectura-${etiqueta}-org-${orgId}`
    const previa = await prisma.organizationTransaction.findFirst({ where: { transactionId } })
    const datos = {
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
      transactionDate: new Date(year, monthIndex + 1, 1),
    }
    if (previa) {
      // Si se relanza el mes con cobros nuevos, el importe se acumula.
      await prisma.organizationTransaction.update({
        where: { id: previa.id },
        data: { ...datos, beforeFeesAmount: redondea(previa.beforeFeesAmount + monto), amount: redondea(previa.amount + monto) },
      })
    } else {
      await prisma.organizationTransaction.create({ data: datos })
    }
    repartido += monto
  }

  await prisma.platformPayment.updateMany({
    where: { id: { in: pagos.map((p) => p.id) } },
    data: { readingDistributedAt: new Date() },
  })

  return {
    mes: etiqueta,
    pagos: pagos.length,
    scans: porScan.size,
    repartido: redondea(repartido),
    sinLectura: redondea(sinLectura),
  }
}
