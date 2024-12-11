import { prisma } from "../../models/prisma";

export const getUserById = async (organizationId: number, userId: number) => {
	const user = await prisma.user.findFirst({
		where: {
			organizationId: organizationId,
			id: userId,
		},
	});

	if (!user) {
		return null;
	}

	return user;
};
