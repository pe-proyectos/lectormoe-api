import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { logged } from '../../plugins/auth'
import { useOrganizationOptional } from '../../plugins/organization'
import { logModeration } from '../../util/moderation-log'
import { createHilos } from '../../lib/hilos-sdk'
import { createHmac, timingSafeEqual } from 'crypto'
import { handleCommentEvent } from '../../services/charca-comment-emails'

// BFF de hilos.rest para el lector: el navegador nunca ve la secret key, solo
// un page token de 15 minutos con los permisos justos. Mismo patron que
// lacharca.com, pero actuando como la page de CapibaraTraductor del usuario.
const hilos = createHilos({
  baseUrl: process.env.HILOS_BASE || 'https://hilos.rest',
  secretKey: process.env.HILOS_SECRET_KEY || '',
})

const ORIGIN = process.env.PUBLIC_ORIGIN || 'https://capibaratraductor.com'

// Si el usuario ya reclamo su cuenta en La Charca, esa es su page real: hay que
// emitir el token contra ella para que no se le parta el historial.
async function pageExternalId(user: { id: number; slug?: string | null; username?: string | null; imageUrl?: string | null; createdAt?: Date }) {
  const handle = (user.slug || `u${user.id}`).slice(0, 40)
  const existing: any = await (hilos as any).pages.get(handle).catch(() => null)
  if (existing?.externalId?.startsWith('lacharca:user:')) return existing.externalId

  const ext = `capibara:user:${user.id}`
  // La page puede no existir todavia (usuario que nunca comento): la creamos.
  await hilos.pages.upsert({
    externalId: ext,
    handle,
    type: 'user',
    displayName: user.username || handle,
    avatarUrl: user.imageUrl || undefined,
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
  }).catch(() => null)
  return ext
}

export const router = () =>
  new Elysia()
    .use(logged())
    .post('/api/hilos/token', async ({ user }: any) => {
      const u = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, slug: true, username: true, imageUrl: true, createdAt: true },
      })
      if (!u) return { status: false, message: 'user_not_found' }
      try {
        const ext = await pageExternalId(u)
        // Si su page ya es de La Charca, el usuario vinculo su cuenta alli.
        const linked = ext.startsWith('lacharca:user:')
        const r = await hilos.pageTokens.create({
          externalId: ext,
          ttl: 900,
          scopes: ['read', 'comment:write', 'react'],
          origin: ORIGIN,
        } as any)
        if (!r?.token) return { status: false, message: 'token_failed' }
        return {
          status: true,
          data: {
            token: r.token,
            expiresIn: r.expiresIn,
            hilosBase: process.env.HILOS_BASE || 'https://hilos.rest',
            handle: u.slug,
            linked,
            charcaUrl: process.env.CHARCA_URL || 'https://lacharca.com',
          },
        }
      } catch (e: any) {
        return { status: false, message: e?.code || e?.message || 'token_failed' }
      }
    })

// Moderacion: el staff del scan oculta o restaura un comentario de hilos.
// Los permisos se validan aqui (hilos no sabe de scans ni de roles).
export const modRouter = () =>
  new Elysia()
    .use(useOrganizationOptional())
    .use(logged())
    .post('/api/hilos/comments/:id/hide', async ({ user, params, organizationId, body }: any) => {
      if (!organizationId) return { status: false, message: 'organization_required' }
      const permissions = user.permissions?.find((p: any) => p.organizationId === organizationId)
      if (!permissions?.canHideComment) return { status: false, message: 'forbidden' }
      try {
        const hidden = body?.hidden === false ? false : true
        const r = await (hilos as any).comments.hide(Number(params.id), hidden)
        logModeration(
          user.id,
          hidden ? 'hide_comment' : 'restore_comment',
          'hilos_comment',
          Number(params.id),
          JSON.stringify({ organizationId, reason: body?.reason || null }),
        )
        return { status: true, data: r }
      } catch (e: any) {
        return { status: false, message: e?.code || e?.message || 'error' }
      }
    }, { body: t.Optional(t.Object({ hidden: t.Optional(t.Boolean()), reason: t.Optional(t.String()) })) })

    // Silenciar a alguien: el equivalente al baneo de comentarios de siempre.
    .post('/api/hilos/pages/:handle/mute', async ({ user, params, organizationId, body }: any) => {
      if (!organizationId) return { status: false, message: 'organization_required' }
      const permissions = user.permissions?.find((p: any) => p.organizationId === organizationId)
      if (!permissions?.canBanUser && !permissions?.canHideComment) return { status: false, message: 'forbidden' }
      try {
        const muted = body?.muted === false ? false : true
        const r = await (hilos as any).pages.mute(String(params.handle), muted, body?.until)
        logModeration(
          user.id,
          muted ? 'mute_page' : 'unmute_page',
          'hilos_page',
          0,
          JSON.stringify({ organizationId, handle: params.handle, until: body?.until || null, reason: body?.reason || null }),
        )
        return { status: true, data: r }
      } catch (e: any) {
        return { status: false, message: e?.code || e?.message || 'error' }
      }
    }, { body: t.Optional(t.Object({ muted: t.Optional(t.Boolean()), until: t.Optional(t.String()), reason: t.Optional(t.String()) })) })

