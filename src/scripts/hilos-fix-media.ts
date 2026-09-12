import { SQL } from 'bun'
import { createHilos } from '../lib/hilos-sdk'

// Repara el contenido migrado al que le faltan las imágenes: la migración
// original leía un campo equivocado de la respuesta de subida, así que copió
// cero imágenes. Idempotente: solo toca lo que aún no las tiene.
// Args: --dry.
const DRY = process.argv.includes('--dry')

const sql = new SQL({ url: (process.env.DATABASE_URL || '').split('?')[0], max: 3, connectionTimeout: 15 })
const hilos = createHilos({ baseUrl: process.env.HILOS_BASE || 'https://hilos.rest', secretKey: process.env.HILOS_SECRET_KEY || '' })

let postN = 0, comN = 0, imgN = 0, errN = 0, skipN = 0
const errs = new Map<string, number>()
const logErr = (e: any) => { errN++; const m = String(e?.message || e).slice(0, 80); errs.set(m, (errs.get(m) || 0) + 1) }

const parseList = (raw: any): string[] => {
  let list: any = raw
  try { if (typeof raw === 'string') list = JSON.parse(raw) } catch { return [] }
  if (!Array.isArray(list)) return []
  return list.map((x) => (typeof x === 'string' ? x : x?.url)).filter(Boolean)
}

async function ingest(url: string): Promise<string | null> {
  try {
    const r: any = await (hilos as any).uploads.fromUrl(url)
    if (r?.publicUrl) { imgN++; return r.publicUrl }
  } catch (e) { logErr(e) }
  return null
}

async function run() {
  // 1. Publicaciones de la comunidad con imágenes.
  const posts = await sql`
    SELECT id, content, images
    FROM organization_post
    WHERE "deletedAt" IS NULL AND images IS NOT NULL AND images::text NOT IN ('null','[]')
    ORDER BY id`
  console.log(`publicaciones con imagen: ${posts.length}${DRY ? ' (dry-run)' : ''}`)

  for (const p of posts) {
    const urls = parseList(p.images)
    if (!urls.length) continue
    const ref = `orgpost:${p.id}`
    const existing: any = await (hilos as any).posts.byRef(ref).catch(() => null)
    if (!existing?.id) { skipN++; continue }

    const current: any = await (hilos as any).posts.get(existing.id).catch(() => null)
    if (!current) { skipN++; continue }
    if (/https?:\/\/\S+\.(png|jpe?g|gif|webp)/i.test(current.content || '')) { skipN++; continue } // ya las tiene
    if (DRY) { postN++; continue }

    const copied: string[] = []
    for (const u of urls.slice(0, 4)) { const nu = await ingest(u); if (nu) copied.push(nu) }
    if (!copied.length) { skipN++; continue }

    try {
      await (hilos as any).posts.update(existing.id, { content: [current.content, ...copied].filter(Boolean).join('\n') })
      postN++
    } catch (e) { logErr(e) }
  }

  // 2. Comentarios históricos del lector con imagen.
  const comments = await sql`
    SELECT id, comment, "imageUrl"
    FROM comment
    WHERE "deletedAt" IS NULL AND "imageUrl" IS NOT NULL AND "imageUrl" <> ''
    ORDER BY id`
  console.log(`comentarios con imagen: ${comments.length}`)

  for (const c of comments) {
    const existing: any = await (hilos as any).comments.byRef(`comment:${c.id}`).catch(() => null)
    if (!existing?.id) { skipN++; continue }
    if (/https?:\/\/\S+\.(png|jpe?g|gif|webp)/i.test(existing.content || '')) { skipN++; continue }
    if (DRY) { comN++; continue }

    const copied = await ingest(String(c.imageUrl))
    if (!copied) { skipN++; continue }
    try {
      await (hilos as any).comments.edit(existing.id, [existing.content, copied].filter(Boolean).join('\n'))
      comN++
    } catch (e) { logErr(e) }
  }

  console.log({ publicaciones: postN, comentarios: comN, imagenes: imgN, saltados: skipN, errores: errN })
  if (errs.size) console.log('errores:', [...errs.entries()])
  await sql.end()
}
run()
