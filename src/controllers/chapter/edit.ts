import sizeOf from "buffer-image-size";
import { prisma } from "../../models/prisma";
import type { EditChapterRequest } from "../../types/chapter/edit";
import { uploadFile } from "../../util/upload-file";

export const editChapter = async (organizationId: number, mangaSlug: string, chapterNumber: number, params: EditChapterRequest) => {
	const chapterExists = await prisma.chapter.findFirst({
		where: {
			number: chapterNumber,
			mangaCustom: {
				manga: {
					slug: mangaSlug,
				},
				organization: {
					id: organizationId,
				}
			},
		},
		include: {
			pages: true,
		}
	});

	if (!chapterExists) {
		throw new Error(`El capítulo ${chapterNumber} no existe`);
	}

	const chapter = await prisma.chapter.update({
		where: {
			id: chapterExists.id,
		},
		data: {
			number: params.number || chapterExists.number,
			title: params.title || chapterExists.title,
			...params.image && params.image instanceof File ? {} : {
				imageUrl: params.image === "null" ? null : params.image,
			},
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
		await prisma.page.deleteMany({
			where: {
				chapterId: chapter.id,
			},
		});
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
			} else if (typeof page === "string") {
				const existingPage = chapterExists.pages.find(p => p.imageUrl === page);
				if (existingPage) {
					await prisma.page.create({
						data: {
							imageUrl: existingPage.imageUrl,
							number: index + 1,
							chapterId: chapter.id,
							imageHeight: existingPage.imageHeight,
							imageWidth: existingPage.imageWidth,
							imageType: existingPage.imageType,
						},
					});
				} else {
					await prisma.page.create({
						data: {
							imageUrl: page,
							number: index + 1,
							chapterId: chapter.id,
							imageHeight: 100,
							imageWidth: 100,
							imageType: "any",
						},
					});
				}
			}
		}));
	}

	return chapter;
};
