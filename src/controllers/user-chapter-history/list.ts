import { prisma } from "../../models/prisma";
import type { UserChapterHistoryListQuery } from "../../types/user-chapter-history/list";

export const listUserChapterHistory = async (organizationId: number | null, userId: number, filters: UserChapterHistoryListQuery) => {
	const whereClause: any = {
		userId,
		chapter: {
			mangaCustom: {
				...(organizationId !== null ? { organizationId } : {}),
				manga: {
					slug: filters?.manga_slug,
				}
			}
		},
		finishedAt: filters?.include_finished ? undefined : null,
	};

	const historyData = await prisma.userChapterHistory.findMany({
		where: whereClause,
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
							organization: {
								select: {
									id: true,
									name: true,
									slug: true,
								}
							},
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
		where: whereClause,
	});

	return {
		data: historyData,
		maxPage: Math.ceil(total / Number.parseInt(filters?.limit || "10")),
		total,
	}
};
