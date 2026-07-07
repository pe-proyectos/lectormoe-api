import slug from 'slug'

// Validación de nombre de lista pública (Tarea 27). Solo letras (con acentos y
// ñ), números, espacios y puntuación básica. Sin emojis, HTML ni caracteres raros.
const NAME_RE = /^[\p{L}\p{N}\s\-_!?.,:'()]+$/u

export function validateListName(name: string): string {
  const trimmed = (name || '').trim()
  if (trimmed.length < 3 || trimmed.length > 60) {
    throw new Error('El nombre debe tener entre 3 y 60 caracteres.')
  }
  if (!NAME_RE.test(trimmed)) {
    throw new Error(
      'El nombre solo puede tener letras, números y puntuación básica.'
    )
  }
  return trimmed
}

export function listSlugFromName(name: string): string {
  const s = slug(name, { lower: true })
  if (!s)
    throw new Error('El nombre no genera una URL válida. Usa letras o números.')
  return s.slice(0, 80)
}
