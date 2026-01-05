import type { Prisma } from "@prisma/client";
import { prisma } from "../../models/prisma";
import { type UserListQuery, OrderEnum } from "../../types/user/list";

export const listUser = async (organizationId: number, filters: UserListQuery) => {
	const orders: Record<OrderEnum, Prisma.UserOrderByWithRelationInput> = {
		[OrderEnum.USERNAME_ASC]: {
			username: 'asc',
		},
		[OrderEnum.USERNAME_DESC]: {
			username: 'desc',
		},
		[OrderEnum.CREATED_AT_ASC]: {
			createdAt: 'asc',
		},
		[OrderEnum.CREATED_AT_DESC]: {
			createdAt: 'desc',
		},
	};
	const where: Prisma.UserWhereInput = {};
	if (filters?.email) {
		where.email = {
			contains: filters.email,
			mode: "insensitive",
		};
	}
	if (filters?.username) {
		where.username = {
			contains: filters.username,
			mode: "insensitive",
		};
	}
	if (filters?.subscriptionPlanIds) {
		where.subscriptions = {
			some: {
				subscriptionPlanId: {
					in: filters.subscriptionPlanIds,
				},
			},
		};
	}
	// Obtener IDs de usuarios que tienen permisos para esta organización
	const permissions = await prisma.permission.findMany({
		where: {
			organizationId,
		},
		select: {
			userId: true,
		},
	});
	
	const userIds = permissions.map(p => p.userId);
	
	if (userIds.length === 0) {
		return {
			data: [],
			maxPage: 0,
			total: 0,
		};
	}
	
	// Agregar filtro de userIds
	const whereWithOrganization: Prisma.UserWhereInput = {
		...where,
		id: {
			in: userIds,
		},
	};
	
	let users = await prisma.user.findMany({
		where: whereWithOrganization,
		include: {
			subscriptions: {
				where: {
					organizationId,
					subscriptionPlan: {
						organizationId,
					},
				},
				select: {
					id: true,
					subscriptionPlanId: true,
					active: true,
					createdAt: true,
					updatedAt: true,
					endDate: true,
					lastPayment: true,
					nextPayment: true,
					paypalSubscriptionId: true,
					startDate: true,
					status: true,
					subscriptionPlan: true,
				}
			},
		},
		orderBy: (filters?.order && orders[filters.order]) || undefined,
		skip: filters?.page ? (Number.parseInt(filters?.page || "1") - 1) * Number.parseInt(filters?.limit || "10") : 0,
		take: Number.parseInt(filters?.limit || "10"),
	});

	// Obtener permisos para cada usuario y agregarlos al objeto
	const usersWithPermissions = await Promise.all(
		users.map(async (user) => {
			user.password = "********";
			const permission = await prisma.permission.findUnique({
				where: {
					userId_organizationId: {
						userId: user.id,
						organizationId,
					},
				},
			});
			
			if (permission) {
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
			}
			
			return user;
		})
	);

	const total = await prisma.user.count({
		where: whereWithOrganization,
	});

	return {
		data: usersWithPermissions,
		maxPage: Math.ceil(total / Number.parseInt(filters?.limit || "10")),
		total,
	};
};
