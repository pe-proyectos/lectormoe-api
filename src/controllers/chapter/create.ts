import { prisma } from "../../models/prisma";
import type { CreateChapterRequest } from "../../types/chapter/create";
import { notifyNewChapter } from "../../services/notify-new-chapter";

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

	// If this org is an ACCEPTED member of an active joint for this manga,
	// chapters must be uploaded via the joint admin so they reach every member.
	// INVITED (not yet accepted) orgs are not bound and can still upload solo.
	const activeJoint = await prisma.mangaJoint.findFirst({
		where: {
			mangaId: mangaCustom.mangaId,
			deletedAt: null,
			members: { some: { organizationId, status: 'ACCEPTED' } },
		},
		select: { slug: true },
	});
	if (activeJoint) {
		throw new Error(
			`Este manga es parte del joint "${activeJoint.slug}". Sube los capítulos desde el admin del joint para que lleguen a todos los scans participantes.`
		);
	}

	const chapterExists = await prisma.chapter.findFirst({
		where: {
			number: params.number,
			mangaCustomId: mangaCustom.id,
			deletedAt: null,
		}
	});

	if (chapterExists) {
		throw new Error(`El capítulo ${params.number} ya existe`);
	}

	// Clear soft-deleted siblings so the (number, mangaCustomId) unique constraint
	// doesn't block re-creating a chapter number after a delete.
	const staleDeleted = await prisma.chapter.findMany({
		where: { mangaCustomId: mangaCustom.id, number: params.number, deletedAt: { not: null } },
		select: { id: true },
	});
	if (staleDeleted.length > 0) {
		const ids = staleDeleted.map(s => s.id);
		await prisma.page.deleteMany({ where: { chapterId: { in: ids } } });
		await prisma.userChapterHistory.deleteMany({ where: { chapterId: { in: ids } } });
		await prisma.viewsHistory.deleteMany({ where: { chapterId: { in: ids } } });
		await prisma.chapter.deleteMany({ where: { id: { in: ids } } });
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
			// Text-based chapters (novels, books) carry markdown instead of pages.
			...(params.bodyMarkdown !== undefined ? { bodyMarkdown: params.bodyMarkdown } : {}),
		},
	});

	if (params.pages) {
		await prisma.page.createMany({
			data: params.pages.map((page, index) => {
				const pageUrl = page.startsWith('http')
					? page
					: `${r2PublicUrl}/${page}`;
				return {
					imageUrl: pageUrl,
					number: index + 1,
					chapterId: chapter.id,
					imageHeight: 100,
					imageWidth: 100,
					imageType: "any",
					isSinglePage: params.singlePages?.includes(index) ?? false,
				};
			}),
		});
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
			.replaceAll("%scan%", `${mangaCustom.organization.name || ''}`)
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

	// Notify users who favorited / user-listed this manga (fire-and-forget).
	// Email is dispatched 30 min later by the notification cron if still unread.
	if (!params.isUnreleased) {
		notifyNewChapter({ chapterId: chapter.id, mangaCustomId: chapter.mangaCustomId }).catch(console.error);
	}

	return chapter;
};
