import { prisma } from "../../models/prisma";


export const createRanking = async (mangaSlug: string, rank: string, comment: string, userId: number) => {
	if (["C", "B", "A", "S"].indexOf(rank) === -1) {
		throw new Error("La calificación no es válida. (C, B, A, S)");
	}
	const mangaCustomId = await prisma.mangaCustom.findFirst({
		where: {
			manga: {
				slug: mangaSlug
			}
		}
	});
	if (!mangaCustomId) {
		throw new Error("Manga no encontrado.");
	}
	const exists = await prisma.ranking.findFirst({
		where: {
			mangaCustom: {
				id: mangaCustomId.id
			},
			userId,
		}
	});
	if (exists) {
		throw new Error("Ya has calificado este manga.");
	}
	return await prisma.ranking.create({
		data: {
			rank,
			comment,
			userId,
			mangaCustomId: mangaCustomId.id,
		}
	});
}
