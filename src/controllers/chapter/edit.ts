import { prisma } from "../../models/prisma";
import { EditChapterRequest } from "../../types/chapter/edit";
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
			}
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
				const pageUrl = await uploadFile(pageBuffer, page.name);
				await prisma.page.create({
					data: {
						imageUrl: pageUrl,
						number: index + 1,
						chapterId: chapter.id,
					},
				})
			} else if (typeof page === "string") {
				await prisma.page.create({
					data: {
						imageUrl: page,
						number: index + 1,
						chapterId: chapter.id,
					},
				});
			}
		}));
	}

	return chapter;
};
