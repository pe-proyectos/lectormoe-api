import { prisma, Prisma } from "../../models/prisma";
import type { UserChapterHistoryListQuery } from "../../types/user-chapter-history/list";

export const listUserChapterHistory = async (organizationId: number | null, userId: number, filters: UserChapterHistoryListQuery) => {
	// Build chapter filter: include both org chapters and joint chapters
	const buildChapterFilter = () => {
		const orgFilter: any = {
			...(organizationId !== null ? { organizationId } : {}),
		};
		if (filters?.manga_slug) {
			orgFilter.manga = { slug: filters.manga_slug };
		}

		return {
			OR: [
				{ mangaCustom: orgFilter },
				{ jointId: { not: null } },
			],
		};
	};

	const whereClause: any = {
		userId,
		chapter: buildChapterFilter(),
		finishedAt: filters?.include_finished ? undefined : null,
	};

	const historyData = await prisma.userChapterHistory.findMany({
		where: whereClause,
		include: {
			chapter: {
				select: {
					id: true,
					title: true,
					number: true,
					imageUrl: true,
					mangaCustomId: true,
					jointId: true,
					mangaCustom: {
						select: {
							title: true,
							imageUrl: true,
							isNSFW: true,
							organization: {
								select: {
									id: true,
									name: true,
									slug: true,
									isNSFW: true,
								}
							},
							manga: {
								select: {
									slug: true,
								}
							}
						}
					},
					joint: {
						select: {
							id: true,
							title: true,
							slug: true,
							imageUrl: true,
						}
					},
				}
			}
		},
		orderBy: {
			lastReadAt: Prisma.SortOrder.desc,
		},
		skip: filters?.page ? (Number.parseInt(filters?.page || "1") - 1) * Number.parseInt(filters?.limit || "10") : 0,
		take: Number.parseInt(filters?.limit || "10"),
	});

	const total = await prisma.userChapterHistory.count({
		where: whereClause,
	});

	return {
		data: historyData,
		maxPage: Math.ceil(total / Number.parseInt(filters?.limit || "10")),
		total,
	}
};
