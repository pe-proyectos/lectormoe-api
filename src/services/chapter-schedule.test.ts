import { describe, expect, test } from 'bun:test'
import { planPublishAtEdit, resolvePublishAt } from './chapter-schedule'

const now = new Date('2026-09-24T12:00:00Z')

describe('resolvePublishAt', () => {
  test('undefined no toca, vacio o pasado publica ya', () => {
    expect(resolvePublishAt(undefined, now)).toBeUndefined()
    expect(resolvePublishAt(null, now)).toBeNull()
    expect(resolvePublishAt('', now)).toBeNull()
    expect(resolvePublishAt('2026-09-23T12:00:00Z', now)).toBeNull()
  })
  test('futuro devuelve la fecha', () => {
    expect(resolvePublishAt('2026-09-25T12:00:00Z', now)?.toISOString()).toBe(
      '2026-09-25T12:00:00.000Z'
    )
  })
  test('invalida o demasiado lejos lanza', () => {
    expect(() => resolvePublishAt('no-es-fecha', now)).toThrow()
    expect(() => resolvePublishAt('2030-01-01T00:00:00Z', now)).toThrow()
  })
})

describe('planPublishAtEdit', () => {
  const future = '2026-09-26T12:00:00Z'
  test('reprogramar un capitulo programado', () => {
    const r = planPublishAtEdit(new Date(future), '2026-09-27T12:00:00Z', now)
    expect(r.publishNow).toBe(false)
    expect(r.setPublishAt?.toISOString()).toBe('2026-09-27T12:00:00.000Z')
  })
  test('quitar programacion = publicar ya', () => {
    expect(planPublishAtEdit(new Date(future), null, now).publishNow).toBe(true)
  })
  test('no se puede programar un capitulo ya publicado', () => {
    expect(() => planPublishAtEdit(null, future, now)).toThrow()
    expect(planPublishAtEdit(null, null, now).publishNow).toBe(false)
  })
})
