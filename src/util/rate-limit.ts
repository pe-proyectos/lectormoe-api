// Rate limit en memoria (la API corre en una sola instancia; si algún día se
// escala horizontalmente, migrar a DB o Redis).
const buckets = new Map<string, number[]>()

export function assertRateLimit(
  key: string,
  max: number,
  windowMs: number,
  message?: string
) {
  const now = Date.now()
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= max) {
    throw new Error(
      message ??
        'Estás haciendo esto demasiado rápido. Espera un momento e intenta de nuevo.'
    )
  }
  hits.push(now)
  buckets.set(key, hits)
}

// Limpieza periódica para no crecer sin límite
setInterval(
  () => {
    const now = Date.now()
    for (const [k, v] of buckets) {
      const alive = v.filter((t) => now - t < 24 * 60 * 60 * 1000)
      if (alive.length === 0) buckets.delete(k)
      else buckets.set(k, alive)
    }
  },
  60 * 60 * 1000
)