// Crea el hilo de una obra la primera vez que alguien entra a comentarla.
// Sin esto, cualquier obra sin comentarios historicos se quedaba sin seccion.
async function ensureMangaThread(mangaCustomId: number): Promise<number | null> {
  const mc = await prisma.mangaCustom.findUnique({
    where: { id: mangaCustomId },
    select: {
      id: true, title: true, imageUrl: true, createdAt: true, organizationId: true, deletedAt: true,
      manga: { select: { slug: true } },
    },
  })
  if (!mc || mc.deletedAt) return null

  const ref = `manga:${mc.id}`
  const handle = `m-${mc.manga?.slug || mc.id}-${mc.id}`.slice(0, 40)
  const base = {
    externalId: ref,
    handle,
    type: 'manga' as const,
    displayName: mc.title,
    avatarUrl: mc.imageUrl || undefined,
    createdAt: mc.createdAt ? new Date(mc.createdAt).toISOString() : undefined,
  }
  try {
    await hilos.pages.upsert(mc.organizationId ? ({ ...base, parentExternalId: `scan:${mc.organizationId}` } as any) : (base as any))
  } catch (e: any) {
    // Si el scan ya no esta en hilos, la obra vive suelta antes que perderse.
    if (String(e?.message || e).includes('parent_not_found')) {
      try { await hilos.pages.upsert(base as any) } catch { return null }
    } else return null
  }

  try {
    const created: any = await (hilos as any).posts.create({
      content: mc.title,
      externalRef: ref,
      wallExternalId: ref,
      createdAt: mc.createdAt ? new Date(mc.createdAt).toISOString() : undefined,
    }, `external:${ref}`)
    return created?.id ?? null
  } catch {
    // Carrera con otra peticion: si ya existe, lo resolvemos por referencia.
    const again: any = await (hilos as any).posts.byRef(ref).catch(() => null)
    return again?.id ?? null
  }
}

// Webhook de hilos.rest: el motor avisa de lo que pasa y aquí decidimos a quién
// escribirle. La firma evita que cualquiera pueda disparar correos.
export const webhookRouter = () =>
  new Elysia().post('/api/hilos/webhook', async ({ request, body }: any) => {
    const secret = process.env.HILOS_WEBHOOK_SECRET || ''
    if (!secret) return { status: false, message: 'not_configured' }

    const raw = typeof body === 'string' ? body : JSON.stringify(body)
    const signature = request.headers.get('x-hilos-signature') || ''
    const expected = createHmac('sha256', secret).update(raw).digest('hex')
    const ok = signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    if (!ok) return { status: false, message: 'bad_signature' }

    const payload = typeof body === 'string' ? JSON.parse(body) : body
    if (payload?.type !== 'comment.created') return { status: true, data: { ignored: payload?.type } }

    // Respondemos ya: el correo no debe hacer esperar a quien comenta.
    handleCommentEvent(payload.data).catch((e) => console.error('charca email:', e?.message))
    return { status: true, data: { queued: true } }
  })

// Publico: resuelve el post de hilos que corresponde a un capitulo u obra.
// El lector lo necesita para saber donde colgar los comentarios.
export const publicRouter = () =>
  new Elysia().get('/api/hilos/post-ref', async ({ query }: any) => {
    const ref = String(query.ref || '')
    const m = ref.match(/^(chapter|manga):(\d+)$/)
    if (!m) return { status: false, message: 'bad_ref' }

    const existing: any = await (hilos as any).posts.byRef(ref).catch(() => null)
    if (existing?.id) return { status: true, data: { postId: existing.id } }

    // Solo las obras se crean al vuelo: los capitulos los publica el propio
    // flujo de publicacion, y uno inexistente no deberia inventarse.
    if (m[1] === 'manga') {
      const postId = await ensureMangaThread(Number(m[2]))
      return { status: true, data: { postId } }
    }
    return { status: true, data: { postId: null } }
  }, { query: t.Object({ ref: t.String() }) })
