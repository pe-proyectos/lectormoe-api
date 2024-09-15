import { type Static, t } from "elysia";

export const EditMemberRequest = t.Object({
  role: t.Optional(t.String()),
  description: t.Optional(t.String()),
  hierarchyLevel: t.Optional(t.Number()),
  image: t.Optional(
      t.Union([
          t.File({
              maxSize: '25m',
          }),
          t.String(),
      ])
  ),
  // ## Permissions
  // Organization
  canSeeAdminPanel: t.Optional(t.Boolean()),
  canEditOrganization: t.Optional(t.Boolean()),
  canDeleteOrganization: t.Optional(t.Boolean()),
  // Organization Members
  canInviteMember: t.Optional(t.Boolean()),
  canEditMember: t.Optional(t.Boolean()),
  canDeleteMember: t.Optional(t.Boolean()),
  // Author
  canCreateAuthor: t.Optional(t.Boolean()),
  // Manga Profile
  canCreateMangaProfile: t.Optional(t.Boolean()),
  // Manga Custom
  canCreateMangaCustom: t.Optional(t.Boolean()),
  canEditMangaCustom: t.Optional(t.Boolean()),
  canDeleteMangaCustom: t.Optional(t.Boolean()),
  // Genre
  canCreateGenre: t.Optional(t.Boolean()),
  canEditGenre: t.Optional(t.Boolean()),
  canDeleteGenre: t.Optional(t.Boolean()),
  // Chapter
  canCreateChapter: t.Optional(t.Boolean()),
  canEditChapter: t.Optional(t.Boolean()),
  canDeleteChapter: t.Optional(t.Boolean()),
  // Pages
  canCreatePage: t.Optional(t.Boolean()),
  canEditPage: t.Optional(t.Boolean()),
  canDeletePage: t.Optional(t.Boolean()),
  // Coin Pack
  canCreateCoinPack: t.Optional(t.Boolean()),
  canEditCoinPack: t.Optional(t.Boolean()),
  canDeleteCoinPack: t.Optional(t.Boolean()),
});

export type EditMemberRequest = Static<typeof EditMemberRequest>;
