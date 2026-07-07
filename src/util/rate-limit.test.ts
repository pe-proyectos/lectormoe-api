import { describe, expect, it } from 'bun:test'
import { assertRateLimit } from './rate-limit'

describe('assertRateLimit', () => {
  it('permite hasta max llamadas y lanza en la siguiente', () => {
    const key = `test:${Math.random()}`
    for (let i = 0; i < 3; i++) {
      expect(() => assertRateLimit(key, 3, 1000)).not.toThrow()
    }
    expect(() => assertRateLimit(key, 3, 1000)).toThrow()
  })

  it('vuelve a permitir pasada la ventana', async () => {
    const key = `test:${Math.random()}`
    assertRateLimit(key, 1, 50)
    expect(() => assertRateLimit(key, 1, 50)).toThrow()
    await new Promise((r) => setTimeout(r, 60))
    expect(() => assertRateLimit(key, 1, 50)).not.toThrow()
  })

  it('usa el mensaje custom cuando se provee', () => {
    const key = `test:${Math.random()}`
    assertRateLimit(key, 1, 1000)
    expect(() => assertRateLimit(key, 1, 1000, 'Mensaje custom.')).toThrow(
      'Mensaje custom.'
    )
  })
})
