import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { loggedOptional, loggedUserOnlyGlobal } from '../../plugins/auth'
import { listSlugFromName, validateListName } from '../../util/list-name'
import { assertRateLimit } from '../../util/rate-limit'

const MAX_LISTS = 20
const MAX_ITEMS = 100

async function requireSubscriber(userId: number) {
  const s = await prisma.subscription.findFirst({
    where: { userId, active: true },
    select: { id: true }
  })
  if (!s)
    throw new Error(
      'Crear listas públicas es un beneficio para suscriptores de cualquier scan.'
    )
}

const itemInclude = {
  items: {
    orderBy: { order: 'asc' as const },
    include: {
      mangaCustom: {
        select: {
          imageUrl: true,
          title: true,
          manga: { select: { slug: true, imageUrl: true } },
          organization: { select: { slug: true, isNSFW: true } },
          isNSFW: true
        }
      },
      joint: { select: { imageUrl: true, title: true, slug: true } }
    }
  }
}

export const router = () =>
  new Elysia()
    .use(loggedOptional())
    .get(
      '/api/lists/community',
      async ({ query }) => {
        const page = query?.page ? Number.parseInt(query.page) : 1
        const search = query?.search?.trim()
        const lists = await prisma.customList.findMany({
          where: {
            isPublic: true,
            ...(search
              ? { name: { contains: search, mode: 'insensitive' } }
              : {})
          },
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * 20,
          take: 20,
          include: {
            user: { select: { username: true, slug: true, imageUrl: true } },
            items: {
              take: 4,
              orderBy: { order: 'asc' },
              include: {
                mangaCustom: {
                  select: {
                    imageUrl: true,
                    manga: { select: { imageUrl: true } }
                  }
                },
                joint: { select: { imageUrl: true } }
              }
            },
            _count: { select: { items: true } }
          }
        })
        return { status: true, data: lists }
      },
      {
        query: t.Optional(
          t.Object({
            page: t.Optional(t.String()),
            search: t.Optional(t.String())
          })
        ),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    .get(
      '/api/lists/:userSlug',
      async ({ params, user }) => {
        const owner = await prisma.user.findUnique({
          where: { slug: params.userSlug },
          select: { id: true }
        })
        if (!owner) return { status: true, data: [] }
        const isOwner = user?.id === owner.id
        const lists = await prisma.customList.findMany({
          where: { userId: owner.id, ...(isOwner ? {} : { isPublic: true }) },
          orderBy: { updatedAt: 'desc' },
          include: { _count: { select: { items: true } } }
        })
        return { status: true, data: lists }
      },
      {
        params: t.Object({ userSlug: t.String() }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    .get(
      '/api/lists/:userSlug/:listSlug',
      async ({ params, user }) => {
        const owner = await prisma.user.findUnique({
          where: { slug: params.userSlug },
          select: { id: true, username: true, slug: true, imageUrl: true }
        })
        if (!owner) return { status: false, data: null }
        const list = await prisma.customList.findFirst({
          where: { userId: owner.id, slug: params.listSlug },
          include: itemInclude
        })
        if (!list || (!list.isPublic && user?.id !== owner.id))
          return { status: false, data: null }
        return { status: true, data: { ...list, owner } }
      },
      {
        params: t.Object({ userSlug: t.String(), listSlug: t.String() }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    .use(loggedUserOnlyGlobal())
    .post(
      '/api/lists',
      async ({ user, body }) => {
        assertRateLimit(`${user.id}:list-create`, 10, 60 * 60 * 1000)
        await requireSubscriber(user.id)
        const count = await prisma.customList.count({
          where: { userId: user.id }
        })
        if (count >= MAX_LISTS)
          throw new Error(`Alcanzaste el máximo de ${MAX_LISTS} listas.`)
        const name = validateListName(body.name)
        const slugv = listSlugFromName(name)
        const dup = await prisma.customList.findFirst({
          where: { userId: user.id, slug: slugv },
          select: { id: true }
        })
        if (dup)
          throw new Error(
            'Ya tienes una lista con un nombre demasiado parecido.'
          )
        const list = await prisma.customList.create({
          data: {
            userId: user.id,
            name,
            slug: slugv,
            description: body.description?.trim() || null
          }
        })
        return { status: true, data: list }
      },
      {
        body: t.Object({
          name: t.String(),
          description: t.Optional(
            t.Union([t.String({ maxLength: 500 }), t.Null()])
          )
        }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    .patch(
      '/api/lists/:id',
      async ({ user, params, body }) => {
        const list = await prisma.customList.findUnique({
          where: { id: Number.parseInt(params.id) },
          select: { userId: true }
        })
        if (!list || list.userId !== user.id)
          throw new Error('Lista no encontrada.')
        const data: any = {}
        if (body.name !== undefined || body.description !== undefined) {
          await requireSubscriber(user.id) // editar nombre/desc requiere suscripción
          if (body.name !== undefined) data.name = validateListName(body.name)
          if (body.description !== undefined)
            data.description = body.description?.trim() || null
        }
        if (body.isPublic !== undefined) data.isPublic = body.isPublic // el dueño siempre puede
        const updated = await prisma.customList.update({
          where: { id: Number.parseInt(params.id) },
          data
        })
        return { status: true, data: updated }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          description: t.Optional(t.Union([t.String(), t.Null()])),
          isPublic: t.Optional(t.Boolean())
        }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    .delete(
      '/api/lists/:id',
      async ({ user, params }) => {
        const list = await prisma.customList.findUnique({
          where: { id: Number.parseInt(params.id) },
          select: { userId: true }
        })
        if (!list || list.userId !== user.id)
          throw new Error('Lista no encontrada.')
        await prisma.customList.delete({
          where: { id: Number.parseInt(params.id) }
        })
        return { status: true, data: true }
      },
      {
        params: t.Object({ id: t.String() }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    .post(
      '/api/lists/:id/items',
      async ({ user, params, body }) => {
        const list = await prisma.customList.findUnique({
          where: { id: Number.parseInt(params.id) },
          select: { userId: true }
        })
        if (!list || list.userId !== user.id)
          throw new Error('Lista no encontrada.')
        await requireSubscriber(user.id)
        const listId = Number.parseInt(params.id)
        const count = await prisma.customListItem.count({ where: { listId } })
        if (count >= MAX_ITEMS)
          throw new Error(
            `Alcanzaste el máximo de ${MAX_ITEMS} obras en esta lista.`
          )
        const max = await prisma.customListItem.aggregate({
          where: { listId },
          _max: { order: true }
        })
        await prisma.customListItem.upsert({
          where: body.mangaCustomId
            ? {
                listId_mangaCustomId: {
                  listId,
                  mangaCustomId: body.mangaCustomId
                }
              }
            : { listId_jointId: { listId, jointId: body.jointId! } },
          update: {},
          create: {
            listId,
            mangaCustomId: body.mangaCustomId ?? null,
            jointId: body.jointId ?? null,
            order: (max._max.order ?? 0) + 1
          }
        })
        await prisma.customList.update({
          where: { id: listId },
          data: { updatedAt: new Date() }
        })
        return { status: true, data: true }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          mangaCustomId: t.Optional(t.Number()),
          jointId: t.Optional(t.Number())
        }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    .delete(
      '/api/lists/:id/items',
      async ({ user, params, body }) => {
        const list = await prisma.customList.findUnique({
          where: { id: Number.parseInt(params.id) },
          select: { userId: true }
        })
        if (!list || list.userId !== user.id)
          throw new Error('Lista no encontrada.')
        const listId = Number.parseInt(params.id)
        await prisma.customListItem.deleteMany({
          where: {
            listId,
            ...(body.mangaCustomId
              ? { mangaCustomId: body.mangaCustomId }
              : { jointId: body.jointId })
          }
        })
        return { status: true, data: true }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          mangaCustomId: t.Optional(t.Number()),
          jointId: t.Optional(t.Number())
        }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
