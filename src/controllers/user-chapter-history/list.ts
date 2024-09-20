import { prisma } from "../../models/prisma";
import type { UserChapterHistoryListQuery } from "../../types/user-chapter-history/list";

export const listUserChapterHistory = async (organizationId: number, userId: number, filters: UserChapterHistoryListQuery) => {
	const historyData = await prisma.userChapterHistory.findMany({
		where: {
			userId,
			chapter: {
				mangaCustom: {
					organizationId,
					manga: {
						slug: filters?.manga_slug,
					}
				}
			},
			finishedAt: filters?.include_finished ? undefined : null,
		},
		include: {
			chapter: {
				select: {
					title: true,
					number: true,
					imageUrl: true,
					mangaCustom: {
						select: {
							title: true,
							imageUrl: true,
							manga: {
								select: {
									slug: true,
								}
							}
						}
					}
				}
			}
		},
		orderBy: {
			lastReadAt: 'desc',
		},
		skip: filters?.page ? (Number.parseInt(filters?.page || "1") - 1) * Number.parseInt(filters?.limit || "10") : 0,
		take: Number.parseInt(filters?.limit || "10"),
	});

	const total = await prisma.userChapterHistory.count({
		where: {
			userId,
			chapter: {
				mangaCustom: {
					organizationId,
					manga: {
						slug: filters?.manga_slug,
					}
				}
			},
			finishedAt: filters?.include_finished ? undefined : null,
		},
	});

	return {
		data: historyData,
		maxPage: Math.ceil(total / Number.parseInt(filters?.limit || "10")),
		total,
	}
};
