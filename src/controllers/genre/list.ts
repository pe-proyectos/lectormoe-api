import { prisma } from "../../models/prisma";

export const listGenre = async (organizationId: number) => {
	return await prisma.genre.findMany({
		where: {
			organizationId,
			display: true
		}
	});
};
