// Unificación de géneros globales (Tarea 24).
//   bun src/scripts/unify-genres.ts            → DRY RUN (no escribe nada)
//   bun src/scripts/unify-genres.ts --apply    → aplica (re-vincula y borra duplicados)
//
// Estrategia: agrupa géneros por nombre normalizado (sin acentos/mayúsculas) +
// sinónimos manuales. Canónico = el de MÁS obras vinculadas (para no romper
// slugs populares). Re-vincula la relación M2M antes de borrar duplicados.
import { prisma } from '../models/prisma'
import slugify from 'slugify'

const APPLY = process.argv.includes('--apply')

const normalize = (s: string) =>
  (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

// Sinónimos → clave canónica normalizada. Ampliar según lo que muestre el dry-run.
const SYNONYMS: Record<string, string> = {
  'sci-fi': 'ciencia ficcion',
  'ciencia ficcion': 'ciencia ficcion',
  'slice of life': 'recuentos de la vida',
  'comedy': 'comedia',
  'action': 'accion',
  'drama romantico': 'romance',
  'romance escolar': 'romance',
}

const keyOf = (name: string) => {
  const n = normalize(name)
  return SYNONYMS[n] ?? n
}

const genres = await prisma.genre.findMany({
  select: { id: true, name: true, slug: true, organizationId: true, _count: { select: { mangasCustom: true } } },
})

// Agrupar por clave.
const groups = new Map<string, typeof genres>()
for (const g of genres) {
  const k = keyOf(g.name)
  const arr = groups.get(k) ?? []
  arr.push(g)
  groups.set(k, arr)
}

let dupGroups = 0
let toDelete = 0
const plan: { canonical: any; dups: any[] }[] = []

for (const [k, arr] of groups) {
  if (arr.length < 2) continue
  dupGroups++
  // Canónico = más obras vinculadas; desempate por menor id.
  const sorted = [...arr].sort((a, b) => (b._count.mangasCustom - a._count.mangasCustom) || (a.id - b.id))
  const canonical = sorted[0]
  const dups = sorted.slice(1)
  toDelete += dups.length
  plan.push({ canonical, dups })
}

console.log(`Géneros totales: ${genres.length}`)
console.log(`Grupos con duplicados: ${dupGroups}`)
console.log(`Géneros a eliminar (tras re-vincular): ${toDelete}`)
console.log(`Géneros únicos resultantes: ${genres.length - toDelete}`)
console.log('\n=== PLAN (canónico ← duplicados) ===')
for (const { canonical, dups } of plan.slice(0, 60)) {
  console.log(`  "${canonical.name}" (${canonical._count.mangasCustom} obras)  ←  ${dups.map((d) => `"${d.name}"(${d._count.mangasCustom})`).join(', ')}`)
}
if (plan.length > 60) console.log(`  ... y ${plan.length - 60} grupos más`)

// Verificar unicidad global de slugs canónicos regenerados.
const canonicalSlugs = new Map<string, string>()
let slugCollisions = 0
for (const { canonical } of plan) {
  const s = slugify(canonical.name, { lower: true, strict: true })
  if (canonicalSlugs.has(s)) { slugCollisions++; }
  canonicalSlugs.set(s, canonical.name)
}
// También los géneros sin duplicados.
for (const [, arr] of groups) {
  if (arr.length !== 1) continue
  const s = slugify(arr[0].name, { lower: true, strict: true })
  if (canonicalSlugs.has(s) && canonicalSlugs.get(s) !== arr[0].name) slugCollisions++
  canonicalSlugs.set(s, arr[0].name)
}
console.log(`\nColisiones de slug canónico: ${slugCollisions} (deben resolverse antes del CREATE UNIQUE INDEX)`)

if (!APPLY) {
  console.log('\n[DRY RUN] No se escribió nada. Ejecuta con --apply para aplicar.')
  await prisma.$disconnect()
  process.exit(0)
}

// ---- APPLY ----
let relinked = 0
for (const { canonical, dups } of plan) {
  for (const dup of dups) {
    // Obras vinculadas al duplicado.
    const linked = await prisma.mangaCustom.findMany({
      where: { genres: { some: { id: dup.id } } },
      select: { id: true },
    })
    for (const mc of linked) {
      try {
        await prisma.mangaCustom.update({
          where: { id: mc.id },
          data: { genres: { connect: { id: canonical.id }, disconnect: { id: dup.id } } },
        })
        relinked++
      } catch { /* ya conectado */ }
    }
    await prisma.genre.delete({ where: { id: dup.id } }).catch(() => {})
  }
  // Regenerar slug canónico + soltar org (global).
  const newSlug = slugify(canonical.name, { lower: true, strict: true })
  await prisma.genre.update({ where: { id: canonical.id }, data: { slug: newSlug, organizationId: null as any } }).catch(() => {})
}
console.log(`\n✅ APPLY terminado. Relaciones re-vinculadas: ${relinked}. Géneros eliminados: ${toDelete}.`)
await prisma.$disconnect()
process.exit(0)
