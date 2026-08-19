import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { loggedOptional, loggedUserOnlyGlobal } from '../../plugins/auth'
import { listSlugFromName, validateListName } from '../../util/list-name'
import { assertRateLimit } from '../../util/rate-limit'

const MAX_LISTS = 20
const MAX_ITEMS = 100
// Los usuarios NO suscriptores solo pueden seguir/guardar hasta 5 listas.
const FREE_FOLLOW_LIMIT = 5

// Suscriptor "de verdad": suscripción activa, no vencida (endDate) y con plan
// activo. Replica el chequeo canónico de src/util/access-control.ts (no basta
// con active:true, que dejaba pasar suscripciones vencidas sin reconciliar).
async function isSubscriber(userId: number): Promise<boolean> {
  const subs = await prisma.subscription.findMany({
    where: { userId, active: true },
    select: { endDate: true, subscriptionPlan: { select: { active: true } } }
  })
  const now = new Date()
  return subs.some(
    (s) =>
      (!s.endDate || new Date(s.endDate) >= now) &&
      s.subscriptionPlan?.active !== false
  )
}

async function requireSubscriber(userId: number) {
  if (!(await isSubscriber(userId)))
    throw new Error(
      'Crear, editar y clonar listas públicas es un beneficio para suscriptores de cualquier scan.'
    )
}

const itemInclude = {
  items: {
    orderBy: { order: 'asc' as const },
    include: {
      mangaCustom: {
        select: {
          id: true,
          imageUrl: true,
          title: true,
          manga: { select: { slug: true, imageUrl: true } },
          organization: { select: { slug: true, isNSFW: true } },
          isNSFW: true
        }
      },
      joint: { select: { id: true, imageUrl: true, title: true, slug: true } }
    }
  }
}

// Devuelve el set de listIds que el usuario sigue (para flags isFollowing).
async function followedSet(
  userId: number | undefined,
  listIds: number[]
): Promise<Set<number>> {
  if (!userId || listIds.length === 0) return new Set()
  const rows = await prisma.customListFollower.findMany({
    where: { userId, listId: { in: listIds } },
    select: { listId: true }
  })
  return new Set(rows.map((r) => r.listId))
}

