import { prisma } from "../../models/prisma";
import { CreatePagesRequest } from "../../types/pages/create";
import { uploadFile } from "../../util/upload-file";

export const createPages = async (userId: number, organizationSlug: string, mangaSlug: string, chapterNumber: number, params: CreatePagesRequest) => {
    const chapterExists = await prisma.chapter.findFirst({
        include: {
            pages: {
                take: 1,
                orderBy: {
                    number: 'desc',
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

    const images = await Promise.all(params.images.map(async (image, index) => {
        const imageBuffer = await image.arrayBuffer();
        const imageUrl = await uploadFile(imageBuffer, image.name);

        const page = await prisma.page.create({
            data: {
                number: (chapterExists.pages?.[0]?.number ?? 0) + index + 1,
                imageUrl,
                chapterId: chapterExists.id,
            },
        });

        return page;
    }));

    return images;
};
