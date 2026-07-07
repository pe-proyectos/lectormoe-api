// Verificación read-only de los controladores de landing tras el fix del 422:
// comprueba que la salida cumple lo que exigen los schemas estrictos de las rutas.
import { getPopularToday } from '../controllers/landing/popular-today'
import { getFeaturedManga } from '../controllers/landing/featured-manga'
import { prisma } from '../models/prisma'

let failures = 0
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    failures++
    console.log(`FAIL ${name}`, extra ?? '')
  } else {
    console.log(`OK   ${name}`)
  }
}

for (const nsfw of [false, true]) {
  const items = await getPopularToday(5, nsfw)
  check(`popular-today nsfw=${nsfw} devuelve array (${items.length} items)`, Array.isArray(items))
  for (const it of items) {
    check(
      `popular-today nsfw=${nsfw} item "${it.title}" shape válido`,
      typeof it.id === 'string' &&
        typeof it.title === 'string' &&
        typeof it.cover === 'string' &&
        it.cover.length > 0 &&
        typeof it.scanName === 'string' &&
        Array.isArray(it.chapters) &&
        it.chapters.every(
          (c: any) =>
            typeof c.id === 'number' &&
            typeof c.number === 'number' &&
            typeof c.title === 'string' &&
            c.releasedAt instanceof Date &&
            typeof c.chapterUrl === 'string'
        ),
      JSON.stringify(it).slice(0, 200)
    )
  }
}

const featured = await getFeaturedManga(5, false)
check(`featured-manga devuelve array (${featured.length} items)`, Array.isArray(featured))
for (const it of featured as any[]) {
  const chaptersOk = (it.chapters ?? []).every((c: any) => c.releasedAt instanceof Date)
  check(`featured-manga item "${it.title}" releasedAt sin nulls`, chaptersOk, JSON.stringify(it.chapters?.slice(0, 2)))
}

console.log(failures === 0 ? '\n✅ Todo válido' : `\n❌ ${failures} fallos`)
await prisma.$disconnect()
process.exit(failures === 0 ? 0 : 1)
