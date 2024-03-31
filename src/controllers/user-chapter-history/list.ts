import { prisma } from "../../models/prisma";
import { UserChapterHistoryListQuery } from "../../types/user-chapter-history/list";

export const listUserChapterHistory = async (organizationId: number, userId: number, filters: UserChapterHistoryListQuery) => {
	const historyData = await prisma.userChapterHistory.findMany({
		where: {
			userId,
			chapter: {
				mangaCustom: {
					organizationId,
				}
			},
			finishedAt: null,
		},
		include: {
			chapter: {
				select: {
					title: true,
					number: true,
					mangaCustom: {
						select: {
							title: true,
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
		skip: filters?.page ? (parseInt(filters?.page || "1") - 1) * parseInt(filters?.limit || "10") : 0,
		take: parseInt(filters?.limit || "10"),
	});

	const total = await prisma.userChapterHistory.count({
		where: {
			userId,
			chapter: {
				mangaCustom: {
					organizationId,
				}
			},
			finishedAt: null,
		},
	});

	return {
		data: historyData,
		maxPage: Math.ceil(total / parseInt(filters?.limit || "10")),
		total,
	}
};
