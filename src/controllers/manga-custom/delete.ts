import { prisma } from "../../models/prisma";
import { logModeration } from "../../util/moderation-log";

export const deleteMangaCustom = async (organizationId: number, mangaSlug: string, actorUserId?: number) => {
	const mangaCustom = await prisma.mangaCustom.findFirst({
		where: {
			organizationId,
			deletedAt: null,
			manga: {
				slug: mangaSlug,
			},
		},
		select: { id: true, mangaId: true },
	});

	if (!mangaCustom) {
		throw new Error("Tu organización no tiene este manga");
	}

	// Block deletion when this org is an ACCEPTED member of an active joint for
	// the same base manga — leaving the joint must come first so chapters detach
	// cleanly and uploaders don't lose their authorship trail.
	const activeJointMembership = await prisma.jointMember.findFirst({
		where: {
			organizationId,
			status: 'ACCEPTED',
			joint: { mangaId: mangaCustom.mangaId, deletedAt: null },
		},
		select: { joint: { select: { slug: true } } },
	});
	if (activeJointMembership) {
		throw new Error(
			`No puedes eliminar este manga, está en un joint activo (${activeJointMembership.joint.slug}). Sal del joint primero.`,
		);
	}

	await prisma.mangaCustom.update({
		where: {
			id: mangaCustom.id,
		},
		data: {
			deletedAt: new Date(),
		},
	});

	logModeration(actorUserId ?? null, 'manga_delete', 'manga_custom', mangaCustom.id, `org ${organizationId} · ${mangaSlug}`);
};
