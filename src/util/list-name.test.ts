import { describe, expect, it } from 'bun:test'
import { listSlugFromName, validateListName } from './list-name'

describe('validateListName', () => {
  it('acepta nombres válidos con acentos y puntuación', () => {
    expect(validateListName('  Lo mejor del mundo  ')).toBe(
      'Lo mejor del mundo'
    )
    expect(validateListName('Acción & aventura'.replace('&', 'y'))).toBe(
      'Acción y aventura'
    )
    expect(validateListName('Mis favoritos (2026)')).toBe(
      'Mis favoritos (2026)'
    )
  })
  it('rechaza cortos, largos, emojis y HTML', () => {
    expect(() => validateListName('ab')).toThrow()
    expect(() => validateListName('a'.repeat(61))).toThrow()
    expect(() => validateListName('Lista 🔥')).toThrow()
    expect(() => validateListName('<b>hola</b>')).toThrow()
    expect(() => validateListName('lista`raro`')).toThrow()
  })
})

describe('listSlugFromName', () => {
  it('genera slug sin acentos', () => {
    expect(listSlugFromName('Lo mejor del mundo')).toBe('lo-mejor-del-mundo')
    expect(listSlugFromName('Acción y Aventura')).toBe('accion-y-aventura')
  })
})
