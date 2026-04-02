import { prisma } from "../../models/prisma";
import type { CreateMangaCustomRequest } from "../../types/manga-custom/create";
import { sendNewMangaReleaseAlert } from "../../services/email-notifications";

export const createMangaCustom = async (organizationId: number, params: CreateMangaCustomRequest) => {
	const [organization, manga] = await Promise.all([
		prisma.organization.findFirst({
			where: {
				id: organizationId,
				isDeleted: false,
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
			deletedAt: null,
		},
	});

	if (mangaCustomExists) {
		throw new Error(`Tu organización ya tiene un manga basado en '${manga.title}'`);
	}

	// Construir URLs desde fileKeys
	let imageUrl: string | null = null;
	let bannerUrl: string | null = null;
	const r2PublicUrl = Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com';

	if (params.image && typeof params.image === 'string') {
		imageUrl = params.image.startsWith('http') 
			? params.image 
			: `${r2PublicUrl}/${params.image}`;
	}

	if (params.banner && typeof params.banner === 'string') {
		bannerUrl = params.banner.startsWith('http') 
			? params.banner 
			: `${r2PublicUrl}/${params.banner}`;
	}

	const mangaCustom = await prisma.mangaCustom.create({
		data: {
			mangaId: manga.id,
			organizationId: organization.id,
			status: params.status || 'ongoing',
			title: params.title,
			shortDescription: params.shortDescription,
			description: params.description,
			imageUrl,
			bannerUrl,
			releasedAt: params.releasedAt,
			nextChapterAt: params.nextChapterAt,
			nextChapterAtMessage: params.nextChapterAtMessage,
			requireLogin: params.requireLogin,
			isSimulRelease: params.isSimulRelease,
			isNSFW: params.isNSFW,
		}
	});

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
			subscriptionPlansCanReadUnreleased: {
				set: params?.subscriptionPlanIdsCanReadUnreleased?.map(subscriptionPlanId => ({
					id: subscriptionPlanId,
				})) || [],
			},
			subscriptionPlansCanReadReleased: {
				set: params?.subscriptionPlanIdsCanReadReleased?.map(subscriptionPlanId => ({
					id: subscriptionPlanId,
				})) || [],
			},
		},
	});

	// Send email notification to organization followers (fire-and-forget)
	sendNewMangaReleaseAlert(mangaCustom.id, organizationId).catch(console.error);

	return mangaCustom;
};
