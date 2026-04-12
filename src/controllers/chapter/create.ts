import { prisma } from "../../models/prisma";
import type { CreateChapterRequest } from "../../types/chapter/create";
import { sendNewChapterAlert } from "../../services/email-notifications";

export const createChapter = async (organizationId: number, mangaSlug: string, params: CreateChapterRequest) => {
	const mangaCustom = await prisma.mangaCustom.findFirst({
		where: {
			manga: { slug: mangaSlug },
			organization: { id: organizationId },
		},
		include: {	
			manga: {
				select: {
					title: true,
					slug: true,
				},
			},
			organization: {
				select: {
					name: true,
					slug: true,
					enableDiscordWebhookNewChapter: true,
					discordWebhookUrlNewChapter: true,
					discordWebhookMessageTemplateNewChapter: true,
				},
			},
		},
	});


	if (!mangaCustom) {
		throw new Error("No se encontró el manga");
	}

	const chapterExists = await prisma.chapter.findFirst({
		where: {
			number: params.number,
			mangaCustomId: mangaCustom.id,
		}
	});

	if (chapterExists) {
		throw new Error(`El capítulo ${params.number} ya existe`);
	}

	// Construir imageUrl desde fileKey
	let imageUrl: string | null = null;
	const r2PublicUrl = Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com';

	if (params.image && typeof params.image === 'string') {
		imageUrl = params.image.startsWith('http') 
			? params.image 
			: `${r2PublicUrl}/${params.image}`;
	}

		let chapter = await prisma.chapter.create({
		data: {
			mangaCustomId: mangaCustom.id,
			number: params.number,
			title: params.title,
			releasedAt: params.isUnreleased === true ? null : (params?.releasedAt || new Date()),
			imageUrl,
			isUnreleased: params.isUnreleased ?? false,
		},
	});

	if (params.pages) {
		await Promise.all(params.pages.map(async (page, index) => {
			// Las páginas son fileKeys o URLs que vienen del frontend
			const pageUrl = page.startsWith('http') 
				? page 
				: `${r2PublicUrl}/${page}`;
			
			// Crear página con URL - dimensiones por defecto
			await prisma.page.create({
				data: {
					imageUrl: pageUrl,
					number: index + 1,
					chapterId: chapter.id,
					imageHeight: 100, // Dimensiones por defecto
					imageWidth: 100,
					imageType: "any",
					//@ts-ignore
					isSinglePage: params.singlePages?.includes(index) ?? false,
				},
			})
		}));
	}

	await prisma.mangaCustom.update({
		where: {
			id: mangaCustom.id,
		},
		data: {
			lastChapterAt: new Date(),
		},
	});

	if (mangaCustom.organization.enableDiscordWebhookNewChapter && mangaCustom.organization.discordWebhookUrlNewChapter) {
		try {
			const description = (mangaCustom.organization.discordWebhookMessageTemplateNewChapter)
			?.replaceAll("%manga%", `${mangaCustom.manga?.title || mangaSlug || 'manga no encontrado'}`)
			.replaceAll("%chapter%", `${chapter.number}`)
			.replaceAll("%chapter_title%", `${chapter.title || ''}`)
			.replaceAll("%link%", `https://capibaratraductor.com/${mangaCustom.organization.slug}/manga/${mangaSlug}/chapters/${chapter.number}`)
			const message = {
				username: `${mangaCustom.organization.name}`,
				embeds: [
					{
						title: "📣 - Nuevo capítulo publicado",
						description: description,
						color: 0x00b0f4,
						image: {
							url:chapter?.imageUrl|| mangaCustom?.imageUrl,
						},
						timestamp: new Date().toISOString(),
					},
				],
			};

			await fetch(mangaCustom.organization.discordWebhookUrlNewChapter, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(message),
			});
		} catch (error) {
			console.error("Error al enviar el mensaje a Discord:", error);
		}
	}

	// Send email notification to users who favorited this manga (fire-and-forget)
	if (!params.isUnreleased) {
		sendNewChapterAlert(mangaCustom.id, chapter.id, organizationId).catch(console.error);
	}

	return chapter;
};
