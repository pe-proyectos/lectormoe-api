import { prisma } from "../../models/prisma";
import type { CreateCoinPackRequest } from "../../types/coinpack/create";
import { toSlug } from "../../util/slug";

export const createCoinPack = async (organizationId: number, params: CreateCoinPackRequest) => {
	const slug = toSlug(params.name);

	const organization = await prisma.organization.findFirst({
		where: {
			id: organizationId,
		},
	});

	if (!organization) {
		throw new Error("Organization not found");
	}

	const coinPackExists = await prisma.coinPack.findFirst({
		where: {
			name: params.name,
			organizationId: organization.id,
		},
	});

	if (coinPackExists) {
		throw new Error(`Your organization already has a coin pack titled '${params.name}'`);
	}

	const coinPack = await prisma.coinPack.create({
		data: {
			organizationId: organization.id,
			name: params.name,
			slug: slug,
			description: params.description,
			price: params.price,
			priceWithoutDiscount: params.priceWithoutDiscount,
			coins: params.coins,
			active: params.active ?? false,
		}
	});

	return coinPack;
};
