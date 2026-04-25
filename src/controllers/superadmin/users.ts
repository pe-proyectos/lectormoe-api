import { prisma, Prisma } from "../../models/prisma";
import { sendEmailVerificationEmail } from "../../services/email-notifications";

export interface ListUsersFilters {
	page?: string;
	limit?: string;
	search?: string;
	verified?: string; // 'yes' | 'no' | undefined (all)
}

export const listUsersAdmin = async (filters: ListUsersFilters) => {
	const limit = Math.max(1, Math.min(100, Number.parseInt(filters?.limit || "20")));
	const page = Math.max(1, Number.parseInt(filters?.page || "1"));

	const where: Prisma.UserWhereInput = {};
	const q = filters?.search?.trim();
	if (q) {
		where.OR = [
			{ email: { contains: q, mode: "insensitive" } },
			{ username: { contains: q, mode: "insensitive" } },
			{ slug: { contains: q, mode: "insensitive" } },
		];
	}
	if (filters?.verified === "yes") where.emailVerified = true;
	else if (filters?.verified === "no") where.emailVerified = false;

	const [items, total] = await Promise.all([
		prisma.user.findMany({
			where,
			select: {
				id: true,
				email: true,
				username: true,
				slug: true,
				imageUrl: true,
				emailVerified: true,
				createdAt: true,
			},
			orderBy: { createdAt: Prisma.SortOrder.desc },
			skip: (page - 1) * limit,
			take: limit,
		}),
		prisma.user.count({ where }),
	]);

	return {
		items,
		total,
		maxPage: Math.max(1, Math.ceil(total / limit)),
	};
};

export const resendVerificationEmail = async (userId: number) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true, email: true, username: true, emailVerified: true },
	});
	if (!user) throw new Error("Usuario no encontrado.");
	if (user.emailVerified) throw new Error("El correo ya está verificado.");

	// Mirror the user-facing /api/auth/send-verification flow: drop any
	// outstanding token first so old links stop working.
	await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });

	const token = crypto.randomUUID();
	await prisma.emailVerificationToken.create({
		data: {
			userId: user.id,
			token,
			expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
		},
	});

	await sendEmailVerificationEmail(user.id, user.email, user.username, token);

	return { sentTo: user.email };
};
