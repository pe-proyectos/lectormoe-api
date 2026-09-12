import { SQL } from 'bun'
import { createHilos } from '../lib/hilos-sdk'

// Migra los posts de la comunidad (/socials) a hilos.rest, con sus respuestas
// e imagenes, conservando fechas y autoria. NO borra ni modifica nada en
// CapibaraTraductor. Idempotente: usa externalRef 'orgpost:<id>'.
// Args: --dry (solo cuenta), --limit N.
const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const LIMIT = Number((() => { const i = args.indexOf('--limit'); return i >= 0 ? args[i + 1] : 0 })() || 0)

const sql = new SQL({ url: (process.env.DATABASE_URL || '').split('?')[0], max: 3, connectionTimeout: 15 })
const hilos = createHilos({ baseUrl: process.env.HILOS_BASE || 'https://hilos.rest', secretKey: process.env.HILOS_SECRET_KEY || '' })

let postN = 0, replyN = 0, skipN = 0, errN = 0, imgN = 0
const errMsgs = new Map<string, number>()
const logErr = (e: any) => { errN++; const m = String(e?.message || e).slice(0, 90); errMsgs.set(m, (errMsgs.get(m) || 0) + 1) }

const pageCache = new Map<number, string | null>()
async function authorPage(userId: number): Promise<string | null> {
  if (pageCache.has(userId)) return pageCache.get(userId)!
  const [u] = await sql`SELECT id, slug, username, "imageUrl", "createdAt" FROM "user" WHERE id=${userId} LIMIT 1`
  if (!u) { pageCache.set(userId, null); return null }
  const handle = (u.slug || `u${u.id}`).slice(0, 40)
  // Si ya reclamo su cuenta en La Charca, respetamos esa page.
  const existing: any = await (hilos as any).pages.get(handle).catch(() => null)
  if (existing?.externalId?.startsWith('lacharca:user:')) { pageCache.set(userId, existing.externalId); return existing.externalId }
  const ext = `capibara:user:${u.id}`
  try {
    await hilos.pages.upsert({
      externalId: ext, handle, type: 'user',
      displayName: u.username || u.slug,
      avatarUrl: u.imageUrl || undefined,
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : undefined,
    })
    pageCache.set(userId, ext); return ext
  } catch (e) { logErr(e); pageCache.set(userId, null); return null }
}

// Las imagenes viven en el R2 de CapibaraTraductor: las copiamos al de hilos.
async function ingestImages(images: any): Promise<string[]> {
  let list: string[] = []
  try { list = typeof images === 'string' ? JSON.parse(images) : (images || []) } catch { list = [] }
  if (!Array.isArray(list) || !list.length) return []
  const out: string[] = []
  for (const raw of list.slice(0, 4)) {
    const url = typeof raw === 'string' ? raw : raw?.url
    if (!url) continue
    try { const r: any = await (hilos as any).uploads.fromUrl(url); if (r?.publicUrl) { out.push(r.publicUrl); imgN++ } }
    catch (e) { logErr(e) }
  }
  return out
}

const bodyOf = (content: string, imgs: string[]) => [content || '', ...imgs].filter(Boolean).join('\n')

async function run() {
  const roots = await sql`
    SELECT id, "userId", content, images, "createdAt"
    FROM organization_post
    WHERE "deletedAt" IS NULL AND "parentId" IS NULL
    ORDER BY id ${LIMIT ? sql`LIMIT ${LIMIT}` : sql``}`
  console.log(`posts raiz: ${roots.length}${DRY ? ' (dry-run)' : ''}`)

  for (const p of roots) {
    const ref = `orgpost:${p.id}`
    const already: any = await (hilos as any).posts.byRef(ref).catch(() => null)
    let postId: number | null = already?.id ?? null
    if (postId) skipN++

    if (!postId) {
      const ext = await authorPage(p.userId)
      if (!ext) { continue }
      if (DRY) { postN++; continue }
      const imgs = await ingestImages(p.images)
      try {
        const created: any = await (hilos as any).posts.create({
          content: bodyOf(p.content, imgs),
          externalRef: ref,
          createdAt: new Date(p.createdAt).toISOString(),
        }, `external:${ext}`)
        postId = created?.id ?? null
        if (postId) postN++
      } catch (e) { logErr(e); continue }
    }
    if (!postId) continue

    // Respuestas en cascada: primero las del post, luego las respuestas de esas
    // (el hilo de /socials permite anidar), enlazadas por parentExternalRef.
    const queue: number[] = [p.id]
    const seen = new Set<number>()
    while (queue.length) {
      const parentId = queue.shift()!
      if (seen.has(parentId)) continue
      seen.add(parentId)
      const replies = await sql`
        SELECT id, "userId", content, images, "createdAt", "parentId"
        FROM organization_post
        WHERE "deletedAt" IS NULL AND "parentId" = ${parentId}
        ORDER BY id`
      for (const r of replies) {
        queue.push(r.id)
        const ext = await authorPage(r.userId)
        if (!ext) continue
        if (DRY) { replyN++; continue }
        const imgs = await ingestImages(r.images)
        try {
          await (hilos as any).comments.create(postId, {
            content: bodyOf(r.content, imgs),
            externalRef: `orgpost:${r.id}`,
            // La raiz cuelga del post; las anidadas, del comentario padre.
            ...(r.parentId === p.id ? {} : { parentExternalRef: `orgpost:${r.parentId}` }),
            createdAt: new Date(r.createdAt).toISOString(),
          }, `external:${ext}`)
          replyN++
        } catch (e) { logErr(e) }
      }
    }
  }

  console.log({ posts: postN, respuestas: replyN, yaExistian: skipN, imagenes: imgN, errores: errN })
  if (errMsgs.size) console.log('errores:', [...errMsgs.entries()])
  await sql.end()
}
run()
