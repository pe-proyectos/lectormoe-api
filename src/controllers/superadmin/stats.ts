import { prisma } from '../../models/prisma';

export const getGlobalStats = async () => {
	const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

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
		prisma.comment.count({ where: { hiddenAt: null } }),
		prisma.subscription.count({ where: { active: true } }),
		prisma.organizationTransaction.aggregate({
			where: { status: 'COMPLETED', type: 'EARNING' },
			_sum: { amount: true, capibaraFee: true },
		}),
		prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
		prisma.organization.count({ where: { isDeleted: false, createdAt: { gte: startOfMonth } } }),
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
			logoUrl: true,
			createdAt: true,
			_count: {
				select: {
					followers: true,
					mangaCustoms: true,
				},
			},
		},
		orderBy: { createdAt: 'desc' },
	});

	// Separate queries to avoid guessing relation names
	const [revenueByOrg, subsByOrg] = await Promise.all([
		prisma.organizationTransaction.groupBy({
			by: ['organizationId'],
			where: { status: 'COMPLETED', type: 'EARNING' },
			_sum: { amount: true, capibaraFee: true, paypalFee: true },
		}),
		prisma.subscription.groupBy({
			by: ['organizationId'],
			where: { active: true },
			_count: { id: true },
		}),
	]);

	const revenueMap = new Map(
		revenueByOrg.map((r) => [
			r.organizationId,
			{
				revenue: r._sum.amount ?? 0,
				capibaraFees: r._sum.capibaraFee ?? 0,
				paypalFees: r._sum.paypalFee ?? 0,
			},
		])
	);
	const subsMap = new Map(subsByOrg.map((s) => [s.organizationId, s._count.id]));

	const results = await Promise.all(
		orgs.map(async (org) => {
			const chapterCount = await prisma.chapter.count({
				where: {
					mangaCustom: { organizationId: org.id, deletedAt: null },
					deletedAt: null,
				},
			});
			const rev = revenueMap.get(org.id) ?? { revenue: 0, capibaraFees: 0, paypalFees: 0 };
			const saldo = rev.revenue - rev.capibaraFees - rev.paypalFees;
			return {
				id: org.id,
				name: org.name,
				slug: org.slug,
				logoUrl: org.logoUrl,
				createdAt: org.createdAt,
				mangaCount: org._count.mangaCustoms,
				chapterCount,
				subscriptionCount: subsMap.get(org.id) ?? 0,
				followerCount: org._count.followers,
				totalRevenue: rev.revenue,
				capibaraFees: rev.capibaraFees,
				paypalFees: rev.paypalFees,
				saldo,
			};
		})
	);

	return results;
};
