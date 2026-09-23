// Alta de los planes Capibara en PayPal y en la base de datos.
//
// Idempotente: crea solo lo que falta (organizacion interna, producto de
// PayPal y cada uno de los seis planes, identificados por su slug). Se puede
// relanzar sin duplicar nada, por ejemplo si PayPal fallo a mitad.

import { prisma } from '../models/prisma'
import { PLATAFORMA_SLUG, slugPlan, TIERS } from '../util/capibara-plans'
import { createPlan, createProduct } from '../util/paypal'

export async function asegurarPlanesCapibara() {
  let plataforma = await prisma.organization.findFirst({ where: { slug: PLATAFORMA_SLUG } })
  if (!plataforma) {
    plataforma = await prisma.organization.create({
      data: {
        name: 'Capibara',
        title: 'Suscripción Capibara',
        slug: PLATAFORMA_SLUG,
        domain: 'capibara.internal',
        // Organizacion interna: nunca aparece en listados publicos.
        isPublic: false,
      },
    })
  }

  // Reutiliza el producto de PayPal si ya hay algun plan creado.
  const existente = await prisma.subscriptionPlan.findFirst({
    where: { organizationId: plataforma.id, isPlatform: true },
    select: { productId: true },
  })
  let productId = existente?.productId
  if (!productId) {
    const producto = await createProduct('Suscripción Capibara', 'Acceso a CapibaraTraductor en todos los scans')
    productId = producto.id as string
  }

  const creados: string[] = []
  const existian: string[] = []
  for (const t of TIERS) {
    for (const intervalo of ['MONTH', 'YEAR'] as const) {
      const slug = slugPlan(t.tier, intervalo)
      const ya = await prisma.subscriptionPlan.findFirst({ where: { slug } })
      if (ya) {
        existian.push(slug)
        continue
      }
      const precio = intervalo === 'YEAR' ? t.anual : t.mensual
      const nombre = `Capibara ${t.nombre}${intervalo === 'YEAR' ? ' anual' : ''}`
      const plan = await createPlan({
        productId: productId!,
        name: nombre,
        description: nombre,
        price: precio,
        currency: 'USD',
        interval: intervalo,
      })
      await prisma.subscriptionPlan.create({
        data: {
          organizationId: plataforma.id,
          name: t.nombre,
          slug,
          description: nombre,
          price: precio,
          interval: intervalo,
          currency: 'USD',
          productId: productId!,
          planId: plan.id,
          active: true,
          isPlatform: true,
          tier: t.tier,
          hideAds: true,
          canDownload: true,
          canReadUnreleased: t.tier === 'premium',
        },
      })
      creados.push(slug)
    }
  }
  return { organizacionId: plataforma.id, productId, creados, existian }
}
