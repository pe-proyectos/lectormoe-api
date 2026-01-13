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

export const getFeaturedManga = async (limit: number = 8) => {
	// Get all manga customs with their organization info, ordered by views
	const mangasCustoms = await prisma.mangaCustom.findMany({
		where: {
			// Only include mangas with cover images
			OR: [
				{
					imageUrl: {
						not: null,
					},
				},
				{
					manga: {
						imageUrl: {
							not: null,
						},
					},
				},
			],
		},
		include: {
			manga: {
				select: {
					id: true,
					title: true,
					slug: true,
					imageUrl: true,
				},
			},
			organization: {
				select: {
					id: true,
					name: true,
					domain: true,
					slug: true,
				},
			},
			chapters: {
				select: {
					id: true,
					number: true,
					title: true,
					releasedAt: true,
					subscribersOnly: true,
					views: true,
				},
			},
		},
		orderBy: {
			views: Prisma.SortOrder.desc,
		},
		take: limit * 3, // Get more to filter out ones without covers
	});

	// Calculate total views (manga views + chapter views) and filter
	const mangasWithViews = mangasCustoms
		.map((mangaCustom) => {
			const chapterViews = mangaCustom.chapters.reduce(
				(acc, chapter) => acc + chapter.views,
				0
			);
			const totalViews = mangaCustom.views + chapterViews;
			
			return {
				mangaCustom,
				totalViews,
			};
		})
		.filter((item) => {
			// Filter out mangas without valid cover URLs
			// Prefer MangaCustom.imageUrl, fallback to Manga.imageUrl
			const coverUrl = item.mangaCustom.imageUrl || item.mangaCustom.manga.imageUrl;
			return coverUrl && coverUrl.trim() !== '';
		})
		.sort((a, b) => b.totalViews - a.totalViews)
		.slice(0, limit);

	// Transform to the format expected by the frontend
	return mangasWithViews.map(({ mangaCustom }) => {
		const organization = mangaCustom.organization;
		const manga = mangaCustom.manga;
		
		// Prefer MangaCustom.imageUrl, fallback to Manga.imageUrl
		const coverUrl = mangaCustom.imageUrl || manga.imageUrl || '';
		
		// Get last 2 chapters ordered by number (descending)
		const lastChapters = mangaCustom.chapters
			.sort((a, b) => b.number - a.number)
			.slice(0, 2)
			.map((chapter) => ({
				id: chapter.id,
				number: chapter.number,
				title: chapter.title,
				releasedAt: chapter.releasedAt,
				subscribersOnly: chapter.subscribersOnly,
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
			organizationId: organization.id, // Include organizationId for subscription checks
		};
	});
};

