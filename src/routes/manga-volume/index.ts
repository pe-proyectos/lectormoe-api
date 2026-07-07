import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { loggedOptional, loggedUserOnly } from '../../plugins/auth'

const r2 = () => Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com'
const toUrl = (key?: string | null) =>
  !key ? null : key.startsWith('http') ? key : `${r2()}/${key}`

async function resolveMc(organizationId: number, mangaSlug: string) {
  return prisma.mangaCustom.findFirst({
    where: { organizationId, manga: { slug: mangaSlug }, deletedAt: null },
    select: { id: true }
  })
}

async function assertCanEdit(user: any, organizationId: number) {
  const perm = user?.permissions?.find(
    (p: any) => p.organizationId === organizationId
  )
  if (!perm?.canEditMangaCustom)
    throw new Error('No tienes permisos para editar esta obra.')
}

export const router = () =>
  new Elysia()
    // Público: listar volúmenes de una obra
    .use(loggedOptional())
    .get(
      '/api/manga-custom/:mangaSlug/volumes',
      async ({ organizationId, params }) => {
        const mc = organizationId
          ? await resolveMc(organizationId, params.mangaSlug)
          : null
        if (!mc) return { status: true, data: [] }
        const volumes = await prisma.mangaVolume.findMany({
          where: { mangaCustomId: mc.id },
          orderBy: { number: 'asc' }
        })
        return { status: true, data: volumes }
      },
      {
        params: t.Object({ mangaSlug: t.String() }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    // Staff: upsert de metadatos de un volumen
    .use(loggedUserOnly())
    .put(
      '/api/manga-custom/:mangaSlug/volumes/:number',
      async ({ organizationId, user, params, body }) => {
        await assertCanEdit(user, organizationId)
        const mc = await resolveMc(organizationId, params.mangaSlug)
        if (!mc) throw new Error('Obra no encontrada.')
        const number = Number.parseInt(params.number)
        const coverUrl =
          body.coverUrl !== undefined ? toUrl(body.coverUrl) : undefined
        const volume = await prisma.mangaVolume.upsert({
          where: { mangaCustomId_number: { mangaCustomId: mc.id, number } },
          update: {
            title: body.title ?? null,
            ...(coverUrl !== undefined ? { coverUrl } : {})
          },
          create: {
            mangaCustomId: mc.id,
            number,
            title: body.title ?? null,
            coverUrl: coverUrl ?? null
          }
        })
        return { status: true, data: volume }
      },
      {
        params: t.Object({ mangaSlug: t.String(), number: t.String() }),
        body: t.Object({
          title: t.Optional(t.Union([t.String(), t.Null()])),
          coverUrl: t.Optional(t.Union([t.String(), t.Null()]))
        }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    // Staff: eliminar SOLO metadatos del volumen (los capítulos conservan su volumeNumber)
    .delete(
      '/api/manga-custom/:mangaSlug/volumes/:number',
      async ({ organizationId, user, params }) => {
        await assertCanEdit(user, organizationId)
        const mc = await resolveMc(organizationId, params.mangaSlug)
        if (!mc) throw new Error('Obra no encontrada.')
        await prisma.mangaVolume.deleteMany({
          where: {
            mangaCustomId: mc.id,
            number: Number.parseInt(params.number)
          }
        })
        return { status: true, data: true }
      },
      {
        params: t.Object({ mangaSlug: t.String(), number: t.String() }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
