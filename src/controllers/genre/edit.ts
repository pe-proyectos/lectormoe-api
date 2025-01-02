import { prisma } from "../../models/prisma";
import { toSlug } from "../../util/slug";
import type { EditGenreRequest } from "../../types/genre/edit";

export const editGenre = async (organizationId: number, genreSlug: string, params: EditGenreRequest) => {
	const slug = toSlug(params.name);

	const genreExists = await prisma.genre.findFirst({
		where: {
			slug,
			organizationId,
		},
	});

	if (genreExists && genreExists.slug !== genreSlug) {
		throw new Error(`Ya existe un género con el nombre '${params.name}'`);
	}

	const updatedGenre = await prisma.genre.update({
		where: {
			organizationId_slug: {
				organizationId,
				slug: genreSlug,
			}
		},
		data: {
			name: params.name,
			description: params.description || '',
			slug,
		}
	});

	return updatedGenre;
};
