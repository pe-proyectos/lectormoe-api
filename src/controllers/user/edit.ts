import { prisma } from "../../models/prisma";
import type { EditUserRequest } from "../../types/user/edit";

export const editUser = async (
  organizationId: number | null,
  userId: number,
  params: EditUserRequest
) => {
  // Si organizationId es null, encontrar una organización por defecto o usar la primera disponible
  let finalOrganizationId = organizationId;
  if (!finalOrganizationId) {
    const defaultOrg = await prisma.organization.findFirst({
      where: { isPublic: true, isDeleted: false },
    });
    if (defaultOrg) {
      finalOrganizationId = defaultOrg.id;
    } else {
      throw new Error("No se pudo determinar la organización para la edición.");
    }
  }

  // Verificar que el usuario tenga permisos para esta organización
  const permission = await prisma.permission.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: finalOrganizationId,
      },
    },
  });

  if (!permission) {
    // Si no tiene permisos, crear uno básico para permitir la edición del perfil
    await prisma.permission.create({
      data: {
        userId,
        organizationId: finalOrganizationId,
        role: 'user',
        hierarchyLevel: 0,
      },
    });
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Actualizar campos del usuario (solo los que no son permisos)
  const userUpdateData: any = {};
  
  if (params.description !== undefined) {
    userUpdateData.description = params.description;
  }
  
  if (params.birthdate !== undefined) {
    userUpdateData.birthdate = params.birthdate;
  }
  
  // Settings fields
  if (params.emailVerified !== undefined) {
    userUpdateData.emailVerified = params.emailVerified;
  }
  
  if (params.isPublicProfile !== undefined) {
    userUpdateData.isPublicProfile = params.isPublicProfile;
  }
  
  if (params.isPrivateHistory !== undefined) {
    userUpdateData.isPrivateHistory = params.isPrivateHistory;
  }
  
  if (params.emailNotifications !== undefined) {
    userUpdateData.emailNotifications = params.emailNotifications;
  }
  
  if (params.pushNotifications !== undefined) {
    userUpdateData.pushNotifications = params.pushNotifications;
  }

  if (params.notifyCommentsOnOwnedContent !== undefined) {
    userUpdateData.notifyCommentsOnOwnedContent = params.notifyCommentsOnOwnedContent;
  }
  
  if (params.theme !== undefined) {
    userUpdateData.theme = params.theme;
  }
  
  if (params.username !== undefined && params.username !== user.username) {
    // Check if username is already taken
    const existingUser = await prisma.user.findFirst({
      where: {
        username: params.username,
        NOT: { id: userId },
      },
    });
    
    if (existingUser) {
      throw new Error('El nombre de usuario ya está en uso.');
    }
    
    // Check if username was changed recently (within 6 days)
    if (user.usernameChangedAt) {
      const daysSinceLastChange = (Date.now() - user.usernameChangedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastChange < 6) {
        const daysRemaining = Math.ceil(6 - daysSinceLastChange);
        throw new Error(`No puedes cambiar tu nombre de usuario. Debes esperar ${daysRemaining} día(s) más.`);
      }
    }
    
    userUpdateData.username = params.username;
    userUpdateData.usernameChangedAt = new Date();
  }
  
  if (Object.keys(userUpdateData).length > 0) {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: userUpdateData,
    });
  }

  // Actualizar o crear permisos en la tabla Permission (upsert para manejar usuarios sin permisos previos)
  await prisma.permission.upsert({
    where: {
      userId_organizationId: {
        userId,
        organizationId: finalOrganizationId,
      },
    },
    update: {
      role: params.role,
      hierarchyLevel: params.hierarchyLevel,
      canSeeAdminPanel: params.canSeeAdminPanel,
      canEditOrganization: params.canEditOrganization,
      canDeleteOrganization: params.canDeleteOrganization,
      canEditUser: params.canEditUser,
      canDeleteUser: params.canDeleteUser,
      canCreateAuthor: params.canCreateAuthor,
      canCreateMangaProfile: params.canCreateMangaProfile,
      canCreateMangaCustom: params.canCreateMangaCustom,
      canEditMangaCustom: params.canEditMangaCustom,
      canDeleteMangaCustom: params.canDeleteMangaCustom,
      canCreateGenre: params.canCreateGenre,
      canEditGenre: params.canEditGenre,
      canDeleteGenre: params.canDeleteGenre,
      canCreateChapter: params.canCreateChapter,
      canEditChapter: params.canEditChapter,
      canDeleteChapter: params.canDeleteChapter,
      canCreatePage: params.canCreatePage,
      canEditPage: params.canEditPage,
      canDeletePage: params.canDeletePage,
      canCreateSubscriptionPlan: params.canCreateSubscriptionPlan,
      canEditSubscriptionPlan: params.canEditSubscriptionPlan,
      canDeleteSubscriptionPlan: params.canDeleteSubscriptionPlan,
      canDeleteComment: params.canDeleteComment,
      canEditComment: params.canEditComment,
      canHideComment: params.canHideComment,
      hideAds: params.hideAds,
      canDownload: params.canDownload,
      canReadUnreleased: params.canReadUnreleased,
    },
    create: {
      userId,
      organizationId: finalOrganizationId,
      role: params.role || "user",
      hierarchyLevel: params.hierarchyLevel || 0,
      canSeeAdminPanel: params.canSeeAdminPanel || false,
      canEditOrganization: params.canEditOrganization || false,
      canDeleteOrganization: params.canDeleteOrganization || false,
      canEditUser: params.canEditUser || false,
      canDeleteUser: params.canDeleteUser || false,
      canCreateAuthor: params.canCreateAuthor || false,
      canCreateMangaProfile: params.canCreateMangaProfile || false,
      canCreateMangaCustom: params.canCreateMangaCustom || false,
      canEditMangaCustom: params.canEditMangaCustom || false,
      canDeleteMangaCustom: params.canDeleteMangaCustom || false,
      canCreateGenre: params.canCreateGenre || false,
      canEditGenre: params.canEditGenre || false,
      canDeleteGenre: params.canDeleteGenre || false,
      canCreateChapter: params.canCreateChapter || false,
      canEditChapter: params.canEditChapter || false,
      canDeleteChapter: params.canDeleteChapter || false,
      canCreatePage: params.canCreatePage || false,
      canEditPage: params.canEditPage || false,
      canDeletePage: params.canDeletePage || false,
      canCreateSubscriptionPlan: params.canCreateSubscriptionPlan || false,
      canEditSubscriptionPlan: params.canEditSubscriptionPlan || false,
      canDeleteSubscriptionPlan: params.canDeleteSubscriptionPlan || false,
      canDeleteComment: params.canDeleteComment || false,
      canEditComment: params.canEditComment || false,
      canHideComment: params.canHideComment || false,
      hideAds: params.hideAds || false,
      canDownload: params.canDownload || false,
      canReadUnreleased: params.canReadUnreleased || false,
    },
  });

  // Handle avatar image
  if (params.image !== undefined) {
    const r2PublicUrl = Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com';
    let newImageUrl: string | null = null;

    if (params.image !== null && typeof params.image === 'string') {
      newImageUrl = params.image.startsWith('http') 
        ? params.image 
        : `${r2PublicUrl}/${params.image}`;
    }

    // Solo verificar tiempo de cambio si está cambiando la URL
    if (newImageUrl !== user.imageUrl) {
      // Check if imageUrl was changed recently (within 2 days)
      if (user.imageUrlChangedAt) {
        const daysSinceLastChange = (Date.now() - user.imageUrlChangedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastChange < 2) {
          const daysRemaining = Math.ceil(2 - daysSinceLastChange);
          throw new Error(`No puedes cambiar tu foto de perfil. Debes esperar ${daysRemaining} día(s) más.`);
        }
      }

      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          imageUrl: newImageUrl,
          imageUrlChangedAt: new Date(),
        },
      });
    }
  }

  // Handle banner image
  if (params.banner !== undefined) {
    const r2PublicUrl = Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com';
    let newBannerUrl: string | null = null;

    if (params.banner !== null && typeof params.banner === 'string') {
      newBannerUrl = params.banner.startsWith('http') 
        ? params.banner 
        : `${r2PublicUrl}/${params.banner}`;
    }

    // Solo verificar tiempo de cambio si está cambiando la URL
    if (newBannerUrl !== user.bannerUrl) {
      // Check if bannerUrl was changed recently (within 2 days)
      if (user.bannerUrlChangedAt) {
        const daysSinceLastChange = (Date.now() - user.bannerUrlChangedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastChange < 2) {
          const daysRemaining = Math.ceil(2 - daysSinceLastChange);
          throw new Error(`No puedes cambiar tu banner. Debes esperar ${daysRemaining} día(s) más.`);
        }
      }

      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          bannerUrl: newBannerUrl,
          bannerUrlChangedAt: new Date(),
        },
      });
    }
  }

  const updatedUser = await prisma.user.findUnique({ 
    where: { id: user.id },
    include: {
      subscriptions: {
        where: {
          active: true,
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
              price: true,
              organizationId: true,
              hideAds: true,
              canDownload: true,
              canReadUnreleased: true,
              active: true,
            },
          },
        },
      },
    },
  });
  
  if (updatedUser) {
    updatedUser.password = "********";
    // Agregar permisos al objeto user
    const updatedPermission = await prisma.permission.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: finalOrganizationId,
        },
      },
    });
    
    if (updatedPermission) {
      (updatedUser as any).permissions = {
        canCreateAuthor: updatedPermission.canCreateAuthor,
        canCreateChapter: updatedPermission.canCreateChapter,
        canCreateGenre: updatedPermission.canCreateGenre,
        canCreateMangaCustom: updatedPermission.canCreateMangaCustom,
        canCreateMangaProfile: updatedPermission.canCreateMangaProfile,
        canCreatePage: updatedPermission.canCreatePage,
        canDeleteChapter: updatedPermission.canDeleteChapter,
        canDeleteGenre: updatedPermission.canDeleteGenre,
        canDeleteMangaCustom: updatedPermission.canDeleteMangaCustom,
        canDeleteOrganization: updatedPermission.canDeleteOrganization,
        canDeletePage: updatedPermission.canDeletePage,
        canEditChapter: updatedPermission.canEditChapter,
        canEditGenre: updatedPermission.canEditGenre,
        canEditMangaCustom: updatedPermission.canEditMangaCustom,
        canEditOrganization: updatedPermission.canEditOrganization,
        canEditPage: updatedPermission.canEditPage,
        canSeeAdminPanel: updatedPermission.canSeeAdminPanel,
        canDeleteUser: updatedPermission.canDeleteUser,
        canEditUser: updatedPermission.canEditUser,
        canCreateSubscriptionPlan: updatedPermission.canCreateSubscriptionPlan,
        canDeleteSubscriptionPlan: updatedPermission.canDeleteSubscriptionPlan,
        canEditSubscriptionPlan: updatedPermission.canEditSubscriptionPlan,
        canDownload: updatedPermission.canDownload,
        canReadUnreleased: updatedPermission.canReadUnreleased,
        canDeleteComment: updatedPermission.canDeleteComment,
        canEditComment: updatedPermission.canEditComment,
        canHideComment: updatedPermission.canHideComment,
        role: updatedPermission.role,
        hierarchyLevel: updatedPermission.hierarchyLevel,
        hideAds: updatedPermission.hideAds,
      };
    }
  }
  
  return updatedUser;
};
