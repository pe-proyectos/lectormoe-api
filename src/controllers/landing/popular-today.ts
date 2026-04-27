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

const WRITING_BOOK_TYPE_CODES = ["novel", "light-novel", "book", "short-story"];

type ContentKind = "manga" | "writing" | "all";

export const getPopularToday = async (limit: number = 5, nsfw?: boolean, contentKind: ContentKind = "all") => {
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
	if (contentKind === "writing") {
		mangaCustomFilter.manga = { ...(mangaCustomFilter.manga || {}), bookType: { code: { in: WRITING_BOOK_TYPE_CODES } } };
	} else if (contentKind === "manga") {
		mangaCustomFilter.manga = { ...(mangaCustomFilter.manga || {}), bookType: { code: { notIn: WRITING_BOOK_TYPE_CODES } } };
	}
	// Hide deactivated orgs (isPublic=false or isDeleted=true). AND-merged so
	// it composes correctly with the OR/organization keys above.
	mangaCustomFilter.AND = [{ organization: { isPublic: true, isDeleted: false } }];

	// Pull a generous candidate pool. We can't directly group by manga.id at
	// the SQL level (mangaId lives on MangaCustom, not ViewsHistory), so we
	// over-fetch by mangaCustomId and dedupe in memory below.
	const groupedManga = await prisma.viewsHistory.groupBy({
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

	// Joint views — joints have no isNSFW field, so they only contribute when
	// browsing the SFW landing (matches SortableMangaList convention).
	// Also skip joints entirely when filtering to writings: joints are only used
	// for collaborative manga uploads and have no bookType association.
	const groupedJoint = nsfw === true || contentKind === "writing"
		? []
		: await prisma.viewsHistory.groupBy({
			by: ['jointId'],
			where: {
				jointId: { not: null },
				chapterId: null, // count joint-page views only, not chapter-detail views
				viewedAt: { gte: todayStart },
				joint: { deletedAt: null },
			},
			_count: { _all: true },
			orderBy: { _count: { jointId: Prisma.SortOrder.desc } },
			take: limit * 10,
		});

	if (groupedManga.length === 0 && groupedJoint.length === 0) return [];

	const customIds = groupedManga.map((g) => g.mangaCustomId!).filter((x) => x !== null);
	const jointIds = groupedJoint.map((g) => g.jointId!).filter((x) => x !== null);

	const [mangasCustoms, joints] = await Promise.all([
		customIds.length === 0 ? Promise.resolve([] as any[]) : prisma.mangaCustom.findMany({
			where: {
				id: { in: customIds },
				deletedAt: null,
				OR: [{ imageUrl: { not: null } }, { manga: { imageUrl: { not: null } } }],
				...(contentKind === "writing"
					? { manga: { bookType: { code: { in: WRITING_BOOK_TYPE_CODES } } } }
					: contentKind === "manga"
					? { manga: { bookType: { code: { notIn: WRITING_BOOK_TYPE_CODES } } } }
					: {}),
				AND: [{ organization: { isPublic: true, isDeleted: false } }],
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
		}),
		jointIds.length === 0 ? Promise.resolve([] as any[]) : prisma.mangaJoint.findMany({
			where: { id: { in: jointIds }, deletedAt: null },
			include: {
				manga: { select: { id: true, title: true, slug: true, imageUrl: true } },
				chapters: {
					where: { deletedAt: null },
					select: { id: true, number: true, title: true, releasedAt: true },
					orderBy: { number: Prisma.SortOrder.desc },
					take: 2,
				},
			},
		}),
	]);

	const countsByCustomId = new Map<number, number>();
	for (const g of groupedManga) {
		if (g.mangaCustomId !== null) countsByCustomId.set(g.mangaCustomId, g._count._all);
	}
	const countsByJointId = new Map<number, number>();
	for (const g of groupedJoint) {
		if (g.jointId !== null) countsByJointId.set(g.jointId, g._count._all);
	}

	// Roll solo-chapter views from any ACCEPTED member's MangaCustom into the
	// matching joint's bucket. Without this, a manga that pre-dates the joint
	// looks artificially small in popular-today because its views are scattered
	// across the per-org MCs instead of attributed to the joint.
	if (joints.length > 0 && mangasCustoms.length > 0) {
		const acceptedMembers = await prisma.jointMember.findMany({
			where: {
				jointId: { in: joints.map(j => j.id) },
				status: 'ACCEPTED',
			},
			select: { jointId: true, organizationId: true, joint: { select: { mangaId: true } } },
		});
		const orgToJoint = new Map<string, number>();
		for (const m of acceptedMembers) {
			orgToJoint.set(`${m.joint.mangaId}:${m.organizationId}`, m.jointId);
		}
		for (const mc of mangasCustoms) {
			const jId = orgToJoint.get(`${mc.manga.id}:${mc.organizationId}`);
			if (!jId) continue;
			const mcCount = countsByCustomId.get(mc.id) ?? 0;
			if (mcCount === 0) continue;
			countsByJointId.set(jId, (countsByJointId.get(jId) ?? 0) + mcCount);
			// Zero the MC count so dedupe doesn't double-credit it as the bestMc.
			countsByCustomId.set(mc.id, 0);
		}
	}

	// Dedupe by underlying Manga.id: sum views across all mangaCustoms + the
	// joint that share the same manga, then choose a representative:
	//   - If a joint exists for this manga, prefer it (the manga page already
	//     redirects to /joint/manga/<slug>, so it is the canonical view).
	//   - Otherwise pick the MangaCustom with the highest individual count.
	type MC = typeof mangasCustoms[number];
	type J = typeof joints[number];
	type Entry = { mangaId: number; total: number; joint?: J; bestMc?: MC; bestMcCount: number };
	const byMangaId = new Map<number, Entry>();

	for (const mc of mangasCustoms) {
		const cover = mc.imageUrl || mc.manga.imageUrl;
		if (!cover || cover.trim() === '') continue;
		const count = countsByCustomId.get(mc.id) ?? 0;
		const existing = byMangaId.get(mc.manga.id);
		if (!existing) {
			byMangaId.set(mc.manga.id, { mangaId: mc.manga.id, total: count, bestMc: mc, bestMcCount: count });
		} else {
			existing.total += count;
			if (count > existing.bestMcCount) {
				existing.bestMcCount = count;
				existing.bestMc = mc;
			}
		}
	}
	for (const j of joints) {
		const cover = j.imageUrl || j.manga.imageUrl;
		if (!cover || cover.trim() === '') continue;
		const count = countsByJointId.get(j.id) ?? 0;
		const existing = byMangaId.get(j.manga.id);
		if (!existing) {
			byMangaId.set(j.manga.id, { mangaId: j.manga.id, total: count, joint: j, bestMcCount: 0 });
		} else {
			existing.total += count;
			existing.joint = j;
		}
	}

	const ranked = [...byMangaId.values()]
		.filter((e) => e.joint || e.bestMc)
		.sort((a, b) => b.total - a.total)
		.slice(0, limit);

	return ranked.map((entry) => {
		// Joint takes precedence: the per-org manga page redirects there anyway.
		if (entry.joint) {
			const j = entry.joint;
			const coverUrl = j.imageUrl || j.manga.imageUrl || '';
			const lastChapters = j.chapters.map((chapter: any) => ({
				id: chapter.id,
				number: chapter.number,
				title: chapter.title,
				releasedAt: chapter.releasedAt,
				chapterUrl: `/joint/manga/${j.slug}/chapters/${chapter.number}`,
			}));
			return {
				id: `joint-${j.id}`,
				title: j.title || j.manga.title,
				cover: coverUrl,
				scanName: 'Joint',
				scanSlug: '',
				scanUrl: '/scans',
				mangaSlug: j.slug,
				mangaUrl: `/joint/manga/${j.slug}`,
				badgeColor: 'bg-purple-600',
				chapters: lastChapters,
				organizationId: 0,
				isNSFW: false,
				isJoint: true,
			};
		}
		const mc = entry.bestMc!;
		const organization = mc.organization;
		const manga = mc.manga;
		const coverUrl = mc.imageUrl || manga.imageUrl || '';
		const lastChapters = mc.chapters.map((chapter: any) => ({
			id: chapter.id,
			number: chapter.number,
			title: chapter.title,
			releasedAt: chapter.releasedAt,
			chapterUrl: `/${organization.slug}/manga/${manga.slug}/chapters/${chapter.number}`,
		}));
		return {
			id: mc.id.toString(),
			title: mc.title || manga.title,
			cover: coverUrl,
			scanName: organization.name,
			scanSlug: organization.slug,
			scanUrl: `/${organization.slug}`,
			mangaSlug: manga.slug,
			mangaUrl: `/${organization.slug}/manga/${manga.slug}`,
			badgeColor: getBadgeColor(organization.name),
			chapters: lastChapters,
			organizationId: organization.id,
			isNSFW: mc.isNSFW || organization.isNSFW,
			isJoint: false,
		};
	});
};
