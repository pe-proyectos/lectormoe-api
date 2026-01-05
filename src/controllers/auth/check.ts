import { prisma } from "../../models/prisma";

export const checkToken = async (organizationId: number | null, token: string) => {
    // Primero encontrar el usuario por token (sin filtrar por organización)
    const includeSubscriptions = organizationId !== null ? {
        subscriptions: {
            where: {
                active: true,
                organizationId,
            },
            select: {
                id: true,
                startDate: true,
                lastPayment: true,
                nextPayment: true,
                subscriptionPlan: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        interval: true,
                        currency: true,
                        hideAds: true,
                        canDownload: true,
                        canReadUnreleased: true,
                        active: true,
                    },
                },
            },
        },
    } : {};

    const user = await prisma.user.findFirst({
        where: {
            tokens: {
                some: {
                    token,
                }
            }
        },
        include: includeSubscriptions,
    });

    if (!user) {
        return null;
    }

    // Si se proporciona organizationId, verificar que el usuario tenga permisos para esta organización
    if (organizationId !== null) {
        const permission = await prisma.permission.findUnique({
            where: {
                userId_organizationId: {
                    userId: user.id,
                    organizationId,
                },
            },
        });

        if (!permission) {
            return null;
        }

        // Agregar permisos al objeto user para el frontend
        (user as any).permissions = {
            canCreateAuthor: permission.canCreateAuthor,
            canCreateChapter: permission.canCreateChapter,
            canCreateGenre: permission.canCreateGenre,
            canCreateMangaCustom: permission.canCreateMangaCustom,
            canCreateMangaProfile: permission.canCreateMangaProfile,
            canCreatePage: permission.canCreatePage,
            canDeleteChapter: permission.canDeleteChapter,
            canDeleteGenre: permission.canDeleteGenre,
            canDeleteMangaCustom: permission.canDeleteMangaCustom,
            canDeleteOrganization: permission.canDeleteOrganization,
            canDeletePage: permission.canDeletePage,
            canEditChapter: permission.canEditChapter,
            canEditGenre: permission.canEditGenre,
            canEditMangaCustom: permission.canEditMangaCustom,
            canEditOrganization: permission.canEditOrganization,
            canEditPage: permission.canEditPage,
            canSeeAdminPanel: permission.canSeeAdminPanel,
            canDeleteUser: permission.canDeleteUser,
            canEditUser: permission.canEditUser,
            canCreateSubscriptionPlan: permission.canCreateSubscriptionPlan,
            canDeleteSubscriptionPlan: permission.canDeleteSubscriptionPlan,
            canEditSubscriptionPlan: permission.canEditSubscriptionPlan,
            canDownload: permission.canDownload,
            canReadUnreleased: permission.canReadUnreleased,
            canDeleteComment: permission.canDeleteComment,
            canEditComment: permission.canEditComment,
            canHideComment: permission.canHideComment,
            role: permission.role,
            hierarchyLevel: permission.hierarchyLevel,
            hideAds: permission.hideAds,
        };
    } else {
        // Si no hay organizationId, no agregar permisos específicos
        (user as any).permissions = null;
        // Asegurar que subscriptions esté definido como array vacío
        if (!user.subscriptions) {
            (user as any).subscriptions = [];
        }
    }

    if (user) {
        user.password = "********";
        // Asegurar que subscriptions siempre esté definido
        if (!user.subscriptions) {
            (user as any).subscriptions = [];
        }
    }

    return user;
}

