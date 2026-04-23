import { prisma, Prisma } from "../../models/prisma";

const CHAPTER_SELECT = {
	id: true,
	number: true,
	title: true,
	releasedAt: true,
};

const INCLUDE = {
	mangaCustom: {
		select: {
			id: true,
			title: true,
			imageUrl: true,
			status: true,
			isNSFW: true,
			organization: {
				select: { id: true, name: true, slug: true, isNSFW: true },
			},
			manga: { select: { slug: true } },
			chapters: {
				select: CHAPTER_SELECT,
				orderBy: { releasedAt: Prisma.SortOrder.desc },
				take: 2,
			},
		},
	},
	joint: {
		select: {
			id: true,
			slug: true,
			title: true,
			imageUrl: true,
			isNSFW: true,
			chapters: {
				where: { deletedAt: null },
				select: CHAPTER_SELECT,
				orderBy: { releasedAt: Prisma.SortOrder.desc },
				take: 2,
			},
		},
	},
};

export interface UserListQuery {
	page?: string;
	limit?: string;
}

export const listUserList = async (
	organizationId: number | null,
	userId: number,
	filters: UserListQuery,
) => {
	const whereClause: any = organizationId !== null
		? {
			userId,
			OR: [
				{ mangaCustom: { organizationId } },
				{ jointId: { not: null } },
			],
		}
		: { userId };

	const limit = Number.parseInt(filters?.limit || "10");
	const page = Number.parseInt(filters?.page || "1");

	const items = await prisma.userList.findMany({
		where: whereClause,
		include: INCLUDE,
		orderBy: [
			{ order: Prisma.SortOrder.asc },
			{ createdAt: Prisma.SortOrder.desc },
		],
		skip: filters?.page ? (page - 1) * limit : 0,
		take: limit,
	});

	const total = await prisma.userList.count({ where: whereClause });

	return {
		data: items,
		maxPage: Math.ceil(total / limit),
		total,
	};
};
