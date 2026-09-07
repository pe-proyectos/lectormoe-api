import { SQL } from 'bun'
import { createHilos } from '../lib/hilos-sdk'

// Migración NO destructiva y RESILIENTE (idempotente/resumible). Solo inserta en
// hilos.rest. Args: --scan <slug>, --maxch N, --dry.
const args = process.argv.slice(2)
const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined }
const DRY = args.includes('--dry')
const SCAN = arg('--scan')
const MAXCH = Number(arg('--maxch') || 0)

const sql = new SQL({ url: (process.env.DATABASE_URL || '').split('?')[0], max: 3, connectionTimeout: 12 })
const hilos = createHilos({ baseUrl: process.env.HILOS_BASE || 'https://hilos.rest', secretKey: process.env.HILOS_SECRET_KEY || '' })

let scanN = 0, mangaN = 0, chapterN = 0, errN = 0
async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; try { await fn(items[idx]) } catch { errN++ } }
  }))
}

const orgs = await sql.unsafe(`SELECT id, name, slug, "logoUrl", "imageUrl", "isNSFW", "createdAt" FROM organization WHERE "isDeleted"=false ${SCAN ? `AND slug='${SCAN}'` : ''} ORDER BY id`)
for (const org of orgs) {
  try {
    if (!DRY) await hilos.pages.upsert({ externalId: `scan:${org.id}`, handle: `scan-${org.slug}`.slice(0, 40), type: 'scan', displayName: org.name, avatarUrl: org.logoUrl || org.imageUrl || undefined, metadata: { isNSFW: org.isNSFW }, createdAt: new Date(org.createdAt).toISOString() })
    scanN++
  } catch { errN++; continue }
  const mangas = await sql.unsafe(`SELECT mc.id, mc.title, mc."imageUrl", mc."createdAt", m.slug AS mslug FROM manga_custom mc JOIN manga m ON m.id=mc."mangaId" WHERE mc."organizationId"=${org.id} AND mc."deletedAt" IS NULL ORDER BY mc.id`)
  for (const mc of mangas) {
    try {
      if (!DRY) await hilos.pages.upsert({ externalId: `manga:${mc.id}`, handle: `m-${mc.mslug}-${mc.id}`.slice(0, 40), type: 'manga', parentExternalId: `scan:${org.id}`, displayName: mc.title, avatarUrl: mc.imageUrl || undefined, createdAt: new Date(mc.createdAt).toISOString() })
      mangaN++
    } catch { errN++; continue }
    const chLimit = MAXCH > 0 ? `LIMIT ${MAXCH}` : ''
    const chapters = await sql.unsafe(`SELECT id, number, title, "displayNumber", "createdAt" FROM chapter WHERE "mangaCustomId"=${mc.id} ORDER BY number ASC ${chLimit}`)
    if (DRY) { chapterN += chapters.length; continue }
    await pool(chapters as any[], 5, async (ch) => {
      const label = `Capítulo ${ch.displayNumber ?? ch.number}${ch.title && ch.title !== `Capítulo ${ch.number}` ? `: ${ch.title}` : ''}`
      await hilos.posts.create({ content: label, wallExternalId: `manga:${mc.id}`, externalRef: `chapter:${ch.id}`, createdAt: new Date(ch.createdAt).toISOString() }, `external:scan:${org.id}`)
      chapterN++
    })
  }
  if (scanN % 10 === 0) console.log(`… progreso: scans ${scanN}, obras ${mangaN}, caps ${chapterN}, errs ${errN}`)
}
console.log(JSON.stringify({ dry: DRY, scan: SCAN || 'ALL', scans: scanN, mangas: mangaN, chapters: chapterN, errors: errN }))
await sql.end()
process.exit(0)
