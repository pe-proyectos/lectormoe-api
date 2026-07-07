import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { loggedUserOnly, loggedUserOnlyGlobal } from '../../plugins/auth'
import { assertRateLimit } from '../../util/rate-limit'
import { assertNotBanned } from '../../util/ban-check'

const CATEGORIES = ['gracias', 'sugerencia', 'queja', 'unirme', 'otro'] as const

// ¿el usuario es staff (canSeeAdminPanel) de esta org?
async function isStaff(userId: number, organizationId: number) {
  const p = await prisma.permission.findFirst({ where: { userId, organizationId, canSeeAdminPanel: true }, select: { id: true } })
  return !!p
}

export const router = () =>
  new Elysia()
    .use(loggedUserOnlyGlobal())
    // Crear hilo (lector escribe a un scan por slug)
    .post(
      '/api/organization/:slug/messages',
      async ({ user, params, body }) => {
        const org = await prisma.organization.findUnique({ where: { slug: params.slug }, select: { id: true } })
        if (!org) throw new Error('Scan no encontrado.')
        assertRateLimit(`${user.id}:msg-create`, 5, 24 * 60 * 60 * 1000)
        await assertNotBanned(user.id, org.id, 'enviar mensajes a este scan')
        const openCount = await prisma.organizationMessageThread.count({ where: { userId: user.id, organizationId: org.id, status: 'open' } })
        if (openCount >= 3) throw new Error('Ya tienes varias conversaciones abiertas con este scan. Espera su respuesta antes de abrir otra.')
        const thread = await prisma.$transaction(async (tx) => {
          const th = await tx.organizationMessageThread.create({ data: { organizationId: org.id, userId: user.id, category: body.category, subject: body.subject.trim() } })
          await tx.organizationMessage.create({ data: { threadId: th.id, senderUserId: user.id, isStaffReply: false, body: body.body.trim() } })
          return th
        })
        return { status: true, data: thread }
      },
      {
        params: t.Object({ slug: t.String() }),
        body: t.Object({
          category: t.Union(CATEGORIES.map((c) => t.Literal(c))),
          subject: t.String({ minLength: 3, maxLength: 200 }),
          body: t.String({ minLength: 10, maxLength: 4000 }),
        }),
        response: t.Object({ status: t.Boolean(), data: t.Any() }),
      },
    )
    // Bandeja del lector
    .get(
      '/api/messages/me',
      async ({ user, query }) => {
        const page = query?.page ? Number.parseInt(query.page) : 1
        const threads = await prisma.organizationMessageThread.findMany({
          where: { userId: user.id },
          orderBy: { lastMessageAt: 'desc' },
          skip: (page - 1) * 20,
          take: 20,
          include: {
            organization: { select: { name: true, slug: true, logoUrl: true } },
            messages: { where: { isStaffReply: true, readAt: null }, select: { id: true } },
          },
        })
        const data = threads.map((t) => ({ ...t, unread: t.messages.length, messages: undefined }))
        return { status: true, data }
      },
      { query: t.Optional(t.Object({ page: t.Optional(t.String()) })), response: t.Object({ status: t.Boolean(), data: t.Any() }) },
    )
    // Ver un hilo (dueño o staff); marca leídos los de la contraparte
    .get(
      '/api/messages/:threadId',
      async ({ user, params }) => {
        const thread = await prisma.organizationMessageThread.findUnique({
          where: { id: Number.parseInt(params.threadId) },
          include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } }, user: { select: { username: true, slug: true, imageUrl: true } } },
        })
        if (!thread) throw new Error('Conversación no encontrada.')
        const owner = thread.userId === user.id
        const staff = !owner && (await isStaff(user.id, thread.organizationId))
        if (!owner && !staff) { throw new Error('No autorizado.') }
        // Marca leídos los mensajes de la contraparte.
        await prisma.organizationMessage.updateMany({
          where: { threadId: thread.id, readAt: null, isStaffReply: owner ? true : false },
          data: { readAt: new Date() },
        })
        const messages = await prisma.organizationMessage.findMany({
          where: { threadId: thread.id },
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { username: true, slug: true, imageUrl: true } } },
        })
        return { status: true, data: { thread, messages, isStaff: staff } }
      },
      { params: t.Object({ threadId: t.String() }), response: t.Object({ status: t.Boolean(), data: t.Any() }) },
    )
    // Responder
    .post(
      '/api/messages/:threadId/reply',
      async ({ user, params, body }) => {
        const thread = await prisma.organizationMessageThread.findUnique({ where: { id: Number.parseInt(params.threadId) } })
        if (!thread) throw new Error('Conversación no encontrada.')
        const owner = thread.userId === user.id
        const staff = !owner && (await isStaff(user.id, thread.organizationId))
        if (!owner && !staff) throw new Error('No autorizado.')
        if (thread.status === 'closed' && !staff) throw new Error('El scan cerró esta conversación.')
        assertRateLimit(`${user.id}:msg-reply`, 20, 60_000)
        await prisma.$transaction([
          prisma.organizationMessage.create({ data: { threadId: thread.id, senderUserId: user.id, isStaffReply: staff, body: body.body.trim() } }),
          prisma.organizationMessageThread.update({ where: { id: thread.id }, data: { lastMessageAt: new Date(), ...(thread.status === 'closed' && staff ? { status: 'open' } : {}) } }),
        ])
        // Notificar a la contraparte: si respondió el staff, avisa al lector.
        if (staff) {
          await prisma.notification.create({ data: { userId: thread.userId, type: 'scan_message_reply', organizationId: thread.organizationId, source: 'org_follower' } }).catch(() => {})
        }
        return { status: true, data: true }
      },
      { params: t.Object({ threadId: t.String() }), body: t.Object({ body: t.String({ minLength: 1, maxLength: 4000 }) }), response: t.Object({ status: t.Boolean(), data: t.Any() }) },
    )
    // Cerrar (dueño o staff)
    .patch(
      '/api/messages/:threadId/close',
      async ({ user, params }) => {
        const thread = await prisma.organizationMessageThread.findUnique({ where: { id: Number.parseInt(params.threadId) } })
        if (!thread) throw new Error('Conversación no encontrada.')
        const owner = thread.userId === user.id
        const staff = !owner && (await isStaff(user.id, thread.organizationId))
        if (!owner && !staff) throw new Error('No autorizado.')
        await prisma.organizationMessageThread.update({ where: { id: thread.id }, data: { status: 'closed' } })
        return { status: true, data: true }
      },
      { params: t.Object({ threadId: t.String() }), response: t.Object({ status: t.Boolean(), data: t.Any() }) },
    )

// Bandeja del admin (org por header x-organization)
export const adminRouter = () =>
  new Elysia().use(loggedUserOnly()).get(
    '/api/organization/messages',
    async ({ organizationId, user, query }) => {
      const perm = user.permissions?.find((p: any) => p.organizationId === organizationId)
      if (!perm?.canSeeAdminPanel) throw new Error('No autorizado.')
      const status = query?.status === 'all' ? undefined : (query?.status || 'open')
      const category = query?.category
      const threads = await prisma.organizationMessageThread.findMany({
        where: { organizationId, ...(status ? { status } : {}), ...(category ? { category } : {}) },
        orderBy: { lastMessageAt: 'desc' },
        take: 100,
        include: {
          user: { select: { username: true, slug: true, imageUrl: true } },
          messages: { where: { isStaffReply: false, readAt: null }, select: { id: true } },
        },
      })
      const data = threads.map((t) => ({ ...t, unread: t.messages.length, messages: undefined }))
      return { status: true, data }
    },
    { query: t.Optional(t.Object({ status: t.Optional(t.String()), category: t.Optional(t.String()) })), response: t.Object({ status: t.Boolean(), data: t.Any() }) },
  )
