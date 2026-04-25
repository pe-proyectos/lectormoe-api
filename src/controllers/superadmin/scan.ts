import { prisma } from '../../models/prisma';

const PLATFORM_OWNER_EMAIL = 'luis.choque.castro@outlook.com';

const SLUG_REGEX = /^[a-z0-9-]+$/;

// Mirror of every Boolean column on the Permission model. If a future migration
// adds a new `can*` flag, append it here so superadmin-created scans grant it.
const FULL_PERMISSION_FLAGS = {
  canCreateAuthor: true,
  canCreateChapter: true,
  canCreateGenre: true,
  canCreateMangaCustom: true,
  canCreateMangaProfile: true,
  canCreatePage: true,
  canDeleteChapter: true,
  canDeleteGenre: true,
  canDeleteMangaCustom: true,
  canDeleteOrganization: true,
  canDeletePage: true,
  canEditChapter: true,
  canEditGenre: true,
  canEditMangaCustom: true,
  canEditOrganization: true,
  canEditPage: true,
  canSeeAdminPanel: true,
  canDeleteUser: true,
  canEditUser: true,
  canCreateSubscriptionPlan: true,
  canDeleteSubscriptionPlan: true,
  canEditSubscriptionPlan: true,
  canDownload: true,
  canReadUnreleased: true,
  hideAds: true,
  canDeleteComment: true,
  canEditComment: true,
  canHideComment: true,
} as const;

export interface CreateScanInput {
  name: string;
  slug: string;
  isNSFW: boolean;
  ownerUserId: number;
}

export const searchUsers = async (q: string, limit: number) => {
  const safeLimit = Math.min(Math.max(limit || 10, 1), 20);
  const trimmed = (q ?? '').trim();
  if (!trimmed) return [];
  return prisma.user.findMany({
    where: {
      OR: [
        { slug: { contains: trimmed, mode: 'insensitive' } },
        { email: { contains: trimmed, mode: 'insensitive' } },
        { username: { contains: trimmed, mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: safeLimit,
    select: {
      id: true,
      slug: true,
      username: true,
      email: true,
      imageUrl: true,
    },
  });
};

export const createScan = async (input: CreateScanInput) => {
  const name = (input.name ?? '').trim();
  const slug = (input.slug ?? '').trim().toLowerCase();

  if (!name) throw new Error('Nombre inválido');
  if (!slug) throw new Error('Slug inválido');
  if (!SLUG_REGEX.test(slug)) throw new Error('Slug inválido');
  if (!Number.isInteger(input.ownerUserId)) {
    throw new Error('Usuario propietario no encontrado');
  }

  const conflict = await prisma.organization.findFirst({
    where: {
      OR: [
        { slug: { equals: slug, mode: 'insensitive' } },
        { domain: { equals: slug, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });
  if (conflict) throw new Error('Ya existe una organización con ese slug/dominio');

  const platformOwner = await prisma.user.findUnique({
    where: { email: PLATFORM_OWNER_EMAIL },
    select: { id: true },
  });
  if (!platformOwner) {
    throw new Error(
      `Usuario admin de la plataforma no encontrado (${PLATFORM_OWNER_EMAIL})`
    );
  }

  const ownerUser = await prisma.user.findUnique({
    where: { id: input.ownerUserId },
    select: { id: true },
  });
  if (!ownerUser) throw new Error('Usuario propietario no encontrado');

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name,
        title: name,
        slug,
        domain: slug,
        description: 'Subimos lo mejor de lo mejor',
        imageUrl: '',
        googleAdsMetaContent: null,
        googleAdsAdsTxtContent: '',
        bannerUrl: '',
        discordUrl: '',
        facebookUrl: '',
        instagramUrl: '',
        logoUrl: '',
        patreonUrl: '',
        tiktokUrl: '',
        twitchUrl: '',
        twitterUrl: '',
        youtubeUrl: '',
        enableGoogleAds: true,
        faviconUrl: '',
        enableMangaSection: true,
        enableManhuaSection: true,
        enableManhwaSection: false,
        language: 'es',
        monitorWebsiteId: null,
        useAllowedCountries: false,
        useBlockedCountries: false,
        adsterraAdSource: null,
        enableAdsterraAds: true,
        enableMainBanner: true,
        enableMainSlider: true,
        enableSubscriptionSection: true,
        discordWebhookUrlNewChapter: '',
        discordWebhookUrlNewSubscription: '',
        enableDiscordWebhookNewChapter: false,
        enableDiscordWebhookNewSubscription: false,
        discordWebhookMessageTemplateNewChapter: '',
        discordWebhookMessageTemplateNewSubscription: '',
        isPublic: true,
        isNSFW: input.isNSFW,
        enableAds: true,
        isDeleted: false,
      },
      select: { id: true, slug: true, name: true },
    });

    await tx.permission.create({
      data: {
        userId: platformOwner.id,
        organizationId: org.id,
        role: 'owner',
        hierarchyLevel: 100,
        ...FULL_PERMISSION_FLAGS,
      },
    });

    if (ownerUser.id !== platformOwner.id) {
      await tx.permission.create({
        data: {
          userId: ownerUser.id,
          organizationId: org.id,
          role: 'owner',
          hierarchyLevel: 100,
          ...FULL_PERMISSION_FLAGS,
        },
      });
    }

    return org;
  });
};
