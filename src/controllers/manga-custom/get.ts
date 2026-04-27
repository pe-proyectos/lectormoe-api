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

	// Only redirect to the joint page when the CURRENT org (the one whose
	// page the viewer is on) is an ACCEPTED member of the joint. A joint
	// owned by a different scan should not hijack other scans' manga pages
	// — those scans never agreed to enter the joint.
	const activeJoint = await prisma.mangaJoint.findFirst({
		where: {
			mangaId: mangaCustom.manga.id,
			deletedAt: null,
			members: {
				some: {
					organizationId,
					status: "ACCEPTED",
				},
			},
		},
		select: { slug: true },
	});

	return {
		...mangaCustom,
		jointSlug: activeJoint?.slug || null,
	};
};
