import { prisma } from "../../models/prisma";
import type { EditCoinPackRequest } from "../../types/coinpack/edit";

export const editCoinPack = async (organizationId: number, coinPackId: number, params: EditCoinPackRequest) => {
    const coinPack = await prisma.coinPack.findFirst({
        where: {
            id: coinPackId,
            organizationId,
        },
    });

    if (!coinPack) {
        throw new Error("Coin pack not found for this organization");
    }
    
    await prisma.coinPack.update({
        where: {
            id: coinPack.id,
        },
        data: {
            name: params.name,
            description: params.description,
            priceWithoutDiscount: params.priceWithoutDiscount,
            price: params.price,
            coins: params.coins,
            active: params.active,
        }
    });

    return await prisma.coinPack.findFirst({ where: { id: coinPack.id } });
};
