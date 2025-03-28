import { prisma } from "../../models/prisma";

export const listTransactions = async (organizationId: number) => {
	const transactions = await prisma.organizationTransaction.findMany({
		where: {
			organizationId: organizationId,
		},
		orderBy: {
			transactionDate: "desc",
		},
	});

	return {
		data: transactions,
	};
};
