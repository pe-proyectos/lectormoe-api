import { prisma } from "../../models/prisma";

export const listGenre = async (organizationId: number) => {
	return await prisma.genre.findMany({
		where: {
			organizationId,
			display: true
		},
		orderBy: {
			name: 'asc'
		},
		select: {
			id: true,
			name: true,
			description: true,
			slug: true,
			display: true,
			createdAt: true,
			updatedAt: true,
			organizationId: true,
			_count: {
				select: {
					mangasCustom: true
				}
			}
		}
	});
};
