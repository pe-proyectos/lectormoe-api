import { prisma } from "../../models/prisma";

export const autocompleteManga = async () => {
	return await prisma.manga.findMany({
		select: {
			id: true,
			title: true,
			slug: true,
		}
	});
};
