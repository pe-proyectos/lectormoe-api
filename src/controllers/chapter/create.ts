import { prisma } from "../../models/prisma";
import { CreateChapterRequest } from "../../types/chapter/create";
import { uploadFile } from "../../util/upload-file";

export const createChapter = async (organizationId: number, mangaSlug: string, params: CreateChapterRequest) => {
	const mangaCustom = await prisma.mangaCustom.findFirst({
		where: {
			manga: {
				slug: mangaSlug,
			},
			organization: {
				id: organizationId,
			}
		},
	});

	if (!mangaCustom) {
		throw new Error(`No se encontró el manga`);
	}

	const chapterExists = await prisma.chapter.findFirst({
		where: {
			number: params.number,
			mangaCustomId: mangaCustom.id,
		}
	});

	if (chapterExists) {
		throw new Error(`El capítulo ${params.number} ya existe`);
	}

	const imageBuffer = await params.image.arrayBuffer();
	const imageUrl = await uploadFile(imageBuffer, params.image.name);

	const chapter = await prisma.chapter.create({
		data: {
			mangaCustomId: mangaCustom.id,
			number: params.number,
			title: params.title,
			imageUrl,
		},
	});

	return chapter;
};