export const router = () =>
  new Elysia()
    .use(loggedOptional())
    .get(
      '/api/lists/community',
      async ({ query, user }) => {
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
                    isNSFW: true,
                    organization: { select: { isNSFW: true } },
                    manga: { select: { imageUrl: true } }
                  }
                },
                joint: { select: { imageUrl: true } }
              }
            },
            _count: { select: { items: true, followers: true } }
          }
        })
        const following = await followedSet(
          user?.id,
          lists.map((l) => l.id)
        )
        const data = lists.map((l) => ({
          ...l,
          isFollowing: following.has(l.id),
          isOwner: user?.id === l.userId
        }))
        return { status: true, data }
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
    // Listas que el usuario logueado SIGUE (guardadas). Va antes de /:userSlug
    // para que "followed" no se interprete como un slug de usuario.
    .get(
      '/api/lists/followed',
      async ({ user }) => {
        if (!user) return { status: true, data: [] }
        const rows = await prisma.customListFollower.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          include: {
            list: {
              include: {
                user: {
                  select: { username: true, slug: true, imageUrl: true }
                },
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
                _count: { select: { items: true, followers: true } }
              }
            }
          }
        })
        const data = rows
          .filter((r) => r.list)
          .map((r) => ({
            ...r.list,
            isFollowing: true,
            isOwner: user.id === r.list.userId
          }))
        return { status: true, data }
      },
      { response: t.Object({ status: t.Boolean(), data: t.Any() }) }
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
          include: {
            _count: { select: { items: true, followers: true } },
            items: {
              take: 4,
              orderBy: { order: 'asc' },
              include: {
                mangaCustom: {
                  select: {
                    imageUrl: true,
                    isNSFW: true,
                    organization: { select: { isNSFW: true } },
                    manga: { select: { imageUrl: true } }
                  }
                },
                joint: { select: { imageUrl: true } }
              }
            }
          }
        })
        const following = await followedSet(
          user?.id,
          lists.map((l) => l.id)
        )
        const data = lists.map((l) => ({
          ...l,
          isFollowing: following.has(l.id),
          isOwner
        }))
        return { status: true, data }
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
          include: {
            ...itemInclude,
            _count: { select: { items: true, followers: true } }
          }
        })
        if (!list || (!list.isPublic && user?.id !== owner.id))
          return { status: false, data: null }
        const isOwner = user?.id === owner.id
        const following = await followedSet(user?.id, [list.id])
        const isFollowing = following.has(list.id)
        const canEdit = isOwner && !!user && (await isSubscriber(user.id))

        // "Su versión": para un viewer logueado que NO es el dueño, se hace merge
        // con su overlay (estado de lectura + orden) sin tocar la membresía.
        let items: any[] = list.items
        if (user && !isOwner) {
          const overlay = await prisma.customListFollowerItem.findMany({
            where: { userId: user.id, listId: list.id },
            select: {
              mangaCustomId: true,
              jointId: true,
              readingStatus: true,
              order: true
            }
          })
          const keyOf = (mc: number | null, j: number | null) =>
            mc ? `m${mc}` : `j${j}`
          const byKey = new Map(
            overlay.map((o) => [keyOf(o.mangaCustomId, o.jointId), o])
          )
          items = list.items
            .map((it: any) => {
              const o = byKey.get(keyOf(it.mangaCustomId, it.jointId))
              return {
                ...it,
                myStatus: o?.readingStatus ?? null,
                myOrder: o?.order ?? it.order
              }
            })
            .sort((a: any, b: any) => a.myOrder - b.myOrder)
        }

        return {
          status: true,
          data: {
            ...list,
            items,
            owner,
            isOwner,
            isFollowing,
            viewerIsFollower: isFollowing && !isOwner,
            canEdit
          }
        }
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
            description: body.description?.trim() || null,
            // Crear una lista te auto-suscribe (aparece en "Guardadas").
            followers: { create: { userId: user.id } }
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
    // Clonar una lista pública como una lista editable propia (solo suscriptores).
    .post(
      '/api/lists/:id/clone',
      async ({ user, params }) => {
        assertRateLimit(`${user.id}:list-clone`, 10, 60 * 60 * 1000)
        await requireSubscriber(user.id)
        const src = await prisma.customList.findUnique({
          where: { id: Number.parseInt(params.id) },
          include: { items: { orderBy: { order: 'asc' } } }
        })
        if (!src || (!src.isPublic && src.userId !== user.id))
          throw new Error('Lista no encontrada.')
        const count = await prisma.customList.count({
          where: { userId: user.id }
        })
        if (count >= MAX_LISTS)
          throw new Error(`Alcanzaste el máximo de ${MAX_LISTS} listas.`)
        // Nombre/slug únicos para el clon.
        const baseName = validateListName(`Copia de ${src.name}`.slice(0, 60))
        let slugv = listSlugFromName(baseName)
        let n = 2
        while (
          await prisma.customList.findFirst({
            where: { userId: user.id, slug: slugv },
            select: { id: true }
          })
        ) {
          slugv = listSlugFromName(`${baseName} ${n}`.slice(0, 60))
          n++
        }
        const clone = await prisma.customList.create({
          data: {
            userId: user.id,
            name: baseName,
            slug: slugv,
            description: src.description,
            followers: { create: { userId: user.id } },
            items: {
              create: src.items.map((it) => ({
                mangaCustomId: it.mangaCustomId,
                jointId: it.jointId,
                order: it.order
              }))
            }
          }
        })
        return { status: true, data: clone }
      },
      {
        params: t.Object({ id: t.String() }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    // Agregar TODO el contenido de una lista a mi lista personal (gratis).
    .post(
      '/api/lists/:id/import-to-mylist',
      async ({ user, params }) => {
        const src = await prisma.customList.findUnique({
          where: { id: Number.parseInt(params.id) },
          include: { items: { orderBy: { order: 'asc' } } }
        })
        if (!src || (!src.isPublic && src.userId !== user.id))
          throw new Error('Lista no encontrada.')
        // Punto de partida del orden en la lista personal.
        const maxOrder = await prisma.userList.aggregate({
          where: { userId: user.id },
          _max: { order: true }
        })
        let order = (maxOrder._max.order ?? 0) + 1
        let added = 0
        for (const it of src.items) {
          if (!it.mangaCustomId && !it.jointId) continue
          const where = it.mangaCustomId
            ? {
                userId_mangaCustomId: {
                  userId: user.id,
                  mangaCustomId: it.mangaCustomId
                }
              }
            : { userId_jointId: { userId: user.id, jointId: it.jointId! } }
          const existing = await prisma.userList.findUnique({
            where: where as any,
            select: { id: true }
          })
          if (existing) continue
          await prisma.userList.create({
            data: {
              userId: user.id,
              mangaCustomId: it.mangaCustomId,
              jointId: it.jointId,
              order: order++,
              readingStatus: 'PLAN_TO_READ'
            }
          })
          added++
        }
        return { status: true, data: { added } }
      },
      {
        params: t.Object({ id: t.String() }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    // Seguir/guardar una lista (gratis; límite de 5 para no suscriptores).
    .post(
      '/api/lists/:id/follow',
      async ({ user, params }) => {
        const listId = Number.parseInt(params.id)
        const list = await prisma.customList.findUnique({
          where: { id: listId },
          select: { id: true, isPublic: true, userId: true }
        })
        if (!list || (!list.isPublic && list.userId !== user.id))
          throw new Error('Lista no encontrada.')
        const already = await prisma.customListFollower.findUnique({
          where: { userId_listId: { userId: user.id, listId } },
          select: { id: true }
        })
        if (already) return { status: true, data: true }
        if (!(await isSubscriber(user.id))) {
          const count = await prisma.customListFollower.count({
            where: { userId: user.id }
          })
          if (count >= FREE_FOLLOW_LIMIT)
            throw new Error(
              `Los usuarios gratuitos pueden guardar hasta ${FREE_FOLLOW_LIMIT} listas. Suscríbete para guardar sin límite.`
            )
        }
        await prisma.customListFollower.create({
          data: { userId: user.id, listId }
        })
        return { status: true, data: true }
      },
      {
        params: t.Object({ id: t.String() }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    .delete(
      '/api/lists/:id/follow',
      async ({ user, params }) => {
        await prisma.customListFollower.deleteMany({
          where: { userId: user.id, listId: Number.parseInt(params.id) }
        })
        return { status: true, data: true }
      },
      {
        params: t.Object({ id: t.String() }),
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
          select: { userId: true, name: true }
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
        const item = await prisma.customListItem.upsert({
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
        // Aviso a los seguidores (menos el dueño) de que la lista se actualizó.
        if (item) {
          const followers = await prisma.customListFollower.findMany({
            where: { listId, userId: { not: user.id } },
            select: { userId: true }
          })
          if (followers.length > 0) {
            await prisma.notification.createMany({
              data: followers.map((f) => ({
                userId: f.userId,
                type: 'list_updated',
                source: 'user_list',
                listId,
                mangaCustomId: body.mangaCustomId ?? null,
                jointId: body.jointId ?? null,
                details: list.name?.slice(0, 200) || null
              }))
            })
          }
        }
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
    // Reordenar los items de la lista (solo dueño suscriptor). ids = item.id en
    // el nuevo orden.
    .patch(
      '/api/lists/:id/items/reorder',
      async ({ user, params, body }) => {
        const listId = Number.parseInt(params.id)
        const list = await prisma.customList.findUnique({
          where: { id: listId },
          select: { userId: true }
        })
        if (!list || list.userId !== user.id)
          throw new Error('Lista no encontrada.')
        await requireSubscriber(user.id)
        await prisma.$transaction(
          body.ids.map((itemId, index) =>
            prisma.customListItem.updateMany({
              where: { id: itemId, listId },
              data: { order: index }
            })
          )
        )
        return { status: true, data: true }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({ ids: t.Array(t.Number()) }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    // Follower: marca su estado de lectura para una obra de una lista seguida
    // (su versión). No cambia la membresía. readingStatus null limpia la marca.
    .patch(
      '/api/lists/:id/my-item',
      async ({ user, params, body }) => {
        const listId = Number.parseInt(params.id)
        const list = await prisma.customList.findUnique({
          where: { id: listId },
          select: { isPublic: true, userId: true }
        })
        if (!list || (!list.isPublic && list.userId !== user.id))
          throw new Error('Lista no encontrada.')
        const item = await prisma.customListItem.findFirst({
          where: {
            listId,
            ...(body.mangaCustomId
              ? { mangaCustomId: body.mangaCustomId }
              : { jointId: body.jointId })
          },
          select: { order: true }
        })
        if (!item) throw new Error('La obra no está en esta lista.')
        const where = body.mangaCustomId
          ? {
              userId_listId_mangaCustomId: {
                userId: user.id,
                listId,
                mangaCustomId: body.mangaCustomId
              }
            }
          : {
              userId_listId_jointId: {
                userId: user.id,
                listId,
                jointId: body.jointId!
              }
            }
        await prisma.customListFollowerItem.upsert({
          where: where as any,
          update: { readingStatus: body.readingStatus ?? null },
          create: {
            userId: user.id,
            listId,
            mangaCustomId: body.mangaCustomId ?? null,
            jointId: body.jointId ?? null,
            readingStatus: body.readingStatus ?? null,
            order: item.order
          }
        })
        return { status: true, data: true }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          mangaCustomId: t.Optional(t.Number()),
          jointId: t.Optional(t.Number()),
          readingStatus: t.Optional(t.Union([t.String(), t.Null()]))
        }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    // Follower: reordena SU versión de la lista. body.items = obras en el nuevo
    // orden ({mangaCustomId?} | {jointId?}). Upsert del overlay con order=index.
    .patch(
      '/api/lists/:id/my-reorder',
      async ({ user, params, body }) => {
        const listId = Number.parseInt(params.id)
        const list = await prisma.customList.findUnique({
          where: { id: listId },
          select: { isPublic: true, userId: true }
        })
        if (!list || (!list.isPublic && list.userId !== user.id))
          throw new Error('Lista no encontrada.')
        await prisma.$transaction(
          body.items.map((k, index) => {
            const where = k.mangaCustomId
              ? {
                  userId_listId_mangaCustomId: {
                    userId: user.id,
                    listId,
                    mangaCustomId: k.mangaCustomId
                  }
                }
              : {
                  userId_listId_jointId: {
                    userId: user.id,
                    listId,
                    jointId: k.jointId!
                  }
                }
            return prisma.customListFollowerItem.upsert({
              where: where as any,
              update: { order: index },
              create: {
                userId: user.id,
                listId,
                mangaCustomId: k.mangaCustomId ?? null,
                jointId: k.jointId ?? null,
                order: index
              }
            })
          })
        )
        return { status: true, data: true }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          items: t.Array(
            t.Object({
              mangaCustomId: t.Optional(t.Number()),
              jointId: t.Optional(t.Number())
            })
          )
        }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
