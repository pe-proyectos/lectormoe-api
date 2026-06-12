import { prisma, Prisma } from "../../models/prisma";

// Generate a consistent color based on organization name
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

export type ScansSort = 'followers' | 'followers_7d' | 'name' | 'mangas';

export interface GetScansParams {
	includeNSFW?: boolean;
	page?: number;
	limit?: number;
	sort?: ScansSort;
	search?: string;
}

export const getScans = async (params: GetScansParams = {}) => {
	const includeNSFW = params.includeNSFW ?? false;
	const page = Math.max(1, params.page ?? 1);
	const limit = Math.min(100, Math.max(1, params.limit ?? 20));
	const sort = params.sort ?? 'followers';
	const search = params.search?.trim() || '';

	const where: any = {
		isPublic: true,
		isNSFW: includeNSFW ? true : false,
		isDeleted: false,
	};
	if (search) {
		where.name = { contains: search, mode: 'insensitive' };
	}

	// followers_7d: rank orgs by new followers in the last 7 days instead of total.
	// Uses a two-step query: groupBy on OrganizationFollower → fetch matching orgs.
	if (sort === 'followers_7d') {
		const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
		const groups = await prisma.organizationFollower.groupBy({
			by: ['organizationId'],
			where: { createdAt: { gte: weekAgo } },
			_count: { userId: true },
			orderBy: { _count: { userId: Prisma.SortOrder.desc } },
			take: (page * limit) + limit, // over-fetch to account for org filter
		});

		const weeklyCountMap = new Map(groups.map(g => [g.organizationId, g._count.userId]));
		const orgIdsInOrder = groups.map(g => g.organizationId);

		const organizations = await prisma.organization.findMany({
			where: { ...where, id: { in: orgIdsInOrder } },
			select: {
				id: true, name: true, slug: true, description: true,
				domain: true, logoUrl: true, bannerUrl: true, isNSFW: true,
				_count: { select: { followers: true, mangaCustoms: true } },
			},
		});

		// Re-sort by weekly count (DB returned them in arbitrary order for the in-filter)
		organizations.sort((a, b) => (weeklyCountMap.get(b.id) ?? 0) - (weeklyCountMap.get(a.id) ?? 0));
		const paginated = organizations.slice((page - 1) * limit, page * limit);

		const total = organizations.length;
		const maxPage = Math.max(1, Math.ceil(total / limit));

		const items = await Promise.all(paginated.map(async (org) => {
			const allGenres = await prisma.genre.findMany({
				where: { organizationId: org.id, display: true, mangasCustom: { some: {} } },
				select: { id: true, name: true, _count: { select: { mangasCustom: true } } },
			});
			const topGenres = allGenres
				.sort((a, b) => b._count.mangasCustom - a._count.mangasCustom)
				.slice(0, 3).map(g => g.name);
			return {
				id: org.slug, name: org.name, description: org.description || '',
				url: `/${org.slug}`, color: getBadgeColor(org.name),
				logo: org.logoUrl || null, banner: org.bannerUrl || null,
				isNSFW: org.isNSFW || false,
				followerCount: org._count.followers,
				genres: topGenres, totalMangas: org._count.mangaCustoms,
			};
		}));

		return { items, total, maxPage, page, limit };
	}

	const total = await prisma.organization.count({ where });
	const maxPage = Math.max(1, Math.ceil(total / limit));

	// Sorting: 'followers' and 'mangas' need subquery-based ordering via Prisma.
	// 'followers' — Prisma supports orderBy followers._count
	// 'mangas' — we order by the mangaCustomCount relation count (mangasCustom)
	// 'name' — direct
	let orderBy: any;
	if (sort === 'name') {
		orderBy = { name: Prisma.SortOrder.asc };
	} else if (sort === 'mangas') {
		// Organization's relation is `mangaCustoms` — not to be confused with the
		// Genre relation `mangasCustom` (different plural).
		orderBy = { mangaCustoms: { _count: Prisma.SortOrder.desc } };
	} else {
		orderBy = { followers: { _count: Prisma.SortOrder.desc } };
	}

	const organizations = await prisma.organization.findMany({
		where,
		select: {
			id: true,
			name: true,
			slug: true,
			description: true,
			domain: true,
			logoUrl: true,
			bannerUrl: true,
			isNSFW: true,
			_count: {
				select: {
					followers: true,
					mangaCustoms: true,
				},
			},
		},
		orderBy,
		skip: (page - 1) * limit,
		take: limit,
	});

	// Top 3 genres per org — only on the small paginated subset (not all 90),
	// so the N+1 is bounded to `limit` extra queries.
	const items = await Promise.all(
		organizations.map(async (org) => {
			const allGenres = await prisma.genre.findMany({
				where: {
					organizationId: org.id,
					display: true,
					mangasCustom: { some: {} },
				},
				select: {
					id: true,
					name: true,
					_count: { select: { mangasCustom: true } },
				},
			});
			const topGenres = allGenres
				.sort((a, b) => b._count.mangasCustom - a._count.mangasCustom)
				.slice(0, 3)
				.map((g) => g.name);

			return {
				id: org.slug,
				name: org.name,
				description: org.description || '',
				url: `/${org.slug}`,
				color: getBadgeColor(org.name),
				logo: org.logoUrl || null,
				banner: org.bannerUrl || null,
				isNSFW: org.isNSFW || false,
				followerCount: org._count.followers,
				genres: topGenres,
				totalMangas: org._count.mangaCustoms,
			};
		})
	);

	return { items, total, maxPage, page, limit };
};
