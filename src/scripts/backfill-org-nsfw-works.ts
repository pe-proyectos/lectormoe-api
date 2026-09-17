// Alinea la clasificacion +18 de las obras con la de su scan.
//
// Los listados FILTRAN por MangaCustom.isNSFW, pero para pintar la tarjeta se
// usaba "obra o scan". Con las dos definiciones desalineadas, una obra sin
// marcar de un scan +18 pasaba el filtro del lado azul y aparecia en la portada
// difuminada, con la insignia +18 y enlazando a /red.
//
// Solo marca; nunca desmarca. Idempotente.
// Uso:  bun src/scripts/backfill-org-nsfw-works.ts [--apply]
import { prisma } from '../models/prisma'
import { sincronizarJointsDeManga } from '../util/joint-nsfw'

const aplicar = process.argv.includes('--apply')

const obras = await prisma.mangaCustom.findMany({
  where: { deletedAt: null, isNSFW: false, organization: { isNSFW: true, isDeleted: false } },
  select: { id: true, title: true, mangaId: true, organization: { select: { slug: true } } },
  orderBy: { id: 'asc' },
})

for (const o of obras) {
  console.log(`  ${o.organization.slug.padEnd(28)} | ${String(o.title).slice(0, 50)}`)
}
console.log(`\nobras a marcar +18: ${obras.length}`)

if (aplicar && obras.length > 0) {
  await prisma.mangaCustom.updateMany({
    where: { id: { in: obras.map((o) => o.id) } },
    data: { isNSFW: true },
  })
  for (const mangaId of new Set(obras.map((o) => o.mangaId).filter(Boolean) as number[])) {
    await sincronizarJointsDeManga(mangaId)
  }
  console.log('Aplicado (y joints resincronizados).')
} else {
  console.log(aplicar ? 'Nada que hacer.' : 'DRY-RUN. Vuelve a correrlo con --apply para escribir.')
}

await prisma.$disconnect()
process.exit(0)
