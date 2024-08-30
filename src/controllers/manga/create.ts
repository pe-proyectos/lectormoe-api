import { prisma } from "../../models/prisma";
import { toSlug } from "../../util/slug";
import type { CreateMangaRequest } from "../../types/manga/create";

export const createManga = async (params: CreateMangaRequest) => {
	const slug = toSlug(params.title);

	const [authors, demography, mangaExists] = await Promise.all([
		prisma.author.findMany({
			where: {
				id: {
					in: params.authorIds,
				}
			},
		}),
		prisma.demography.findFirst({
			where: {
				id: params.demographyId,
			},
		}),
		prisma.manga.findFirst({
			select: {
				id: true,
			},
			where: {
				slug,
			},
		}),
	]);

	if (authors.length !== params.authorIds.length) {
		throw new Error("No se encontraron todos los autores");
	}

	if (!demography) {
		throw new Error("No se encontró la demografía");
	}

	if (mangaExists) {
		throw new Error(`Ya existe un manga con el título '${params.title}'`);
	}

	const manga = await prisma.manga.create({
		data: {
			title: params.title,
			slug,
			bookTypeId: params.bookTypeId,
			shortDescription: params.shortDescription,
			description: params.description,
			demographyId: params.demographyId,
			authors: {
				connect: authors.map((author) => ({
					id: author.id,
				})),
			},
		}
	});

	return manga;
};
