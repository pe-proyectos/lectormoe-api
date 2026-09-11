import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { logged } from '../../plugins/auth'
import { randomBytes } from 'crypto'

// CapibaraTraductor como proveedor de identidad para apps hermanas
// (lacharca.com). El usuario logueado obtiene un CODIGO de un solo uso (60s)
// que la app hermana canjea server-to-server por los datos del usuario y
// vincula a SU propia cuenta. Nunca se comparte el token de sesion original.

const CODE_TTL_MS = 60_000
const codes = new Map<string, { userId: number; exp: number }>()
function sweep() { const now = Date.now(); for (const [k, v] of codes) if (v.exp < now) codes.delete(k) }

// SSO_CLIENTS="lacharca:<secreto>" (coma-separado para varias apps)
function clientFor(secret: string): string | null {
  for (const pair of (process.env.SSO_CLIENTS || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const i = pair.indexOf(':')
    if (i > 0 && pair.slice(i + 1) === secret) return pair.slice(0, i)
  }
  return null
}
const ALLOWED_REDIRECTS = (process.env.SSO_REDIRECTS || 'https://lacharca.com').split(',').map((s) => s.trim()).filter(Boolean)

// Publico: la app hermana canjea el codigo con su secreto.
export const publicRouter = () =>
  new Elysia().post('/api/sso/exchange', async ({ body, request }: any) => {
    sweep()
    const client = clientFor(request.headers.get('x-sso-secret') || '')
    if (!client) return { status: false, message: 'invalid_client' }
    const entry = codes.get(String(body.code || ''))
    if (!entry || entry.exp < Date.now()) return { status: false, message: 'invalid_code' }
    codes.delete(String(body.code))
    const u = await prisma.user.findUnique({
      where: { id: entry.userId },
      select: { id: true, username: true, slug: true, email: true, imageUrl: true, bannerUrl: true, description: true },
    })
    if (!u) return { status: false, message: 'user_not_found' }
    return { status: true, data: { user: u, client } }
  }, { body: t.Object({ code: t.String() }) })

// Autenticado: el usuario pide el codigo para vincular/entrar en la app hermana.
export const router = () =>
  new Elysia().use(logged()).post('/api/sso/code', async ({ user, body }: any) => {
    sweep()
    const redirect = String(body.redirect || '')
    if (!ALLOWED_REDIRECTS.some((r) => redirect.startsWith(r))) throw new Error('redirect_not_allowed')
    const code = randomBytes(24).toString('hex')
    codes.set(code, { userId: user.id, exp: Date.now() + CODE_TTL_MS })
    return { status: true, data: { code, expiresIn: CODE_TTL_MS / 1000 } }
  }, { body: t.Object({ redirect: t.String() }) })
