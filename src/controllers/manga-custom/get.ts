import { prisma, Prisma } from "../../models/prisma";

export const getMangaCustomBySlug = async (organizationId: number, mangaSlug: string) => {
	const mangaCustom = await prisma.mangaCustom.findFirst({
		where: {
			organization: {
				id: organizationId,
			},
			manga: {
				slug: mangaSlug,
			},
			deletedAt: null,
		},
		include: {
			manga: {
				include: {
					authors: true,
					demography: true,
					bookType: true,
				}
			},
			organization: {
				select: {
					id: true,
					name: true,
					slug: true,
					isNSFW: true,
				},
			},
			chapters: {
				where: { deletedAt: null },
				orderBy: {
					number: Prisma.SortOrder.desc,
				},
			},
			genres: {
				select: {
					id: true,
					name: true,
					description: true,
					slug: true,
				},
			},
			subscriptionPlansCanReadUnreleased: {
				select: {
					id: true,
					name: true,
					canDownload: true,
					canReadUnreleased: true,
				},
			},
			subscriptionPlansCanReadReleased: {
				select: {
					id: true,
					name: true,
					canDownload: true,
					canReadUnreleased: true,
				},
			},
			rankings: {
				take: 4,
				select: {
					rank: true,
					comment: true,
					createdAt: true,
					User: {
						select: {
							username: true,
						},
					},
				},
				orderBy: {
					createdAt: Prisma.SortOrder.desc,
				},
			},
		},
	});
	if (!mangaCustom) {
		return null;
	}

	// Check if this manga belongs to an active joint
	const activeJoint = await prisma.mangaJoint.findFirst({
		where: { mangaId: mangaCustom.manga.id, deletedAt: null },
		select: { slug: true },
	});

	return {
		...mangaCustom,
		jointSlug: activeJoint?.slug || null,
	};
};
