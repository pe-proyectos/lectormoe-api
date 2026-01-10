import { prisma, Prisma } from "../../models/prisma";

export const listTransactions = async (organizationId: number) => {
	const transactions = await prisma.organizationTransaction.findMany({
		where: {
			organizationId: organizationId,
		},
		orderBy: {
			transactionDate: Prisma.SortOrder.desc,
		},
	});

	return {
		data: transactions,
	};
};
