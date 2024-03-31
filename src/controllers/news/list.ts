import { prisma } from "../../models/prisma";
import { NewsListQuery } from "../../types/news/list";

export const listNews = async (organizationId: number, filters: NewsListQuery) => {
	const news = await prisma.news.findMany({
		where: {
			member: {
				organizationId,
			},
		},
		include: {
			member: {
				select: {
					user: {
						select: {
							username: true,
						}
					}
				}
			}
		},
		orderBy: {
			createdAt: 'desc',
		},
		skip: filters?.page ? (parseInt(filters?.page || "1") - 1) * parseInt(filters?.limit || "10") : 0,
		take: parseInt(filters?.limit || "10"),
	});

	const total = await prisma.news.count({
		where: {
			member: {
				organizationId,
			},
		},
	});

	return {
		data: news,
		maxPage: Math.ceil(total / parseInt(filters?.limit || "10")),
		total,
	}
};
