import { prisma } from "../../models/prisma";
import type { EditChapterRequest } from "../../types/chapter/edit";

export const editChapter = async (organizationId: number, mangaSlug: string, chapterNumber: number, params: EditChapterRequest) => {
	const r2PublicUrl = Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com';
	
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

	// Construir imageUrl desde fileKey
	const updateData: any = {
		number: params.number || chapterExists.number,
		title: params.title || chapterExists.title,
		releasedAt: params?.releasedAt,
	};

	if (params.image !== undefined) {
		if (params.image === null) {
			updateData.imageUrl = null;
		} else if (typeof params.image === 'string') {
			updateData.imageUrl = params.image.startsWith('http') 
				? params.image 
				: `${r2PublicUrl}/${params.image}`;
		}
	}

	const chapter = await prisma.chapter.update({
		where: {
			id: chapterExists.id,
		},
		data: updateData,
	});

	if (params.pages) {
		await prisma.page.deleteMany({
			where: {
				chapterId: chapter.id,
			},
		});
		await Promise.all(params.pages.map(async (page, index) => {
			// Las páginas son fileKeys o URLs que vienen del frontend
			const pageUrl = page.startsWith('http') 
				? page 
				: `${r2PublicUrl}/${page}`;
			
			// Buscar página existente para preservar dimensiones si es posible
			const existingPage = chapterExists.pages.find(p => {
				if (!p.imageUrl) return false;
				return p.imageUrl === pageUrl || p.imageUrl.endsWith(page);
			});
			
			await prisma.page.create({
				data: {
					imageUrl: pageUrl,
					number: index + 1,
					chapterId: chapter.id,
					imageHeight: existingPage?.imageHeight || 100,
					imageWidth: existingPage?.imageWidth || 100,
					imageType: existingPage?.imageType || "any",
					isSinglePage: params.singlePages?.includes(index) ?? false,
				},
			});
		}));
	}

	return chapter;
};
