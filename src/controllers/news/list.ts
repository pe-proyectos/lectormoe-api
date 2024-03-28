import { prisma } from "../../models/prisma";

export const listNews = async (organizationId: number) => {
	const news = await prisma.news.findMany({
		where: {
			member: {
				organizationId,
			},
		},
	});
	return news;
};
