import { prisma } from "../../models/prisma";
import { toSlug } from "../../util/slug";
import type { CreateGenreRequest } from "../../types/genre/create";

export const createGenre = async (organizationId: number, params: CreateGenreRequest) => {
	const slug = toSlug(params.name);

	const genreExists = await prisma.genre.findFirst({
		where: {
			slug,
			organizationId,
		},
	});

	if (genreExists) {
		throw new Error(`Ya existe un género con el nombre '${params.name}'`);
	}

	const genre = await prisma.genre.create({
		data: {
			name: params.name,
			description: params.description || '',
			slug,
			organizationId,
		}
	});

	return genre;
};
