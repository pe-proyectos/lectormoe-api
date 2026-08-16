import { prisma } from "../../models/prisma";
import type { CreateMangaCustomRequest } from "../../types/manga-custom/create";
import { notifyNewManga } from "../../services/notify-new-chapter";

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

	// Buscar incluyendo BORRADOS: el índice único (mangaId, organizationId) no
	// distingue por deletedAt, así que si el scan borró (borrado suave) un manga
	// de esta misma obra, crear otro fallaría con "Unique constraint failed".
	// Si existe uno activo -> error normal; si existe uno borrado -> se reactiva
	// con los datos nuevos en vez de intentar crear un duplicado.
	const existing = await prisma.mangaCustom.findFirst({
		select: {
			id: true,
			deletedAt: true,
		},
		where: {
			mangaId: params.mangaId,
			organizationId: organization.id,
		},
	});

	if (existing && !existing.deletedAt) {
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

	const data = {
		status: params.status || 'ongoing',
		title: params.title,
		alternativeTitle: params.alternativeTitle?.trim() || null,
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
	};

	const mangaCustom = existing
		? await prisma.mangaCustom.update({
			// Reactiva el borrado suave con los datos nuevos (evita el choque con
			// el índice único al recrear una obra que se había borrado).
			where: { id: existing.id },
			data: { ...data, deletedAt: null },
		})
		: await prisma.mangaCustom.create({
			data: {
				...data,
				mangaId: manga.id,
				organizationId: organization.id,
			},
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

	// Notify organization followers (fire-and-forget). Email dispatched 30 min
	// later by the notification cron if still unread.
	notifyNewManga(mangaCustom.id, organizationId).catch(console.error);

	return mangaCustom;
};
