import { prisma } from "../../models/prisma";
import type { CreateMangaCustomRequest } from "../../types/manga-custom/create";
import { uploadFile } from "../../util/upload-file";

export const createMangaCustom = async (organizationSlug: string, params: CreateMangaCustomRequest) => {
	const [organization, manga] = await Promise.all([
		prisma.organization.findFirst({
			where: {
				slug: organizationSlug,
			},
		}),
		prisma.manga.findFirst({
			where: {
				id: params.mangaId,
			},
		}),
	]);

	if (!organization) {
		throw new Error(`No se encontró la organización`);
	}

	if (!manga) {
		throw new Error(`No se encontró el manga`);
	}

	const imageBuffer = await params.image.arrayBuffer();
	const imageUrl = await uploadFile(imageBuffer, params.image.name);

	const mangaCustomExists = await prisma.mangaCustom.findFirst({
		select: {
			id: true,
		},
		where: {
			mangaId: params.mangaId,
			organizationId: organization.id,
		},
	});

	if (mangaCustomExists) {
		throw new Error(`Ya existe un manga custom con el título '${params.title}'`);
	}

	const mangaCustom = await prisma.mangaCustom.create({
		data: {
			mangaId: manga.id,
			organizationId: organization.id,
			title: params.title,
			shortDescription: params.shortDescription,
			description: params.description,
			imageUrl,
			releasedAt: params.releasedAt,
			nextChapterAt: params.nextChapterAt,
		}
	});

	return mangaCustom;
};
