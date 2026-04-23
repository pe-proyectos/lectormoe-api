import { prisma } from "../../models/prisma";

export const deleteUserListManga = async (
	organizationId: number | null,
	userId: number,
	mangaSlug: string,
) => {
	const whereClause: any = { manga: { slug: mangaSlug } };
	if (organizationId !== null) whereClause.organizationId = organizationId;

	const mangaCustom = await prisma.mangaCustom.findFirst({ where: whereClause });
	if (!mangaCustom) return false;

	const existing = await prisma.userList.findFirst({
		where: { userId, mangaCustomId: mangaCustom.id },
	});
	if (!existing) return false;

	await prisma.userList.delete({ where: { id: existing.id } });
	return true;
};

export const deleteUserListJoint = async (userId: number, jointSlug: string) => {
	const joint = await prisma.mangaJoint.findFirst({
		where: { slug: jointSlug, deletedAt: null },
		select: { id: true },
	});
	if (!joint) return false;

	const existing = await prisma.userList.findFirst({
		where: { userId, jointId: joint.id },
	});
	if (!existing) return false;

	await prisma.userList.delete({ where: { id: existing.id } });
	return true;
};
