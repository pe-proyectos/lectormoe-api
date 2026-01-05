import { prisma } from "../../models/prisma";

export const toggleFollowOrganization = async (userId: number, organizationId: number) => {
    // Check if user is already following
    const existingFollow = await prisma.organizationFollower.findFirst({
        where: {
            userId,
            organizationId,
        },
    });

    if (existingFollow) {
        // Unfollow
        await prisma.organizationFollower.delete({
            where: {
                id: existingFollow.id,
            },
        });
        return { followed: false };
    } else {
        // Follow
        await prisma.organizationFollower.create({
            data: {
                userId,
                organizationId,
            },
        });
        return { followed: true };
    }
};

export const checkIfUserFollows = async (userId: number, organizationId: number): Promise<boolean> => {
    const follow = await prisma.organizationFollower.findFirst({
        where: {
            userId,
            organizationId,
        },
    });
    return !!follow;
};

