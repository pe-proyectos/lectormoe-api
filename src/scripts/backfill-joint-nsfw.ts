// Rellena MangaJoint.isNSFW a partir de las obras que componen cada joint y de
// sus generos. Idempotente: se puede correr las veces que haga falta.
// Uso:  bun src/scripts/backfill-joint-nsfw.ts [--apply]
import { prisma } from '../models/prisma'
import { calcularJointNSFW } from '../util/joint-nsfw'

const aplicar = process.argv.includes('--apply')

const joints = await prisma.mangaJoint.findMany({
  where: { deletedAt: null },
  select: { id: true, slug: true, isNSFW: true },
  orderBy: { id: 'asc' },
})

let cambios = 0
for (const j of joints) {
  const esperado = await calcularJointNSFW(j.id)
  if (esperado === j.isNSFW) continue
  cambios++
  console.log(`${j.isNSFW ? '+18' : 'sfw'} -> ${esperado ? '+18' : 'sfw'}  ${j.slug}`)
  if (aplicar) await prisma.mangaJoint.update({ where: { id: j.id }, data: { isNSFW: esperado } })
}

console.log(`\njoints revisados: ${joints.length} | a cambiar: ${cambios}`)
console.log(aplicar ? 'Aplicado.' : 'DRY-RUN. Vuelve a correrlo con --apply para escribir.')
await prisma.$disconnect()
process.exit(0)
