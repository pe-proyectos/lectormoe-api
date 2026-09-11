import { SQL } from 'bun'
import { createHilos } from '../lib/hilos-sdk'

// Migra comentarios historicos a hilos.rest. NO borra nada en capibaratraductor.
// - Autores -> pages con externalId 'capibara:user:<id>' (reclamables al entrar
//   a La Charca, para que hereden su historial).
// - Comentarios -> comments sobre el post del capitulo (externalRef chapter:<id>)
//   o sobre el post de la obra.
// - Imagenes -> copiadas al R2 de hilos (opcion B).
// Args: --limit N, --dry, --since <id>
const args = process.argv.slice(2)
const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined }
const DRY = args.includes('--dry')
const LIMIT = Number(arg('--limit') || 0)
const SINCE = Number(arg('--since') || 0)

const sql = new SQL({ url: (process.env.DATABASE_URL || '').split('?')[0], max: 3, connectionTimeout: 15 })
const hilos = createHilos({ baseUrl: process.env.HILOS_BASE || 'https://hilos.rest', secretKey: process.env.HILOS_SECRET_KEY || '' })

const pageCache = new Map<number, string | null>() // userId -> externalId de su page (o null)
const postCache = new Map<string, number>()    // identifier -> postId en hilos
let okN = 0, skipN = 0, errN = 0, imgN = 0
const errMsgs = new Map<string, number>()
function logErr(e: any) { errN++; const m = String(e?.message || e).slice(0, 70); errMsgs.set(m, (errMsgs.get(m) || 0) + 1) }

// Devuelve el externalId de la page del autor. Si ya reclamó su cuenta en La
// Charca (page 'lacharca:user:N'), se usa esa para no partir su historial.
async function ensureAuthorPage(u: any): Promise<string | null> {
  if (pageCache.has(u.id)) return pageCache.get(u.id)!
  const handle = (u.slug || `u${u.id}`).slice(0, 40)
  // ¿El handle ya pertenece a una cuenta de La Charca de este mismo usuario?
  try {
    const existing: any = await (hilos as any).pages.get(handle).catch(() => null)
    if (existing?.externalId?.startsWith('lacharca:user:')) {
      pageCache.set(u.id, existing.externalId)
      return existing.externalId
    }
  } catch { /* sigue */ }
  const ext = `capibara:user:${u.id}`
  try {
    await hilos.pages.upsert({
      externalId: ext, handle, type: 'user',
      displayName: u.username || u.slug,
      avatarUrl: u.imageUrl || undefined,
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : undefined,
    })
    pageCache.set(u.id, ext); return ext
  } catch (e) { logErr(e); pageCache.set(u.id, null); return null }
}

// Resuelve a que post de hilos pertenece un identifier (mangaSlug[_numero]).
async function resolvePost(identifier: string): Promise<number | null> {
  if (postCache.has(identifier)) return postCache.get(identifier)!
  const m = identifier.match(/^(.+?)_([\d.]+)$/)
  let postId: number | null = null
  try {
    if (m) {
      const [, slug, num] = m
      const rows = await sql`SELECT ch.id FROM chapter ch JOIN manga_custom mc ON mc.id=ch."mangaCustomId" JOIN manga ma ON ma.id=mc."mangaId"
        WHERE ma.slug=${slug} AND ch.number=${Number(num)} ORDER BY ch.id LIMIT 1`
      if (rows.length) {
        const r = await (hilos as any).posts.byRef(`chapter:${rows[0].id}`).catch(() => null)
        postId = r?.id ?? null
      }
    }
  } catch (e) { logErr(e) }
  if (postId) postCache.set(identifier, postId)
  return postId
}

const where = SINCE ? `AND c.id > ${SINCE}` : ''
const lim = LIMIT ? `LIMIT ${LIMIT}` : ''
const comments = await sql.unsafe(`
  SELECT c.id, c.identifier, c.comment, c."imageUrl", c."createdAt", c."parentId",
         u.id AS uid, u.username, u.slug, u."imageUrl" AS uavatar, u."createdAt" AS ucreated
  FROM comment c JOIN "user" u ON u.id=c."userId"
  WHERE c."deletedAt" IS NULL AND c."hiddenAt" IS NULL ${where}
  ORDER BY c.id ASC ${lim}`)

console.log(`comentarios a migrar: ${comments.length}${DRY ? ' (DRY)' : ''}`)
for (const c of comments as any[]) {
  if (DRY) { okN++; continue }
  const postId = await resolvePost(c.identifier)
  if (!postId) { skipN++; continue }
  const authorExt = await ensureAuthorPage({ id: c.uid, username: c.username, slug: c.slug, imageUrl: c.uavatar, createdAt: c.ucreated })
  if (!authorExt) { skipN++; continue }
  let content = c.comment || ''
  if (c.imageUrl) {
    try {
      const up = await (hilos as any).uploads.fromUrl(c.imageUrl.startsWith('http') ? c.imageUrl : `https://r2.capibaratraductor.com/${c.imageUrl}`)
      if (up?.publicUrl) { content = `${content}\n${up.publicUrl}`.trim(); imgN++ }
    } catch (e) { logErr(e) }
  }
  try {
    await hilos.comments.create(postId, { content, createdAt: new Date(c.createdAt).toISOString() }, `external:${authorExt}`)
    okN++
  } catch (e) { logErr(e) }
  if ((okN + skipN) % 200 === 0) console.log(`… ok ${okN} | skip ${skipN} | img ${imgN} | err ${errN}`)
}
console.log(JSON.stringify({ dry: DRY, migrados: okN, saltados: skipN, imagenes: imgN, errores: errN }))
for (const [m, n] of [...errMsgs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`ERR x${n}: ${m}`)
await sql.end()
process.exit(0)
