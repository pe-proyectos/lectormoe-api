import { prisma } from "../../models/prisma";

export const getMemberById = async (organizationId: number, memberId: number) => {
	const member = await prisma.member.findFirst({
		where: {
			organizationId: organizationId,
			id: memberId,
		},
	});

	if (!member) {
		return null;
	}

	return member;
};
