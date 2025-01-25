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
	let users = await prisma.user.findMany({
		where: {
			...where,
			organizationId,
		},
		include: {
			subscriptions: {
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

	users = users.map(user => {
		user.password = "********";
		return user;
	});

	const total = await prisma.user.count({
		where: {
			...where,
			organizationId,
		},
	});

	return {
		data: users,
		maxPage: Math.ceil(total / Number.parseInt(filters?.limit || "10")),
		total,
	};
};
