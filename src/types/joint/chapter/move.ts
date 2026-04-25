import { type Static, t } from 'elysia';

export const BulkMoveJointChaptersRequest = t.Object({
  chapterIds: t.Array(t.Number()),
  direction: t.Union([t.Literal('promote'), t.Literal('demote')]),
  replaceConflicts: t.Optional(t.Boolean()),
});
export type BulkMoveJointChaptersRequest = Static<typeof BulkMoveJointChaptersRequest>;

export const TransferAuthorshipRequest = t.Object({
  toOrganizationId: t.Number(),
});
export type TransferAuthorshipRequest = Static<typeof TransferAuthorshipRequest>;
