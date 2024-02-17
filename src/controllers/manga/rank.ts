import prisma from "../../models/prisma";


export const createRanking = async (manga_slug: string, rank: string, comment: string, user_id?: number) => {
	if (["C", "B", "A", "S"].indexOf(rank) === -1) {
		throw new Error("La calificación no es válida. (C, B, A, S)");
	}
	const connectsUser = user_id ?
		{
			user: {
				connect: {
					id: user_id
				}
			}
		} : {};
	if (user_id) {
		const exists = await prisma.ranking.findFirst({
			where: {
				manga: {
					slug: manga_slug
				},
				user_id
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
					slug: manga_slug
				}
			},
			...connectsUser
		}
	});
}
