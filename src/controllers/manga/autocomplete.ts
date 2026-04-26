import { prisma } from "../../models/prisma";

const WRITING_CODES = ['novel', 'light-novel', 'book', 'short-story'];

export const autocompleteManga = async (contentKind?: 'writing' | 'manga' | 'all') => {
	const where = contentKind === 'writing'
		? { bookType: { code: { in: WRITING_CODES } } }
		: contentKind === 'manga'
		? { bookType: { code: { notIn: WRITING_CODES } } }
		: {};
	return await prisma.manga.findMany({
		where,
		select: {
			id: true,
			title: true,
			slug: true,
			imageUrl: true,
		}
	});
};
