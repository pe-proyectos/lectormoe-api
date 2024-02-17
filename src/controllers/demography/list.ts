import prisma from "../../models/prisma";

export const listDemography = async () => {
	return await prisma.demography.findMany();
};
