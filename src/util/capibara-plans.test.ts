import { describe, expect, test } from 'bun:test'
import { LIMITES, nivelDesdeSuscripciones } from './capibara-plans'

const sub = (isPlatform: boolean, tier: string | null) => ({ subscriptionPlan: { isPlatform, tier } })

describe('nivelDesdeSuscripciones', () => {
  test('sin suscripciones es gratis', () => expect(nivelDesdeSuscripciones([])).toBe('gratis'))
  test('un plan por scan es legacy', () => expect(nivelDesdeSuscripciones([sub(false, null)])).toBe('legacy'))
  test('cada nivel de plataforma', () => {
    expect(nivelDesdeSuscripciones([sub(true, 'lector')])).toBe('lector')
    expect(nivelDesdeSuscripciones([sub(true, 'plus')])).toBe('plus')
    expect(nivelDesdeSuscripciones([sub(true, 'premium')])).toBe('premium')
  })
  test('manda el nivel mas alto', () =>
    expect(nivelDesdeSuscripciones([sub(true, 'lector'), sub(true, 'premium')])).toBe('premium'))
  test('un plan de plataforma gana a uno legacy', () =>
    expect(nivelDesdeSuscripciones([sub(false, null), sub(true, 'lector')])).toBe('lector'))
  test('un tier desconocido no da acceso', () => expect(nivelDesdeSuscripciones([sub(true, 'oro')])).toBe('legacy'))
})

describe('LIMITES acordados', () => {
  test('gratis 5/10/5, lector x2, plus x10, premium ilimitado', () => {
    expect(LIMITES.gratis).toEqual({ miLista: 5, favoritos: 10, descargas: 5 })
    expect(LIMITES.lector).toEqual({ miLista: 10, favoritos: 20, descargas: 10 })
    expect(LIMITES.plus).toEqual({ miLista: 50, favoritos: 100, descargas: 50 })
    expect(LIMITES.premium).toEqual({ miLista: null, favoritos: null, descargas: null })
  })
  test('legacy no pierde nada de lo que tenia', () =>
    expect(LIMITES.legacy).toEqual({ miLista: null, favoritos: null, descargas: 24 }))
})
