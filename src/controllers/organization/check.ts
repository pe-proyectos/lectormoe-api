import { prisma } from "../../models/prisma";

export const checkOrganization = async (domain: string) => {
    return await prisma.organization.findFirst({
        where: {
            domain,
        }
    });
}
