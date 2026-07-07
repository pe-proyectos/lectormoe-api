import { Elysia, t } from 'elysia'
import { getRecentlyAdded } from '../../controllers/landing/recently-added'

export const router = () =>
  new Elysia().get(
    '/api/landing/recently-added',
    async ({ query }) => {
      const limit = query?.limit ? Number.parseInt(query.limit) : 10
      const nsfw =
        query?.nsfw === 'true'
          ? true
          : query?.nsfw === 'false'
            ? false
            : undefined
      const contentKind =
        query?.contentKind === 'writing' || query?.contentKind === 'manga'
          ? query.contentKind
          : 'all'
      const data = await getRecentlyAdded(limit, nsfw, contentKind)
      return { status: true, data }
    },
    {
      query: t.Optional(
        t.Object({
          limit: t.Optional(t.String()),
          nsfw: t.Optional(t.String()),
          contentKind: t.Optional(t.String())
        })
      ),
      response: t.Object({
        status: t.Boolean(),
        data: t.Array(
          t.Object({
            id: t.String(),
            title: t.String(),
            cover: t.String(),
            scanName: t.String(),
            scanSlug: t.String(),
            scanUrl: t.String(),
            mangaSlug: t.String(),
            mangaUrl: t.String(),
            firstChapterNumber: t.Union([t.Number(), t.Null()]),
            firstChapterUrl: t.Union([t.String(), t.Null()]),
            badgeColor: t.String(),
            createdAt: t.Date(),
            organizationId: t.Number(),
            isNSFW: t.Boolean()
          })
        )
      })
    }
  )
