import { prisma } from "../../models/prisma";
import { toSlug } from "../../util/slug";
import type { CreateAuthorRequest } from "../../types/author/create";

export const createAuthor = async (params: CreateAuthorRequest, organizationId?: number) => {
	const slug = toSlug(params.name);

	const [authorExists] = await Promise.all([
		prisma.author.findFirst({
			where: {
				slug,
			},
		}),
	]);

	if (authorExists) {
		throw new Error(`Ya existe un autor con el nombre '${params.name}'`);
	}

	let imageUrl: string | null = null;

	// Si hay imagen, construir la URL completa desde el fileKey
	if (params.image && typeof params.image === 'string') {
		// Si ya es una URL completa, mantenerla
		if (params.image.startsWith('http')) {
			imageUrl = params.image;
		} else {
			// Si es un fileKey, construir la URL usando R2_PUBLIC_URL
			const r2PublicUrl = Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com';
			imageUrl = `${r2PublicUrl}/${params.image}`;
		}
	}

	const author = await prisma.author.create({
		data: {
			name: params.name,
			slug,
			shortDescription: params.shortDescription,
			description: params.description,
			imageUrl,
		}
	});

	return author;
};
