import { type Static, t } from 'elysia';

export const EditJointRequest = t.Object({
  title: t.Optional(t.Union([t.String(), t.Null()])),
  shortDescription: t.Optional(t.Union([t.String(), t.Null()])),
  description: t.Optional(t.Union([t.String(), t.Null()])),
  image: t.Optional(t.Union([t.String(), t.Null()])),
  banner: t.Optional(t.Union([t.String(), t.Null()])),
  status: t.Optional(t.Union([t.String(), t.Null()])),
  workType: t.Optional(t.Union([t.String(), t.Null()])),
  genreIds: t.Optional(t.Array(t.Number())),
});

export type EditJointRequest = Static<typeof EditJointRequest>;
