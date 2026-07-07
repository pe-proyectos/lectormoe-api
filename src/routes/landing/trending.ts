import { Elysia, t } from 'elysia'
import { getTrending } from '../../controllers/landing/trending'

export const router = () =>
  new Elysia().get(
    '/api/landing/trending',
    async ({ query }) => {
      const period =
        query?.period === 'week' || query?.period === 'month'
          ? query.period
          : 'day'
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
      const data = await getTrending(period, limit, nsfw, contentKind)
      return { status: true, data }
    },
    {
      query: t.Optional(
        t.Object({
          period: t.Optional(t.String()),
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
            badgeColor: t.String(),
            readers: t.Number(),
            chapters: t.Array(
              t.Object({
                id: t.Number(),
                number: t.Number(),
                title: t.String(),
                releasedAt: t.Date(),
                chapterUrl: t.String()
              })
            ),
            organizationId: t.Number(),
            isNSFW: t.Boolean(),
            isJoint: t.Boolean()
          })
        )
      })
    }
  )
