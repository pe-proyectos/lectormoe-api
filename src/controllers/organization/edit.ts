import { prisma } from "../../models/prisma";
import { EditOrganizationRequest } from "../../types/organization/edit";

export const editOrganization = async (organizationId: number, params: EditOrganizationRequest) => {
	await prisma.organization.update({
		where: {
			id: organizationId,
		},
		data: {
			name: params.name,
			title: params.title,
			description: params.description,
			language: params.language,
			enableMangaSection: params.enableMangaSection,
			enableManhuaSection: params.enableManhuaSection,
			enableManhwaSection: params.enableManhwaSection,

			enableDiscordWebhookNewChapter: params.enableDiscordWebhookNewChapter,
			discordWebhookUrlNewChapter: params.discordWebhookUrlNewChapter,
			discordWebhookMessageTemplateNewChapter: params.discordWebhookMessageTemplateNewChapter,

			enableDiscordWebhookNewSubscription: params.enableDiscordWebhookNewSubscription,
			discordWebhookUrlNewSubscription: params.discordWebhookUrlNewSubscription,
			discordWebhookMessageTemplateNewSubscription: params.discordWebhookMessageTemplateNewSubscription,

			enableMainSlider: params.enableMainSlider,
			enableMainBanner: params.enableMainBanner,
			enableSubscriptionSection: params.enableSubscriptionSection,
			// Anuncios y NSFW ya NO se controlan por scan: los gestiona la
			// plataforma. Se ignoran aunque vengan en el body (no se actualizan
			// aquí para no re-clasificar scans por error).
			facebookUrl: params.facebookUrl,
			twitterUrl: params.twitterUrl,
			instagramUrl: params.instagramUrl,
			youtubeUrl: params.youtubeUrl,
			patreonUrl: params.patreonUrl,
			tiktokUrl: params.tiktokUrl,
			discordUrl: params.discordUrl,
			twitchUrl: params.twitchUrl,
			useBlockedCountries: params.useBlockedCountries,
			useAllowedCountries: params.useAllowedCountries,
			monitorWebsiteId: params.monitorWebsiteId,
			// No actualizar URLs de imágenes aquí si viene un fileKey válido, se manejan abajo
			// Solo actualizar si viene null explícito (para limpiar)
			...((params.logo === null) ? { logoUrl: null } : {}),
			...((params.image === null) ? { imageUrl: null } : {}),
			...((params.banner === null) ? { bannerUrl: null } : {}),
			...((params.favicon === null) ? { faviconUrl: null } : {}),
		},
	});

	// Si viene un logo, procesarlo
	if (params.logo && typeof params.logo === 'string') {
		// Si ya es una URL completa, mantenerla como está (archivo existente)
		// Si es un fileKey, construir la URL completa
		const logoUrl = params.logo.startsWith('http') 
			? params.logo 
			: `${Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com'}/${params.logo}`;
		await prisma.organization.update({
			where: {
				id: organizationId,
			},
			data: {
				logoUrl,
			},
		});
	}

	// Si viene un image, procesarlo
	if (params.image && typeof params.image === 'string') {
		// Si ya es una URL completa, mantenerla como está (archivo existente)
		// Si es un fileKey, construir la URL completa
		const imageUrl = params.image.startsWith('http') 
			? params.image 
			: `${Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com'}/${params.image}`;
		await prisma.organization.update({
			where: {
				id: organizationId,
			},
			data: {
				imageUrl,
			},
		});
	}

	// Si viene un banner, procesarlo
	if (params.banner && typeof params.banner === 'string') {
		// Si ya es una URL completa, mantenerla como está (archivo existente)
		// Si es un fileKey, construir la URL completa
		const bannerUrl = params.banner.startsWith('http') 
			? params.banner 
			: `${Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com'}/${params.banner}`;
		await prisma.organization.update({
			where: {
				id: organizationId,
			},
			data: {
				bannerUrl,
			},
		});
	}

	// Si viene un favicon, procesarlo
	if (params.favicon && typeof params.favicon === 'string') {
		// Si ya es una URL completa, mantenerla como está (archivo existente)
		// Si es un fileKey, construir la URL completa
		const faviconUrl = params.favicon.startsWith('http') 
			? params.favicon 
			: `${Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com'}/${params.favicon}`;
		await prisma.organization.update({
			where: {
				id: organizationId,
			},
			data: {
				faviconUrl,
			},
		});
	}

	if (params.countryOptions) {
		await prisma.countryOptions.deleteMany({
			where: {
				organizationId,
			},
		});
		for (const countryOption of params.countryOptions) {
			await prisma.countryOptions.create({
				data: {
					organizationId,
					countryCode: countryOption.countryCode,
					language: countryOption.language,
					countryName: countryOption.countryName,
					allowed: countryOption.allowed,
					blocked: countryOption.blocked,
				},
			});
		}
	}

	return await prisma.organization.findUnique({
		where: {
			id: organizationId,
		}
	});
};
