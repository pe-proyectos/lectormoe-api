import { prisma } from "../../models/prisma";
import type { CreateChapterRequest } from "../../types/chapter/create";
import { uploadFile } from "../../util/upload-file";
import sizeOf from "buffer-image-size";

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
					enableDiscordWebhookNewChapter: true,
					discordWebhookUrlNewChapter: true,
					name: true,
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

	const chapter = await prisma.chapter.create({
		data: {
			mangaCustomId: mangaCustom.id,
			number: params.number,
			title: params.title,
			releasedAt: params?.releasedAt,
			subscribersOnly: params?.subscribersOnly,
		},
	});

	if (params.image && params.image instanceof File) {
		const imageBuffer = await params.image.arrayBuffer();
		const imageUrl = await uploadFile(imageBuffer, params.image.name);
		await prisma.chapter.update({
			where: {
				id: chapter.id,
			},
			data: {
				imageUrl,
			},
		});
	}

	if (params.pages) {
		await Promise.all(params.pages.map(async (page, index) => {
			if (page instanceof File) {
				const pageBuffer = await page.arrayBuffer();
				const pageSize = sizeOf(Buffer.from(pageBuffer));
				const pageUrl = await uploadFile(pageBuffer, page.name);
				await prisma.page.create({
					data: {
						imageUrl: pageUrl,
						number: index + 1,
						chapterId: chapter.id,
						imageWidth: pageSize.width,
						imageHeight: pageSize.height,
						imageType: pageSize.type,
						//@ts-ignore
						isSinglePage: params.singlePages?.includes(index) ?? false,
					},
				})
			}
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
			const message = {
				username: "📢 Botcito - Nuevos Capítulos",
				embeds: [
					{
						title: `📖 Nuevo Capítulo Disponible:`,
						description: `El manga **${mangaCustom.manga?.title || mangaSlug}** acaba de estrenar un nuevo capítulo.`,
						color: 0x5865f2,
						fields: [
							{
								name: "📚 Capítulo:",
								value: `${chapter.title || `Capítulo ${chapter.number}`}`,
								inline: true,
							},
							{
								name: "🕒 Fecha de publicación:",
								value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
								inline: true,
							},
						],
						footer: {
							text: `🔥 Leído en ${mangaCustom.organization.name}`,
						},
						timestamp: new Date().toISOString(),
						url: `${process.env.FRONTEND_URL}`,
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

	return chapter;
};
