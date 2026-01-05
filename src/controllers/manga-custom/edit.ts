import { prisma } from "../../models/prisma";
import type { EditMangaCustomRequest } from "../../types/manga-custom/edit";
import { uploadFile } from "../../util/upload-file";

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
	
	await prisma.mangaCustom.update({
		where: {
			id: mangaCustom.id,
		},
		data: {
			status: params.status,
			title: params.title,
			shortDescription: params.shortDescription,
			description: params.description,
			releasedAt: params.releasedAt,
			nextChapterAt: params.nextChapterAt,
			requireLogin: params.requireLogin,
			isSimulRelease: params.isSimulRelease,
			isNSFW: params.isNSFW,
			...params.image && params.image instanceof File ? {} : {
				imageUrl: params.image === "null" ? null : params.image,
			},
			...params.banner && params.banner instanceof File ? {} : {
				bannerUrl: params.banner === "null" ? null : params.banner,
			},
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
	} else if (params.image && typeof params.image === 'string' && params.image !== 'null') {
		const publicEndpoint = Bun.env.FILE_DOWNLOAD_ENDPOINT 
			|| `https://pub-${Bun.env.R2_ACCOUNT_ID}.r2.dev`;
		const imageUrl = params.image.startsWith('http') 
			? params.image 
			: `${publicEndpoint}/${params.image}`;
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
	} else if (params.banner && typeof params.banner === 'string' && params.banner !== 'null') {
		const publicEndpoint = Bun.env.FILE_DOWNLOAD_ENDPOINT 
			|| `https://pub-${Bun.env.R2_ACCOUNT_ID}.r2.dev`;
		const bannerUrl = params.banner.startsWith('http') 
			? params.banner 
			: `${publicEndpoint}/${params.banner}`;
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

	return await prisma.mangaCustom.findFirst({ where: { id: mangaCustom.id } });
};
