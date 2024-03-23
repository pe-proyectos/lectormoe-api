import { prisma } from "../../models/prisma";
import type { EditMangaCustomRequest } from "../../types/manga-custom/edit";
import { uploadFile } from "../../util/upload-file";

export const editMangaCustom = async (organizationId: number, mangaSlug: string, params: EditMangaCustomRequest) => {
	const mangaCustom = await prisma.mangaCustom.findFirst({
		where: {
			id: params.mangaCustomId,
			organizationId,
			manga: {
				slug: mangaSlug,
			},
		},
	});

	if (!mangaCustom) {
		throw new Error(`Tu organización no tiene este manga`);
	}
	
	await prisma.mangaCustom.update({
		where: {
			id: mangaCustom.id,
		},
		data: {
			title: params.title,
			shortDescription: params.shortDescription,
			description: params.description,
			releasedAt: params.releasedAt,
			nextChapterAt: params.nextChapterAt,
			...params.image && params.image instanceof File ? {} : {
				imageUrl: params.image === "null" ? null : params.image,
			},
		}
	});

	if (params.image && params.image instanceof File) {
		const imageBuffer = await params.image.arrayBuffer();
		const imageUrl = await uploadFile(imageBuffer, params.image.name);
		await prisma.mangaCustom.update({
			where: {
				id: mangaCustom.id,
			},
			data: {
				imageUrl,
			},
		});
	}

	return await prisma.mangaCustom.findFirst({ where: { id: mangaCustom.id } });
};
