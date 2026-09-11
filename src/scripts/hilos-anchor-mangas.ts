import { SQL } from 'bun'
import { createHilos } from '../lib/hilos-sdk'

// Crea el post "ancla" de cada obra que tiene comentarios de portada, para que
// esos comentarios tengan donde colgar en hilos.rest, y los migra.
// Idempotente: externalRef 'manga:<mangaCustomId>' y 'comment:<id>'.
// Args: --dry, --limit N.
const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const LIMIT = Number((() => { const i = args.indexOf('--limit'); return i >= 0 ? args[i + 1] : 0 })() || 0)

const sql = new SQL({ url: (process.env.DATABASE_URL || '').split('?')[0], max: 3, connectionTimeout: 15 })
const hilos = createHilos({ baseUrl: process.env.HILOS_BASE || 'https://hilos.rest', secretKey: process.env.HILOS_SECRET_KEY || '' })

let anchorN = 0, comN = 0, skipN = 0, errN = 0, imgN = 0
const errMsgs = new Map<string, number>()
const logErr = (e: any) => { errN++; const m = String(e?.message || e).slice(0, 90); errMsgs.set(m, (errMsgs.get(m) || 0) + 1) }

const pageCache = new Map<number, string | null>()
async function authorPage(userId: number): Promise<string | null> {
  if (pageCache.has(userId)) return pageCache.get(userId)!
  const [u] = await sql`SELECT id, slug, username, "imageUrl", "createdAt" FROM "user" WHERE id=${userId} LIMIT 1`
  if (!u) { pageCache.set(userId, null); return null }
  const handle = (u.slug || `u${u.id}`).slice(0, 40)
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

async function ingestImage(url: string | null): Promise<string | null> {
  if (!url) return null
  try { const r: any = await (hilos as any).uploads.fromUrl(url); if (r?.url) { imgN++; return r.url } } catch (e) { logErr(e) }
  return null
}

async function run() {
  // identifier de portada = slug de la obra (sin _numero). Puede venir con
  // prefijo joint_ cuando la obra es un trabajo conjunto.
  const groups = await sql`
    SELECT identifier, count(*) as n FROM comment
    WHERE "deletedAt" IS NULL AND identifier !~ '_[0-9.]+$'
    GROUP BY identifier ORDER BY n DESC ${LIMIT ? sql`LIMIT ${LIMIT}` : sql``}`
  console.log(`obras con comentarios de portada: ${groups.length}${DRY ? ' (dry-run)' : ''}`)

  for (const g of groups) {
    const slug = String(g.identifier).replace(/^joint_/, '')
    // La page de la obra en hilos se creo como 'manga:<mangaCustomId>'.
    const rows = await sql`
      SELECT mc.id as mc_id, mc.title, mc."imageUrl", mc."createdAt", mc."organizationId", ma.slug as mslug
      FROM manga_custom mc JOIN manga ma ON ma.id = mc."mangaId"
      WHERE ma.slug = ${slug} ORDER BY mc.id LIMIT 1`
    if (!rows.length) { skipN++; continue }
    const mc = rows[0]
    const ref = `manga:${mc.mc_id}`

    // Algunas obras nunca llegaron a hilos (sin capitulos publicados): las
    // creamos ahora para que sus comentarios historicos no se pierdan.
    if (!DRY) {
      const exists: any = await (hilos as any).pages.get(`m-${mc.mslug}-${mc.mc_id}`.slice(0, 40)).catch(() => null)
      if (!exists) {
        const base = {
          externalId: ref,
          handle: `m-${mc.mslug}-${mc.mc_id}`.slice(0, 40),
          type: 'manga' as const,
          displayName: mc.title,
          avatarUrl: mc.imageUrl || undefined,
          createdAt: mc.createdAt ? new Date(mc.createdAt).toISOString() : undefined,
        }
        try {
          await hilos.pages.upsert(
            mc.organizationId ? ({ ...base, parentExternalId: `scan:${mc.organizationId}` } as any) : (base as any),
          )
        } catch (e: any) {
          // Si el scan ya no existe en hilos, la obra vive suelta antes que perderse.
          if (String(e?.message || e).includes('parent_not_found')) {
            try { await hilos.pages.upsert(base as any) } catch (e2) { logErr(e2) }
          } else logErr(e)
        }
      }
    }

    let postId: number | null = null
    const already: any = await (hilos as any).posts.byRef(ref).catch(() => null)
    if (already?.id) postId = already.id

    if (!postId) {
      if (DRY) { anchorN++; continue }
      try {
        // El ancla la publica la propia page de la obra, en su muro.
        const created: any = await (hilos as any).posts.create({
          content: mc.title,
          externalRef: ref,
          wallExternalId: ref,
          createdAt: mc.createdAt ? new Date(mc.createdAt).toISOString() : undefined,
        }, `external:${ref}`)
        postId = created?.id ?? null
        if (postId) anchorN++
      } catch (e) { logErr(e); continue }
    }
    if (!postId) continue

    const comments = await sql`
      SELECT id, "userId", comment, "imageUrl", "createdAt", "parentId"
      FROM comment
      WHERE "deletedAt" IS NULL AND identifier = ${g.identifier}
      ORDER BY id`
    for (const c of comments) {
      if (DRY) { comN++; continue }
      const ext = await authorPage(c.userId)
      if (!ext) continue
      const img = await ingestImage(c.imageUrl)
      const content = [c.comment || '', img].filter(Boolean).join('\n')
      if (!content.trim()) continue
      try {
        await (hilos as any).comments.create(postId, {
          content,
          externalRef: `comment:${c.id}`,
          ...(c.parentId ? { parentExternalRef: `comment:${c.parentId}` } : {}),
          createdAt: new Date(c.createdAt).toISOString(),
        }, `external:${ext}`)
        comN++
      } catch (e) { logErr(e) }
    }
  }

  console.log({ anclas: anchorN, comentarios: comN, sinObra: skipN, imagenes: imgN, errores: errN })
  if (errMsgs.size) console.log('errores:', [...errMsgs.entries()])
  await sql.end()
}
run()
