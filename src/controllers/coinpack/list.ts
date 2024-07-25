import { prisma } from "../../models/prisma";
import { type CoinPackListQuery } from "../../types/coinpack/list";

const prepareCoinPack = (coinPack: any) => {
	return {
		...coinPack,
	};
}

export const listCoinPacks = async (organizationId: number, filters: CoinPackListQuery) => {
	const coinPacks = await prisma.coinPack.findMany({
		where: {
			organizationId: organizationId,
			name: {
				contains: filters.name,
				mode: "insensitive"
			},
			description: {
				contains: filters.description,
				mode: "insensitive"
			},
			active: filters.active,
		},
		orderBy: {
			createdAt: "desc",
		},
		skip: filters?.page ? (Number.parseInt(filters?.page || "1") - 1) * Number.parseInt(filters?.limit || "10") : 0,
		take: Number.parseInt(filters?.limit || "10"),
	});

	const total = await prisma.coinPack.count({
		where: {
			organizationId: organizationId,
			name: {
				contains: filters.name,
				mode: "insensitive"
			},
			description: {
				contains: filters.description,
				mode: "insensitive"
			},
			active: filters.active,
		},
	});

	return {
		data: coinPacks.map(prepareCoinPack),
		maxPage: Math.ceil(total / Number.parseInt(filters?.limit || "10")),
		total,
	};
};
