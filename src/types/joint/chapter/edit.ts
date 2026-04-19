import { type Static, t } from 'elysia';

export const EditJointChapterRequest = t.Object({
  number: t.Optional(t.Number()),
  title: t.Optional(t.Union([t.String(), t.Null()])),
  image: t.Optional(t.Union([t.String(), t.Null()])),
  releasedAt: t.Optional(t.Union([t.Date(), t.Null(), t.String()])),
  isUnreleased: t.Optional(t.Boolean()),
  pages: t.Optional(t.Array(t.String())),
  singlePages: t.Optional(t.Array(t.Number())),
  workedByOrganizationIds: t.Optional(t.Array(t.Number())),
});

export type EditJointChapterRequest = Static<typeof EditJointChapterRequest>;
