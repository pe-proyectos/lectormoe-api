import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { loggedOptional, loggedUserOnly } from '../../plugins/auth'

const ROLES = ['cleaner', 'typer', 'traductor', 'redrawer', 'proofreader', 'editor', 'otro']
const LANGS = ['es', 'en', 'ambos']

function sanitizeRoles(raw: string): string {
  const parts = raw.split(',').map((r) => r.trim().toLowerCase()).filter((r) => ROLES.includes(r))
  return Array.from(new Set(parts)).join(',')
}

function assertStaff(user: any, organizationId: number) {
  const perm = user.permissions?.find((p: any) => p.organizationId === organizationId)
  if (!perm?.canSeeAdminPanel) throw new Error('No autorizado.')
}

export const router = () =>
  new Elysia()
    .use(loggedOptional())
    // Público
    .get(
      '/api/recruitment',
      async ({ query }) => {
        const page = query?.page ? Number.parseInt(query.page) : 1
        const status = query?.status === 'all' ? { in: ['open', 'filled'] } : query?.status === 'filled' ? 'filled' : 'open'
        const where: any = { status }
        if (query?.role && ROLES.includes(query.role)) where.roles = { contains: query.role }
        if (query?.language && LANGS.includes(query.language)) where.language = query.language
        if (query?.org) where.organization = { slug: query.org }
        if (query?.search) where.OR = [{ title: { contains: query.search, mode: 'insensitive' } }, { description: { contains: query.search, mode: 'insensitive' } }]
        const posts = await prisma.recruitmentPost.findMany({
          where,
          orderBy: [{ urgent: 'desc' }, { updatedAt: 'desc' }],
          skip: (page - 1) * 20,
          take: 20,
          include: { organization: { select: { name: true, slug: true, logoUrl: true, _count: { select: { followers: true } } } } },
        })
        return { status: true, data: posts }
      },
      { query: t.Optional(t.Object({ page: t.Optional(t.String()), status: t.Optional(t.String()), role: t.Optional(t.String()), language: t.Optional(t.String()), search: t.Optional(t.String()), org: t.Optional(t.String()) })), response: t.Object({ status: t.Boolean(), data: t.Any() }) },
    )

export const adminRouter = () =>
  new Elysia()
    .use(loggedUserOnly())
    // Lista admin
    .get(
      '/api/organization/recruitment',
      async ({ user, organizationId }) => {
        assertStaff(user, organizationId)
        const posts = await prisma.recruitmentPost.findMany({ where: { organizationId }, orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }] })
        return { status: true, data: posts }
      },
      { response: t.Object({ status: t.Boolean(), data: t.Any() }) },
    )
    // Crear
    .post(
      '/api/organization/recruitment',
      async ({ user, organizationId, body }) => {
        assertStaff(user, organizationId)
        const openCount = await prisma.recruitmentPost.count({ where: { organizationId, status: 'open' } })
        if (openCount >= 5) throw new Error('Alcanzaste el máximo de 5 anuncios abiertos. Cierra alguno antes de crear otro.')
        const roles = sanitizeRoles(body.roles)
        if (!roles) throw new Error('Selecciona al menos un rol válido.')
        const post = await prisma.recruitmentPost.create({
          data: {
            organizationId,
            title: body.title.trim(),
            description: body.description.trim(),
            requirements: body.requirements?.trim() || null,
            roles,
            language: LANGS.includes(body.language) ? body.language : 'es',
            urgent: !!body.urgent,
          },
        })
        return { status: true, data: post }
      },
      {
        body: t.Object({
          title: t.String({ minLength: 3, maxLength: 200 }),
          description: t.String({ minLength: 10, maxLength: 4000 }),
          requirements: t.Optional(t.String({ maxLength: 2000 })),
          roles: t.String({ minLength: 1, maxLength: 300 }),
          language: t.String(),
          urgent: t.Optional(t.Boolean()),
        }),
        response: t.Object({ status: t.Boolean(), data: t.Any() }),
      },
    )
    // Editar
    .patch(
      '/api/organization/recruitment/:id',
      async ({ user, organizationId, params, body }) => {
        assertStaff(user, organizationId)
        const post = await prisma.recruitmentPost.findUnique({ where: { id: Number.parseInt(params.id) } })
        if (!post || post.organizationId !== organizationId) throw new Error('Anuncio no encontrado.')
        const data: any = {}
        if (body.title !== undefined) data.title = body.title.trim()
        if (body.description !== undefined) data.description = body.description.trim()
        if (body.requirements !== undefined) data.requirements = body.requirements?.trim() || null
        if (body.roles !== undefined) { const r = sanitizeRoles(body.roles); if (!r) throw new Error('Selecciona al menos un rol válido.'); data.roles = r }
        if (body.language !== undefined && LANGS.includes(body.language)) data.language = body.language
        if (body.urgent !== undefined) data.urgent = !!body.urgent
        if (body.status !== undefined && ['open', 'filled', 'closed'].includes(body.status)) data.status = body.status
        const updated = await prisma.recruitmentPost.update({ where: { id: post.id }, data })
        return { status: true, data: updated }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          title: t.Optional(t.String({ maxLength: 200 })),
          description: t.Optional(t.String({ maxLength: 4000 })),
          requirements: t.Optional(t.String({ maxLength: 2000 })),
          roles: t.Optional(t.String({ maxLength: 300 })),
          language: t.Optional(t.String()),
          urgent: t.Optional(t.Boolean()),
          status: t.Optional(t.String()),
        }),
        response: t.Object({ status: t.Boolean(), data: t.Any() }),
      },
    )
    // Eliminar
    .delete(
      '/api/organization/recruitment/:id',
      async ({ user, organizationId, params }) => {
        assertStaff(user, organizationId)
        const post = await prisma.recruitmentPost.findUnique({ where: { id: Number.parseInt(params.id) } })
        if (!post || post.organizationId !== organizationId) throw new Error('Anuncio no encontrado.')
        await prisma.recruitmentPost.delete({ where: { id: post.id } })
        return { status: true, data: true }
      },
      { params: t.Object({ id: t.String() }), response: t.Object({ status: t.Boolean(), data: t.Any() }) },
    )
