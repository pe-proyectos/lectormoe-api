import { prisma } from "../../models/prisma";
import { limitesDeUsuario } from "../../util/capibara-plans";

// El tope depende del nivel del usuario (ver util/capibara-plans). Solo se
// comprueba al AÑADIR: quien ya lo supera conserva todo y puede quitar.
async function enforceLimit(userId: number) {
	const { miLista } = await limitesDeUsuario(userId);
	if (miLista === null) return;
	const currentCount = await prisma.userList.count({ where: { userId } });
	if (currentCount >= miLista) {
		throw new Error(
			`Has alcanzado el límite de ${miLista} obras en tu lista. Mejora tu plan para guardar más.`,
		);
	}
}

export const saveUserListManga = async (
	organizationId: number | null,
	userId: number,
	mangaSlug: string,
) => {
	const whereClause: any = { manga: { slug: mangaSlug } };
	if (organizationId !== null) whereClause.organizationId = organizationId;

	const manga = await prisma.mangaCustom.findFirst({
		select: { id: true },
		where: whereClause,
	});
	if (!manga) return false;

	const existing = await prisma.userList.findFirst({
		where: { userId, mangaCustomId: manga.id },
	});
	if (existing) return true;

	await enforceLimit(userId);

	const maxOrder = await prisma.userList.aggregate({
		where: { userId },
		_max: { order: true },
	});
	await prisma.userList.create({
		data: {
			userId,
			mangaCustomId: manga.id,
			order: (maxOrder._max.order ?? 0) + 1,
		},
	});

	return true;
};

export const saveUserListJoint = async (userId: number, jointSlug: string) => {
	const joint = await prisma.mangaJoint.findFirst({
		where: { slug: jointSlug, deletedAt: null },
		select: { id: true },
	});
	if (!joint) return false;

	const existing = await prisma.userList.findFirst({
		where: { userId, jointId: joint.id },
	});
	if (existing) return true;

	await enforceLimit(userId);

	const maxOrder = await prisma.userList.aggregate({
		where: { userId },
		_max: { order: true },
	});
	await prisma.userList.create({
		data: {
			userId,
			jointId: joint.id,
			order: (maxOrder._max.order ?? 0) + 1,
		},
	});

	return true;
};
