import { prisma } from "../../models/prisma";
import type { EditMangaCustomRequest } from "../../types/manga-custom/edit";

export const editMangaCustom = async (organizationId: number, mangaSlug: string, params: EditMangaCustomRequest) => {
	const mangaCustom = await prisma.mangaCustom.findFirst({
		where: {
			id: params.mangaCustomId,
			organizationId,
			manga: {
				slug: mangaSlug,
			},
		},
	});

	if (!mangaCustom) {
		throw new Error("Tu organización no tiene este manga");
	}

	// Construir URLs desde fileKeys
	const r2PublicUrl = Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com';
	const updateData: any = {
		status: params.status,
		title: params.title,
		shortDescription: params.shortDescription,
		description: params.description,
		releasedAt: params.releasedAt,
		nextChapterAt: params.nextChapterAt,
		nextChapterAtMessage: params.nextChapterAtMessage,
		requireLogin: params.requireLogin,
		isSimulRelease: params.isSimulRelease,
		isNSFW: params.isNSFW,
	};

	// Manejar image
	if (params.image !== undefined) {
		if (params.image === null) {
			updateData.imageUrl = null;
		} else if (typeof params.image === 'string') {
			updateData.imageUrl = params.image.startsWith('http') 
				? params.image 
				: `${r2PublicUrl}/${params.image}`;
		}
	}

	// Manejar banner
	if (params.banner !== undefined) {
		if (params.banner === null) {
			updateData.bannerUrl = null;
		} else if (typeof params.banner === 'string') {
			updateData.bannerUrl = params.banner.startsWith('http') 
				? params.banner 
				: `${r2PublicUrl}/${params.banner}`;
		}
	}
	
	await prisma.mangaCustom.update({
		where: {
			id: mangaCustom.id,
		},
		data: updateData
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
			subscriptionPlans: {
				set: params?.subscriptionPlanIds?.map(subscriptionPlanId => ({
					id: subscriptionPlanId,
				})) || [],
			},
		},
	});

	return await prisma.mangaCustom.findFirst({ where: { id: mangaCustom.id } });
};
