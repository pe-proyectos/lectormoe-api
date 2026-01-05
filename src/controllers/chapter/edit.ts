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
			releasedAt: params?.releasedAt,
			subscribersOnly: params?.subscribersOnly,
			...params.image && params.image instanceof File ? {} : {
				imageUrl: params.image === "null" ? null : params.image,
			},
		},
	});

	if (params.image && params.image instanceof File) {
		const imageBuffer = await params.image.arrayBuffer();
		const imageUrl = await uploadFile(imageBuffer, params.image.name, undefined, organizationId, 'chapters');
		await prisma.chapter.update({
			where: {
				id: chapter.id,
			},
			data: {
				imageUrl,
			},
		});
	} else if (params.image && typeof params.image === 'string' && params.image !== 'null') {
		const publicEndpoint = Bun.env.FILE_DOWNLOAD_ENDPOINT 
			|| `https://pub-${Bun.env.R2_ACCOUNT_ID}.r2.dev`;
		const imageUrl = params.image.startsWith('http') 
			? params.image 
			: `${publicEndpoint}/${params.image}`;
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
				const pageUrl = await uploadFile(pageBuffer, page.name, undefined, organizationId, 'chapters');
				await prisma.page.create({
					data: {
						imageUrl: pageUrl,
						number: index + 1,
						chapterId: chapter.id,
						imageWidth: pageSize.width,
						imageHeight: pageSize.height,
						imageType: pageSize.type,
						isSinglePage: params.singlePages?.includes(index) ?? false,
					},
				})
			} else if (typeof page === "string") {
				// Check if it's a fileKey (just filename) or a full URL
				const publicEndpoint = Bun.env.FILE_DOWNLOAD_ENDPOINT 
					|| `https://pub-${Bun.env.R2_ACCOUNT_ID}.r2.dev`;
				const pageUrl = page.startsWith('http') 
					? page 
					: `${publicEndpoint}/${page}`;
				
				const existingPage = chapterExists.pages.find(p => {
					const existingUrl = p.imageUrl?.includes(page) || p.imageUrl === pageUrl;
					return existingUrl;
				});
				
				if (existingPage) {
					await prisma.page.create({
						data: {
							imageUrl: existingPage.imageUrl,
							number: index + 1,
							chapterId: chapter.id,
							imageHeight: existingPage.imageHeight,
							imageWidth: existingPage.imageWidth,
							imageType: existingPage.imageType,
							isSinglePage: params.singlePages?.includes(index) ?? false,
						},
					});
				} else {
					// If it's a new fileKey, we need to download it to get dimensions
					// For now, use default dimensions
					await prisma.page.create({
						data: {
							imageUrl: pageUrl,
							number: index + 1,
							chapterId: chapter.id,
							imageHeight: 100,
							imageWidth: 100,
							imageType: "any",
							isSinglePage: params.singlePages?.includes(index) ?? false,
						},
					});
				}
			}
		}));
	}

	return chapter;
};
