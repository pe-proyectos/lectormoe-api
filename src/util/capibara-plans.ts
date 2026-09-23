import { prisma } from '../models/prisma'

/**
 * Suscripcion Capibara: planes de plataforma, validos en todos los scans.
 *
 * LANZADO es el interruptor del dia del lanzamiento. Mientras sea false:
 *   - las altas legacy (planes por scan) siguen abiertas,
 *   - los limites de siempre siguen vigentes,
 *   - los planes nuevos solo se ven con ?preview=1 (para probarlos).
 * Al ponerlo en true, a la vez: se cierran las altas legacy, se aplican los
 * limites por nivel y los planes nuevos pasan a ser los unicos contratables.
 * Se hace todo junto a proposito: si se bajaran los limites antes, 1.870
 * lectores quedarian bloqueados sin ninguna forma de pagar para desbloquearse.
 */
export const LANZADO = false

/** Organizacion interna a la que pertenecen los planes de plataforma. */
export const PLATAFORMA_SLUG = 'capibara'

export type Tier = 'gratis' | 'lector' | 'plus' | 'premium'
/** Suscripcion por scan anterior a los planes Capibara. */
export type NivelUsuario = Tier | 'legacy'

export const TIERS: Array<{
  tier: Exclude<Tier, 'gratis'>
  nombre: string
  mensual: number
  anual: number
}> = [
  { tier: 'lector', nombre: 'Lector', mensual: 5, anual: 50 },
  { tier: 'plus', nombre: 'Plus', mensual: 9, anual: 90 },
  { tier: 'premium', nombre: 'Premium', mensual: 16, anual: 160 },
]

export const ORDEN_TIER: Record<Tier, number> = { gratis: 0, lector: 1, plus: 2, premium: 3 }

/** Limites por nivel. `null` = ilimitado. */
export interface Limites {
  miLista: number | null
  favoritos: number | null
  descargas: number | null
}

export const LIMITES: Record<NivelUsuario, Limites> = {
  gratis: { miLista: 5, favoritos: 10, descargas: 5 },
  lector: { miLista: 10, favoritos: 20, descargas: 10 },
  plus: { miLista: 50, favoritos: 100, descargas: 50 },
  premium: { miLista: null, favoritos: null, descargas: null },
  // Las suscripciones por scan conservan lo que tenian al contratar: lista y
  // favoritos ilimitados y 24 descargas. Son usuarios que ya pagan: no se les
  // quita nada.
  legacy: { miLista: null, favoritos: null, descargas: 24 },
}

/** Limites que regian antes del lanzamiento (plan gratis de siempre). */
export const LIMITES_PRE_LANZAMIENTO: Limites = { miLista: 50, favoritos: 100, descargas: 6 }

export const REPARTO = { capibara: 0.5, origen: 0.25, lectura: 0.25 } as const

export const slugPlan = (tier: string, intervalo: 'MONTH' | 'YEAR') =>
  `capibara-${tier}-${intervalo === 'YEAR' ? 'anual' : 'mensual'}`

type SubConPlan = { subscriptionPlan?: { isPlatform?: boolean | null; tier?: string | null } | null }

/**
 * Nivel efectivo a partir de las suscripciones ACTIVAS ya cargadas. Si hubiera
 * varias (no deberia: al contratar se suspenden las anteriores) manda la de
 * nivel mas alto, y un plan de plataforma gana a uno legacy.
 */
export function nivelDesdeSuscripciones(subs: SubConPlan[]): NivelUsuario {
  if (!subs || subs.length === 0) return 'gratis'
  let mejor: Tier | null = null
  let tieneLegacy = false
  for (const s of subs) {
    const p = s.subscriptionPlan
    if (p?.isPlatform && p.tier && p.tier in ORDEN_TIER) {
      const t = p.tier as Tier
      if (!mejor || ORDEN_TIER[t] > ORDEN_TIER[mejor]) mejor = t
    } else {
      tieneLegacy = true
    }
  }
  if (mejor) return mejor
  return tieneLegacy ? 'legacy' : 'gratis'
}

/**
 * Limites vigentes para un nivel. Antes del lanzamiento rige el esquema de
 * siempre: gratis con sus topes y cualquier suscripcion sin ellos.
 */
export function limitesParaNivel(nivel: NivelUsuario): Limites {
  if (!LANZADO) {
    if (nivel === 'gratis') return LIMITES_PRE_LANZAMIENTO
    return { miLista: null, favoritos: null, descargas: 24 }
  }
  return LIMITES[nivel]
}

export async function nivelDeUsuario(userId: number | null | undefined): Promise<NivelUsuario> {
  if (!userId) return 'gratis'
  const subs = await prisma.subscription.findMany({
    where: { userId, active: true },
    select: { subscriptionPlan: { select: { isPlatform: true, tier: true } } },
  })
  return nivelDesdeSuscripciones(subs)
}

export async function limitesDeUsuario(userId: number | null | undefined): Promise<Limites> {
  return limitesParaNivel(await nivelDeUsuario(userId))
}

export async function organizacionPlataforma() {
  return prisma.organization.findFirst({ where: { slug: PLATAFORMA_SLUG } })
}
