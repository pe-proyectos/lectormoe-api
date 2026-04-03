import { prisma } from '../../models/prisma';

export const getGlobalStats = async () => {
	const [
		totalUsers,
		totalOrgs,
		totalMangas,
		totalChapters,
		totalComments,
		totalSubscriptions,
		totalRevenue,
		newUsersThisMonth,
		newOrgsThisMonth,
	] = await Promise.all([
		prisma.user.count(),
		prisma.organization.count({ where: { isDeleted: false } }),
		prisma.mangaCustom.count({ where: { deletedAt: null } }),
		prisma.chapter.count({ where: { deletedAt: null } }),
		prisma.comment.count({ where: { hidden: false } }),
		prisma.subscription.count({ where: { active: true } }),
		prisma.organizationTransaction.aggregate({
			where: { status: 'COMPLETED', type: 'EARNING' },
			_sum: { amount: true, capibaraFee: true },
		}),
		prisma.user.count({
			where: {
				createdAt: {
					gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
				},
			},
		}),
		prisma.organization.count({
			where: {
				isDeleted: false,
				createdAt: {
					gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
				},
			},
		}),
	]);

	return {
		totalUsers,
		totalOrgs,
		totalMangas,
		totalChapters,
		totalComments,
		totalSubscriptions,
		totalRevenue: totalRevenue._sum.amount ?? 0,
		totalCapibaraFees: totalRevenue._sum.capibaraFee ?? 0,
		newUsersThisMonth,
		newOrgsThisMonth,
	};
};

export const getOrgStats = async () => {
	const orgs = await prisma.organization.findMany({
		where: { isDeleted: false },
		select: {
			id: true,
			name: true,
			slug: true,
			imageUrl: true,
			createdAt: true,
			_count: {
				select: {
					followers: true,
					mangaCustoms: true,
					subscriptions: true,
				},
			},
			transactions: {
				where: { status: 'COMPLETED', type: 'EARNING' },
				select: { amount: true, capibaraFee: true },
			},
		},
		orderBy: { createdAt: 'desc' },
	});

	return await Promise.all(
		orgs.map(async (org) => {
			const chapterCount = await prisma.chapter.count({
				where: {
					mangaCustom: { organizationId: org.id, deletedAt: null },
					deletedAt: null,
				},
			});

			const totalRevenue = org.transactions.reduce((s, t) => s + t.amount, 0);
			const capibaraFees = org.transactions.reduce((s, t) => s + (t.capibaraFee ?? 0), 0);

			return {
				id: org.id,
				name: org.name,
				slug: org.slug,
				imageUrl: org.imageUrl,
				createdAt: org.createdAt,
				mangaCount: org._count.mangaCustoms,
				chapterCount,
				subscriptionCount: org._count.subscriptions,
				followerCount: org._count.followers,
				totalRevenue,
				capibaraFees,
			};
		})
	);
};
