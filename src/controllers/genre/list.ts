import prisma from "../../models/prisma";

export const listGenre = async () => {
	return await prisma.genre.findMany({
		where: {
			display: true
		}
	});
};
