import { type Static, t } from 'elysia'

export const EditChapterRequest = t.Object({
  title: t.Optional(t.String()),
  number: t.Optional(t.Number()),
  releasedAt: t.Optional(t.Union([t.Date(), t.Null()])),
  image: t.Optional(t.Union([t.String(), t.Null()])),
  pages: t.Optional(t.Array(t.String())),
  singlePages: t.Optional(t.Union([t.Array(t.Number()), t.String()])),
  isUnreleased: t.Optional(t.Boolean()),
  volumeNumber: t.Optional(t.Union([t.Number(), t.Null()])),
  bodyMarkdown: t.Optional(t.Union([t.String(), t.Null()]))
})

export type EditChapterRequest = Static<typeof EditChapterRequest>
