import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { logged } from '../../plugins/auth'
import { useOrganizationOptional } from '../../plugins/organization'
import { logModeration } from '../../util/moderation-log'
import { createHilos } from '../../lib/hilos-sdk'

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

// Publico: resuelve el post de hilos que corresponde a un capitulo u obra.
// El lector lo necesita para saber donde colgar los comentarios.
export const publicRouter = () =>
  new Elysia().get('/api/hilos/post-ref', async ({ query }: any) => {
    const ref = String(query.ref || '')
    if (!/^(chapter|manga):\d+$/.test(ref)) return { status: false, message: 'bad_ref' }
    try {
      const post: any = await (hilos as any).posts.byRef(ref)
      return { status: true, data: { postId: post?.id ?? null } }
    } catch {
      return { status: true, data: { postId: null } }
    }
  }, { query: t.Object({ ref: t.String() }) })
