import { prisma, Prisma } from "../../models/prisma";

// Same color palette / hash as featured-manga so badges look consistent.
const getBadgeColor = (orgName: string): string => {
	let hash = 0;
	for (let i = 0; i < orgName.length; i++) {
		hash = orgName.charCodeAt(i) + ((hash << 5) - hash);
	}
	const colors = [
		'bg-purple-600',
		'bg-blue-600',
		'bg-red-600',
		'bg-green-600',
		'bg-yellow-600',
		'bg-pink-600',
		'bg-indigo-600',
		'bg-orange-600',
	];
	return colors[Math.abs(hash) % colors.length];
};

export const getPopularToday = async (limit: number = 5, nsfw?: boolean) => {
	// "Today" anchored at 00:00 server-local — matches the convention used by
	// analytics/get.ts and analytics/engagement-statistics.ts.
	const todayStart = new Date();
	todayStart.setHours(0, 0, 0, 0);

	// Count ViewsHistory rows per mangaCustomId since 00:00.
	// Cap the candidate pool to limit*4 so the post-filter (covers, NSFW) still
	// has room to fall back without extra queries.
	const grouped = await prisma.viewsHistory.groupBy({
		by: ['mangaCustomId'],
		where: {
			mangaCustomId: { not: null },
			viewedAt: { gte: todayStart },
		},
		_count: { _all: true },
		orderBy: { _count: { mangaCustomId: Prisma.SortOrder.desc } },
		take: limit * 4,
	});

	if (grouped.length === 0) return [];

	const ids = grouped.map((g) => g.mangaCustomId!).filter((x) => x !== null);

	const nsfwCondition: object[] = nsfw === true
		? [{ OR: [{ isNSFW: true }, { organization: { isNSFW: true } }] }]
		: nsfw === false
		? [{ isNSFW: false }, { organization: { isNSFW: false } }]
		: [];

	const mangasCustoms = await prisma.mangaCustom.findMany({
		where: {
			id: { in: ids },
			deletedAt: null,
			AND: [
				...nsfwCondition,
				{ OR: [{ imageUrl: { not: null } }, { manga: { imageUrl: { not: null } } }] },
			],
		},
		include: {
			manga: { select: { id: true, title: true, slug: true, imageUrl: true } },
			organization: { select: { id: true, name: true, domain: true, slug: true, isNSFW: true } },
			chapters: {
				where: { deletedAt: null },
				select: { id: true, number: true, title: true, releasedAt: true },
				orderBy: { number: Prisma.SortOrder.desc },
				take: 2,
			},
		},
	});

	// Re-sort by today's view count (the findMany above doesn't preserve order
	// because we filtered by id IN (...)).
	const countsById = new Map<number, number>();
	for (const g of grouped) {
		if (g.mangaCustomId !== null) countsById.set(g.mangaCustomId, g._count._all);
	}

	const ranked = mangasCustoms
		.filter((mc) => {
			const cover = mc.imageUrl || mc.manga.imageUrl;
			return cover && cover.trim() !== '';
		})
		.sort((a, b) => (countsById.get(b.id) ?? 0) - (countsById.get(a.id) ?? 0))
		.slice(0, limit);

	return ranked.map((mangaCustom) => {
		const organization = mangaCustom.organization;
		const manga = mangaCustom.manga;
		const coverUrl = mangaCustom.imageUrl || manga.imageUrl || '';
		const lastChapters = mangaCustom.chapters.map((chapter) => ({
			id: chapter.id,
			number: chapter.number,
			title: chapter.title,
			releasedAt: chapter.releasedAt,
			chapterUrl: `/${organization.slug}/manga/${manga.slug}/chapters/${chapter.number}`,
		}));
		return {
			id: mangaCustom.id.toString(),
			title: mangaCustom.title || manga.title,
			cover: coverUrl,
			scanName: organization.name,
			scanSlug: organization.slug,
			scanUrl: `/${organization.slug}`,
			mangaSlug: manga.slug,
			mangaUrl: `/${organization.slug}/manga/${manga.slug}`,
			badgeColor: getBadgeColor(organization.name),
			chapters: lastChapters,
			organizationId: organization.id,
			isNSFW: mangaCustom.isNSFW || organization.isNSFW,
		};
	});
};
