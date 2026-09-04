import { type Static, t } from "elysia";

export const EditUserRequest = t.Object({
  role: t.Optional(t.String()),

  birthdate: t.Optional(t.Date()),
  
  description: t.Optional(t.String()),
  username: t.Optional(t.String()),
  
  // Settings fields
  emailVerified: t.Optional(t.Boolean()),
  isPublicProfile: t.Optional(t.Boolean()),
  savedQuotesPublic: t.Optional(t.Boolean()),
  isPrivateHistory: t.Optional(t.Boolean()),
  emailNotifications: t.Optional(t.Boolean()),
  pushNotifications: t.Optional(t.Boolean()),
  notifyCommentsOnOwnedContent: t.Optional(t.Boolean()),
  theme: t.Optional(t.String()),
  hierarchyLevel: t.Optional(t.Number()),
  image: t.Optional(t.Union([t.String(), t.Null()])),
  banner: t.Optional(t.Union([t.String(), t.Null()])),
  // ## Permissions
  // Organization
  canSeeAdminPanel: t.Optional(t.Boolean()),
  canEditOrganization: t.Optional(t.Boolean()),
  canDeleteOrganization: t.Optional(t.Boolean()),
  // Organization User
  canEditUser: t.Optional(t.Boolean()),
  canDeleteUser: t.Optional(t.Boolean()),
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
  // Subscription Plan
  canCreateSubscriptionPlan: t.Optional(t.Boolean()),
  canEditSubscriptionPlan: t.Optional(t.Boolean()),
  canDeleteSubscriptionPlan: t.Optional(t.Boolean()),
  // Comment
  canDeleteComment: t.Optional(t.Boolean()),
  canEditComment: t.Optional(t.Boolean()),
  canHideComment: t.Optional(t.Boolean()),
  // Perks
  hideAds: t.Optional(t.Boolean()),
  canDownload: t.Optional(t.Boolean()),
  canReadUnreleased: t.Optional(t.Boolean()),
});

export type EditUserRequest = Static<typeof EditUserRequest>;
