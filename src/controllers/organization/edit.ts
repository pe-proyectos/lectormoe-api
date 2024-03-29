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
			enableGoogleAds: params.enableGoogleAds,
			enableDisqusIntegration: params.enableDisqusIntegration,
			disqusEmbedUrl: params.disqusEmbedUrl,
			facebookUrl: params.facebookUrl,
			twitterUrl: params.twitterUrl,
			instagramUrl: params.instagramUrl,
			youtubeUrl: params.youtubeUrl,
			patreonUrl: params.patreonUrl,
			tiktokUrl: params.tiktokUrl,
			discordUrl: params.discordUrl,
			twitchUrl: params.twitchUrl,
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
		const logoUrl = await uploadFile(logoBuffer, params.logo.name);
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
		const imageUrl = await uploadFile(imageBuffer, params.image.name);
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
		const bannerUrl = await uploadFile(bannerBuffer, params.banner.name);
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
		const faviconUrl = await uploadFile(faviconBuffer, params.favicon.name);
		await prisma.organization.update({
			where: {
				id: organizationId,
			},
			data: {
				faviconUrl,
			},
		});
	}

	return await prisma.organization.findUnique({
		where: {
			id: organizationId,
		}
	});
};
