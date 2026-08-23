import { prisma, Prisma } from "../../models/prisma";

// Catálogo GLOBAL de géneros (organizationId = null). Deduplicado y curado,
// compartido por todos los scans. Ya no se filtra por organización.
export const listGenre = async () => {
	return await prisma.genre.findMany({
		where: {
			organizationId: null,
			display: true
		},
		orderBy: {
			name: Prisma.SortOrder.asc,
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
