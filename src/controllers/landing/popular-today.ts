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

	// Push NSFW + soft-delete filters into the groupBy itself so the candidate
	// pool only contains mangas that will survive the later filter — otherwise
	// /red can return fewer than `limit` rows when most of today's top views
	// happen to be SFW (or vice versa).
	const mangaCustomFilter: any = { deletedAt: null };
	if (nsfw === true) {
		mangaCustomFilter.OR = [{ isNSFW: true }, { organization: { isNSFW: true } }];
	} else if (nsfw === false) {
		mangaCustomFilter.isNSFW = false;
		mangaCustomFilter.organization = { isNSFW: false };
	}

	// Pull a generous candidate pool. We can't directly group by manga.id at
	// the SQL level (mangaId lives on MangaCustom, not ViewsHistory), so we
	// over-fetch by mangaCustomId and dedupe in memory below.
	const grouped = await prisma.viewsHistory.groupBy({
		by: ['mangaCustomId'],
		where: {
			mangaCustomId: { not: null },
			viewedAt: { gte: todayStart },
			mangaCustom: mangaCustomFilter,
		},
		_count: { _all: true },
		orderBy: { _count: { mangaCustomId: Prisma.SortOrder.desc } },
		take: limit * 10,
	});

	if (grouped.length === 0) return [];

	const ids = grouped.map((g) => g.mangaCustomId!).filter((x) => x !== null);

	const mangasCustoms = await prisma.mangaCustom.findMany({
		where: {
			id: { in: ids },
			deletedAt: null,
			OR: [{ imageUrl: { not: null } }, { manga: { imageUrl: { not: null } } }],
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

	const countsByCustomId = new Map<number, number>();
	for (const g of grouped) {
		if (g.mangaCustomId !== null) countsByCustomId.set(g.mangaCustomId, g._count._all);
	}

	// Dedupe by underlying Manga: when several scans publish the same manga,
	// sum their view counts (so popularity reflects total interest) and keep
	// the MangaCustom with the highest individual count as the representative
	// (so the user lands on whichever scan is currently driving the views).
	const byMangaId = new Map<number, { mc: typeof mangasCustoms[number]; total: number; topCount: number }>();
	for (const mc of mangasCustoms) {
		const cover = mc.imageUrl || mc.manga.imageUrl;
		if (!cover || cover.trim() === '') continue;
		const count = countsByCustomId.get(mc.id) ?? 0;
		const existing = byMangaId.get(mc.manga.id);
		if (!existing) {
			byMangaId.set(mc.manga.id, { mc, total: count, topCount: count });
		} else {
			existing.total += count;
			if (count > existing.topCount) {
				existing.topCount = count;
				existing.mc = mc;
			}
		}
	}

	const ranked = [...byMangaId.values()]
		.sort((a, b) => b.total - a.total)
		.slice(0, limit)
		.map((entry) => entry.mc);

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
