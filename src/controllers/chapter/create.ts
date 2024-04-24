import { prisma } from "../../models/prisma";
import type { CreateChapterRequest } from "../../types/chapter/create";
import { uploadFile } from "../../util/upload-file";
import sizeOf from "buffer-image-size";

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
		throw new Error("No se encontró el manga");
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

	const chapter = await prisma.chapter.create({
		data: {
			mangaCustomId: mangaCustom.id,
			number: params.number,
			title: params.title,
			releasedAt: params?.releasedAt,
			isSubscription: params?.isSubscription,
		},
	});

	if (params.image && params.image instanceof File) {
		const imageBuffer = await params.image.arrayBuffer();
		const imageUrl = await uploadFile(imageBuffer, params.image.name);
		await prisma.chapter.update({
			where: {
				id: chapter.id,
			},
			data: {
				imageUrl,
			},
		});
	}

	if (params.pages) {
		await Promise.all(params.pages.map(async (page, index) => {
			if (page instanceof File) {
				const pageBuffer = await page.arrayBuffer();
				const pageSize = sizeOf(Buffer.from(pageBuffer));
				const pageUrl = await uploadFile(pageBuffer, page.name);
				await prisma.page.create({
					data: {
						imageUrl: pageUrl,
						number: index + 1,
						chapterId: chapter.id,
						imageWidth: pageSize.width,
						imageHeight: pageSize.height,
						imageType: pageSize.type,
					},
				})
			}
		}));
	}

	await prisma.mangaCustom.update({
		where: {
			id: mangaCustom.id,
		},
		data: {
			lastChapterAt: new Date(),
		},
	});

	return chapter;
};
