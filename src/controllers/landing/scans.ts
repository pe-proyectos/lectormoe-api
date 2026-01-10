import { prisma, Prisma } from "../../models/prisma";

// Generate a consistent color based on organization name
const getBadgeColor = (orgName: string): string => {
	// Simple hash function to generate consistent colors
	let hash = 0;
	for (let i = 0; i < orgName.length; i++) {
		hash = orgName.charCodeAt(i) + ((hash << 5) - hash);
	}
	
	// Predefined color palette
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

export const getScans = async (includeNSFW: boolean = false) => {
	// Get all public organizations, filtering by isNSFW
	const organizations = await prisma.organization.findMany({
		where: {
			isPublic: true,
			isNSFW: includeNSFW ? true : false,
		},
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
				},
			},
		},
		orderBy: {
			name: Prisma.SortOrder.asc,
		},
	});

	// For each organization, get metadata
	const scansWithMangas = await Promise.all(
		organizations.map(async (org) => {
			// Get most common genres for this organization (top 3)
			const allGenres = await prisma.genre.findMany({
				where: {
					organizationId: org.id,
					display: true,
					mangasCustom: {
						some: {},
					},
				},
				select: {
					id: true,
					name: true,
					slug: true,
					_count: {
						select: {
							mangasCustom: true,
						},
					},
				},
			});

			// Sort by count and take top 3
			const topGenres = allGenres
				.sort((a, b) => b._count.mangasCustom - a._count.mangasCustom)
				.slice(0, 3)
				.map((g) => g.name);

			// Get total manga count
			const totalMangas = await prisma.mangaCustom.count({
				where: {
					organizationId: org.id,
				},
			});

			const result = {
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
				totalMangas: totalMangas,
			};
			
			return result;
		})
	);

	return scansWithMangas;
};

