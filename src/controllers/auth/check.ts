import { prisma } from "../../models/prisma";

export const checkToken = async (organizationId: number, token: string) => {
    const user = await prisma.user.findFirst({
        where: {
            tokens: {
                some: {
                    token,
                }
            }
        },
        include: {
            members: {
                where: {
                    organizationId,
                },
                take: 1,
            },
        },
    });

    return user;
}

export const checkMemberToken = async (organizationId: number, token: string) => {
    const member = await prisma.member.findFirst({
        where: {
            organizationId,
            user: {
                tokens: {
                    some: {
                        token,
                    }
                }
            }
        },
        include: {
            user: true,
        }
    });

    return member;
}
