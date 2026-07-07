import { prisma } from "../../models/prisma";
import { logModeration } from "../../util/moderation-log";

export const deleteChapter = async (organizationId: number, mangaSlug: string, number: number, actorUserId?: number) => {
	const chapter = await prisma.chapter.findFirst({
		where: {
			number,
			deletedAt: null,
			mangaCustom: {
				manga: { slug: mangaSlug },
				organization: { id: organizationId },
			},
		},
	});
	if (!chapter) {
		return null;
	}
	await prisma.chapter.update({
		where: { id: chapter.id },
		data: { deletedAt: new Date() },
	});
	logModeration(actorUserId ?? null, 'chapter_delete', 'chapter', chapter.id, `org ${organizationId} · ${mangaSlug} · cap. ${number}`);
	return chapter;
};
