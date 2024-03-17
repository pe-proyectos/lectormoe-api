import { prisma } from "../../models/prisma";
import { OrderPagesRequest } from "../../types/pages/order";

export const orderPages = async (userId: number, organizationSlug: string, mangaSlug: string, chapterNumber: number, params: OrderPagesRequest) => {
    await prisma.$transaction(async db => {
        const randomCollisionAvoider = Math.floor(Math.random() * 100) + 1;
        const pages = await db.page.findMany({
            where: {
                id: {
                    in: params.map(page => page.id)
                },
                chapter: {
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
            }
        });

        const maxPageNumber = Math.max(...pages.map(page => page.number));

        await Promise.all(pages.map(page => db.page.update({
            where: {
                id: page.id
            },
            data: {
                number: page.number + maxPageNumber + randomCollisionAvoider
            }
        })));

        await Promise.all(pages.map(page => db.page.update({
            where: {
                id: page.id
            },
            data: {
                number: params.find(p => p.id === page.id)!.order
            }
        })));
    })
};
