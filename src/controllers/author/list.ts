import { prisma } from "../../models/prisma";

export const listAuthor = async () => {
	return await prisma.author.findMany();
};
