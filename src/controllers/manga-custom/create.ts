import { prisma } from "../../models/prisma";
import type { CreateMangaCustomRequest } from "../../types/manga-custom/create";
import { uploadFile } from "../../util/upload-file";

export const createMangaCustom = async (organizationId: number, params: CreateMangaCustomRequest) => {
	const [organization, manga] = await Promise.all([
		prisma.organization.findFirst({
			where: {
				id: organizationId,
			},
		}),
		prisma.manga.findFirst({
			where: {
				id: params.mangaId,
			},
		}),
	]);

	if (!organization) {
		throw new Error("No se encontró la organización");
	}

	if (!manga) {
		throw new Error("No se encontró el manga");
	}

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
		throw new Error(`Tu organización ya tiene un manga basado en '${manga.title}'`);
	}

	const mangaCustom = await prisma.mangaCustom.create({
		data: {
			mangaId: manga.id,
			organizationId: organization.id,
			status: params.status,
			title: params.title,
			shortDescription: params.shortDescription,
			description: params.description,
			releasedAt: params.releasedAt,
			nextChapterAt: params.nextChapterAt,
			requireLogin: params.requireLogin,
			isSimulRelease: params.isSimulRelease,
			isNSFW: params.isNSFW,
		}
	});

	if (params.image && params.image instanceof File) {
		const imageBuffer = await params.image.arrayBuffer();
		const imageUrl = await uploadFile(imageBuffer, params.image.name, undefined, organizationId, 'mangas');
		await prisma.mangaCustom.update({
			where: {
				id: mangaCustom.id,
			},
			data: {
				imageUrl,
			},
		});
	}

	if (params.banner && params.banner instanceof File) {
		const bannerBuffer = await params.banner.arrayBuffer();
		const bannerUrl = await uploadFile(bannerBuffer, params.banner.name, undefined, organizationId, 'mangas');
		await prisma.mangaCustom.update({
			where: {
				id: mangaCustom.id,
			},
			data: {
				bannerUrl,
			},
		});
	}

	await prisma.mangaCustom.update({
		where: {
			id: mangaCustom.id,
		},
		data: {
			genres: {
				set: params?.genreIds?.map(genreId => ({
					id: genreId,
				})) || [],
			},
			subscriptionPlans: {
				set: params?.subscriptionPlanIds?.map(subscriptionPlanId => ({
					id: subscriptionPlanId,
				})) || [],
			},
		},
	});

	return mangaCustom;
};
