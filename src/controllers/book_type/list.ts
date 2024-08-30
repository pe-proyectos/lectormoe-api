import { prisma } from "../../models/prisma";

export const listBookType = async () => {
	return await prisma.bookType.findMany();
};
