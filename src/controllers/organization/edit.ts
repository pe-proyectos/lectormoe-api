import { prisma } from "../../models/prisma";
import { EditOrganizationRequest } from "../../types/organization/edit";
import { uploadFile } from "../../util/upload-file";

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
			enableGoogleAds: params.enableGoogleAds,
			enableAdsterraAds: params.enableAdsterraAds,
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
			...params.logo && params.logo instanceof File ? {} : {
				logoUrl: params.logo === "null" ? null : params.logo,
			},
			...params.image && params.image instanceof File ? {} : {
				imageUrl: params.image === "null" ? null : params.image,
			},
			...params.banner && params.banner instanceof File ? {} : {
				bannerUrl: params.banner === "null" ? null : params.banner,
			},
			...params.favicon && params.favicon instanceof File ? {} : {
				faviconUrl: params.favicon === "null" ? null : params.favicon,
			},
		},
	});

	if (params.logo && params.logo instanceof File) {
		const logoBuffer = await params.logo.arrayBuffer();
		const logoUrl = await uploadFile(logoBuffer, params.logo.name, undefined, organizationId, 'organizations');
		await prisma.organization.update({
			where: {
				id: organizationId,
			},
			data: {
				logoUrl,
			},
		});
	} else if (params.logo && typeof params.logo === 'string' && params.logo !== 'null') {
		// If it's a fileKey (just the filename), construct the full URL
		const publicEndpoint = Bun.env.FILE_DOWNLOAD_ENDPOINT 
			|| `https://pub-${Bun.env.R2_ACCOUNT_ID}.r2.dev`;
		const logoUrl = params.logo.startsWith('http') 
			? params.logo 
			: `${publicEndpoint}/${params.logo}`;
		await prisma.organization.update({
			where: {
				id: organizationId,
			},
			data: {
				logoUrl,
			},
		});
	}

	if (params.image && params.image instanceof File) {
		const imageBuffer = await params.image.arrayBuffer();
		const imageUrl = await uploadFile(imageBuffer, params.image.name, undefined, organizationId, 'organizations');
		await prisma.organization.update({
			where: {
				id: organizationId,
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
		await prisma.organization.update({
			where: {
				id: organizationId,
			},
			data: {
				imageUrl,
			},
		});
	}

	if (params.banner && params.banner instanceof File) {
		const bannerBuffer = await params.banner.arrayBuffer();
		const bannerUrl = await uploadFile(bannerBuffer, params.banner.name, undefined, organizationId, 'organizations');
		await prisma.organization.update({
			where: {
				id: organizationId,
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
		await prisma.organization.update({
			where: {
				id: organizationId,
			},
			data: {
				bannerUrl,
			},
		});
	}

	if (params.favicon && params.favicon instanceof File) {
		const faviconBuffer = await params.favicon.arrayBuffer();
		const faviconUrl = await uploadFile(faviconBuffer, params.favicon.name, undefined, organizationId, 'organizations');
		await prisma.organization.update({
			where: {
				id: organizationId,
			},
			data: {
				faviconUrl,
			},
		});
	} else if (params.favicon && typeof params.favicon === 'string' && params.favicon !== 'null') {
		const publicEndpoint = Bun.env.FILE_DOWNLOAD_ENDPOINT 
			|| `https://pub-${Bun.env.R2_ACCOUNT_ID}.r2.dev`;
		const faviconUrl = params.favicon.startsWith('http') 
			? params.favicon 
			: `${publicEndpoint}/${params.favicon}`;
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
