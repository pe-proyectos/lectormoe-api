import type { Prisma } from "@prisma/client";
import { prisma } from "../../models/prisma";
import { type MemberListQuery, OrderEnum } from "../../types/member/list";

export const listMember = async (organizationId: number, filters: MemberListQuery) => {
	const orders: Record<OrderEnum, Prisma.MemberOrderByWithRelationInput> = {
		[OrderEnum.USERNAME_ASC]: {
			user: {
				username: 'asc',
			},
		},
		[OrderEnum.USERNAME_DESC]: {
			user: {
				username: 'desc',
			},
		},
		[OrderEnum.CREATED_AT_ASC]: {
			user: {
				createdAt: 'asc',
			},
		},
		[OrderEnum.CREATED_AT_DESC]: {
			user: {
				createdAt: 'desc',
			},
		},
		[OrderEnum.COINS_ASC]: {
			coins: 'asc',
		},
		[OrderEnum.COINS_DESC]: {
			coins: 'desc',
		},
	};
	const where: Prisma.MemberWhereInput = {};
	if (filters?.email) {
		where.user = {
			email: {
				contains: filters.email,
				mode: "insensitive",
			},
		};
	}
	if (filters?.username) {
		where.user = {
			username: {
				contains: filters.username,
				mode: "insensitive",
			},
		};
	}
	const members = await prisma.member.findMany({
		where: {
			...where,
			organizationId,
		},
		select: {
			id: true,
			role: true,
			coins: true,
			coinPackHistory: {
				select: {
					boughtAt: true,
					coinPackName: true,
					coinPackSlug: true,
					paymentMethod: true,
					coinPackPrice: true,
					coinPackCoins: true,
					coinPackDescription: true,
					coinPackPriceWithoutDiscount: true,
				}
			},
			user: {
				select: {
					id: true,
					slug: true,
					email: true,
					username: true,
					createdAt: true,
				}
			}
		},
		orderBy: (filters?.order && orders[filters.order]) || undefined,
		skip: filters?.page ? (Number.parseInt(filters?.page || "1") - 1) * Number.parseInt(filters?.limit || "10") : 0,
		take: Number.parseInt(filters?.limit || "10"),
	});

	const total = await prisma.member.count({
		where: {
			...where,
			organizationId,
		},
	});

	return {
		data: members,
		maxPage: Math.ceil(total / Number.parseInt(filters?.limit || "10")),
		total,
	};
};
