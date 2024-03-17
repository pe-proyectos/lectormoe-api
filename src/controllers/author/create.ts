import { prisma } from "../../models/prisma";
import { toSlug } from "../../util/slug";
import { uploadFile } from "../../util/upload-file";
import type { CreateAuthorRequest } from "../../types/author/create";

export const createAuthor = async (params: CreateAuthorRequest) => {
	const slug = toSlug(params.name);

	const [authorExists] = await Promise.all([
		prisma.author.findFirst({
			where: {
				slug,
			},
		}),
	]);

	const imageBuffer = await params.image.arrayBuffer();
	const imageUrl = await uploadFile(imageBuffer, params.image.name);

	if (authorExists) {
		throw new Error(`Ya existe un autor con el nombre '${params.name}'`);
	}

	const manga = await prisma.author.create({
		data: {
			name: params.name,
			imageUrl,
			slug,
			shortDescription: params.shortDescription,
			description: params.description,
		}
	});

	return manga;
};
