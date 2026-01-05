import { prisma } from "../../models/prisma";

export const checkOrganization = async (domain: string) => {
    return await prisma.organization.findFirst({
        where: {
            domain,
        },
        include: {
            countryOptions: true,
        }
    });
}

export const checkOrganizationBySlug = async (slug: string) => {
    return await prisma.organization.findFirst({
        where: {
            slug,
        },
        include: {
            countryOptions: true,
            _count: {
                select: {
                    followers: true,
                },
            },
        }
    });
}