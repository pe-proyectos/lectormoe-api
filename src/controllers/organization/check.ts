import { prisma } from "../../models/prisma";

export const checkOrganization = async (domain: string, token: string) => {
    return await prisma.organization.findFirst({
        select: {
            id: true,
            slug: true,
            name: true,
            title: true,
            imageUrl: true,
            description: true,
            googleAdsMetaContent: true,
            googleAdsAdsTxtContent: true,
        },
        where: {
            domain,
        }
    });
}
