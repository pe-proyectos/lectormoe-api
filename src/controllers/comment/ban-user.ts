import { prisma } from "../../models/prisma";
import { BanType } from "../../prisma-generated/enums";

export interface BanUserParams {
	targetUserId: number;
	organizationId: number;
	bannedByUserId: number;
	type: BanType;
	reason?: string;
	expiresAt?: Date;
	deleteComments: boolean;
	onlyLast24h: boolean;
}

export const banUser = async (params: BanUserParams) => {
	const {
		targetUserId,
		organizationId,
		bannedByUserId,
		type,
		reason,
		expiresAt,
		deleteComments,
		onlyLast24h,
	} = params;

	if (targetUserId === bannedByUserId) {
		throw new Error("No puedes banearte a ti mismo.");
	}

	// Revoke any existing active ban first
	await prisma.userBan.updateMany({
		where: {
			userId: targetUserId,
			organizationId,
			revokedAt: null,
		},
		data: { revokedAt: new Date() },
	});

	const ban = await prisma.userBan.create({
		data: {
			userId: targetUserId,
			organizationId,
			bannedByUserId,
			type,
			reason: reason || null,
			expiresAt: type === BanType.TEMPORARY ? expiresAt : null,
		},
		include: {
			user: { select: { id: true, username: true } },
			bannedByUser: { select: { id: true, username: true } },
		},
	});

	if (deleteComments) {
		const cutoff = onlyLast24h
			? new Date(Date.now() - 24 * 60 * 60 * 1000)
			: null;

		await prisma.comment.updateMany({
			where: {
				userId: targetUserId,
				organizationId,
				deletedAt: null,
				...(cutoff ? { createdAt: { gte: cutoff } } : {}),
			},
			data: { deletedAt: new Date() },
		});
	}

	return ban;
};

export const unbanUser = async (banId: number, organizationId: number) => {
	const ban = await prisma.userBan.findFirst({
		where: { id: banId, organizationId, revokedAt: null },
	});

	if (!ban) {
		throw new Error("Ban no encontrado o ya revocado.");
	}

	return prisma.userBan.update({
		where: { id: banId },
		data: { revokedAt: new Date() },
	});
};

export const listBans = async (organizationId: number) => {
	return prisma.userBan.findMany({
		where: { organizationId, revokedAt: null },
		include: {
			user: { select: { id: true, username: true, imageUrl: true } },
			bannedByUser: { select: { id: true, username: true } },
		},
		orderBy: { createdAt: "desc" },
	});
};

export const getActiveBan = async (userId: number, organizationId: number) => {
	const ban = await prisma.userBan.findFirst({
		where: {
			userId,
			organizationId,
			revokedAt: null,
			OR: [
				{ expiresAt: null },
				{ expiresAt: { gt: new Date() } },
			],
		},
	});
	return ban;
};
