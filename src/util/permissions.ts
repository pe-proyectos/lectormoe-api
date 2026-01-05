/**
 * Utilidades para trabajar con el nuevo modelo de permisos
 * 
 * Estos helpers facilitan la obtención de permisos de un usuario
 * para una organización específica.
 */

import { prisma } from "../models/prisma";

export interface UserPermissions {
  canCreateAuthor: boolean;
  canCreateChapter: boolean;
  canCreateGenre: boolean;
  canCreateMangaCustom: boolean;
  canCreateMangaProfile: boolean;
  canCreatePage: boolean;
  canDeleteChapter: boolean;
  canDeleteGenre: boolean;
  canDeleteMangaCustom: boolean;
  canDeleteOrganization: boolean;
  canDeletePage: boolean;
  canEditChapter: boolean;
  canEditGenre: boolean;
  canEditMangaCustom: boolean;
  canEditOrganization: boolean;
  canEditPage: boolean;
  canSeeAdminPanel: boolean;
  canDeleteUser: boolean;
  canEditUser: boolean;
  canCreateSubscriptionPlan: boolean;
  canDeleteSubscriptionPlan: boolean;
  canEditSubscriptionPlan: boolean;
  canDownload: boolean;
  canReadUnreleased: boolean;
  canDeleteComment: boolean;
  canEditComment: boolean;
  canHideComment: boolean;
  role: string;
  hierarchyLevel: number;
}

/**
 * Obtiene los permisos de un usuario para una organización específica
 */
export async function getUserPermissions(
  userId: number,
  organizationId: number
): Promise<UserPermissions | null> {
  const permission = await prisma.permission.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  if (!permission) {
    return null;
  }

  return {
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
  };
}

/**
 * Verifica si un usuario tiene un permiso específico para una organización
 */
export async function hasPermission(
  userId: number,
  organizationId: number,
  permissionName: keyof Omit<UserPermissions, "role" | "hierarchyLevel">
): Promise<boolean> {
  const permissions = await getUserPermissions(userId, organizationId);
  if (!permissions) {
    return false;
  }
  return permissions[permissionName] === true;
}

/**
 * Obtiene todas las organizaciones a las que pertenece un usuario
 */
export async function getUserOrganizations(userId: number) {
  const permissions = await prisma.permission.findMany({
    where: {
      userId,
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          domain: true,
          description: true,
          imageUrl: true,
        },
      },
    },
  });

  return permissions.map((p) => p.organization);
}

/**
 * Obtiene el role de un usuario para una organización específica
 */
export async function getUserRole(
  userId: number,
  organizationId: number
): Promise<string | null> {
  const permission = await prisma.permission.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    select: {
      role: true,
    },
  });

  return permission?.role || null;
}

/**
 * Obtiene el hierarchyLevel de un usuario para una organización específica
 */
export async function getUserHierarchyLevel(
  userId: number,
  organizationId: number
): Promise<number | null> {
  const permission = await prisma.permission.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    select: {
      hierarchyLevel: true,
    },
  });

  return permission?.hierarchyLevel ?? null;
}

