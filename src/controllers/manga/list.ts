import { prisma } from "../../models/prisma";

export const listManga = async () => {
	return await prisma.manga.findMany({
		include: {
			authors: true,
		}
	});
};
