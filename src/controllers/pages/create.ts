import sizeOf from "buffer-image-size";
import { prisma, Prisma } from "../../models/prisma";
import type { CreatePagesRequest } from "../../types/pages/create";
import { uploadFile } from "../../util/upload-file";

export const createPages = async (organizationId: number, mangaSlug: string, chapterNumber: number, params: CreatePagesRequest) => {
    const chapterExists = await prisma.chapter.findFirst({
        include: {
            pages: {
                take: 1,
                orderBy: {
                    number: Prisma.SortOrder.desc,
                },
            },
        },
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

    const images = await Promise.all(params.images.map(async (image, index) => {
        const imageBuffer = await image.arrayBuffer();
        const imageUrl = await uploadFile(imageBuffer, image.name, undefined, organizationId, 'chapters');
        const pageSize = sizeOf(Buffer.from(imageBuffer));

        let isSinglePage = false;
        if (typeof params.singlePages === 'string') {
            isSinglePage = params.singlePages.split(',').some(page => page === String(index));
        } else if (Array.isArray(params.singlePages)) {
            isSinglePage = params.singlePages.some(page => String(page) === String(index));
        }

        const page = await prisma.page.create({
            data: {
                number: (chapterExists.pages?.[0]?.number ?? 0) + index + 1,
                imageUrl,
                chapterId: chapterExists.id,
                imageWidth: pageSize.width,
                imageHeight: pageSize.height,
                imageType: pageSize.type,
                isSinglePage: isSinglePage,
            },
        });

        return page;
    }));

    return images;
};
