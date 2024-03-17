import { prisma } from "../../models/prisma";


export const createRanking = async (mangaSlug: string, rank: string, comment: string, userId?: number) => {
	if (["C", "B", "A", "S"].indexOf(rank) === -1) {
		throw new Error("La calificación no es válida. (C, B, A, S)");
	}
	const connectsUser = userId ?
		{
			user: {
				connect: {
					id: userId
				}
			}
		} : {};
	if (userId) {
		const exists = await prisma.ranking.findFirst({
			where: {
				manga: {
					slug: mangaSlug
				},
				userId
			}
		});
		if (exists) {
			throw new Error("Ya has calificado este manga.");
		}
	}
	return await prisma.ranking.create({
		data: {
			rank,
			comment,
			manga: {
				connect: {
					slug: mangaSlug
				}
			},
			...connectsUser
		}
	});
}
