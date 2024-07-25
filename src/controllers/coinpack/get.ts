import { prisma } from "../../models/prisma";

export const getCoinPackBySlug = async (organizationId: number, slug: string) => {
	const coinPack = await prisma.coinPack.findFirst({
		where: {
			organizationId: organizationId,
			slug: slug,
		},
	});

	if (!coinPack) {
		return null;
	}

	return coinPack;
};

export const getAllCoinPacks = async (organizationId: number) => {
	const coinPacks = await prisma.coinPack.findMany({
		where: {
			organizationId: organizationId,
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	return coinPacks;
};
