import { prisma } from "../../models/prisma";

export const getUserListManga = async (
	organizationId: number | null,
	userId: number,
	mangaSlug: string,
) => {
	const whereClause: any = { manga: { slug: mangaSlug } };
	if (organizationId !== null) whereClause.organizationId = organizationId;

	const mangaCustom = await prisma.mangaCustom.findFirst({ where: whereClause });
	if (!mangaCustom) return false;

	const entry = await prisma.userList.findFirst({
		where: { userId, mangaCustomId: mangaCustom.id },
	});
	return !!entry;
};

export const getUserListJoint = async (userId: number, jointSlug: string) => {
	const joint = await prisma.mangaJoint.findFirst({
		where: { slug: jointSlug, deletedAt: null },
		select: { id: true },
	});
	if (!joint) return false;

	const entry = await prisma.userList.findFirst({
		where: { userId, jointId: joint.id },
	});
	return !!entry;
};
