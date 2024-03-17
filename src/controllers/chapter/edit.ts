import { prisma } from "../../models/prisma";
import { EditChapterRequest } from "../../types/chapter/edit";
import { uploadFile } from "../../util/upload-file";

export const editChapter = async (userId: number, organizationSlug: string, mangaSlug: string, chapterNumber: number, params: EditChapterRequest) => {
	const chapterExists = await prisma.chapter.findFirst({
		where: {
			number: chapterNumber,
			mangaCustom: {
				manga: {
					slug: mangaSlug,
				},
				organization: {
					slug: organizationSlug,
					members: {
						some: {
							userId
						}
					}
				}
			}
		}
	});

	if (!chapterExists) {
		throw new Error(`El capítulo ${chapterNumber} no existe`);
	}

	const imageBuffer = params.image && await params.image.arrayBuffer();
	const imageUrl = params.image && imageBuffer && await uploadFile(imageBuffer, params.image.name);

	const chapter = await prisma.chapter.update({
		where: {
			id: chapterExists.id,
		},
		data: {
			number: params.number || chapterExists.number,
			title: params.title || chapterExists.title,
			imageUrl: imageUrl || chapterExists.imageUrl,
		},
	});

	return chapter;
};
