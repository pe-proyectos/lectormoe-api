import { prisma } from "../models/prisma";

const result = await prisma.permission.updateMany({
	where: { canDeleteComment: true, canBanUser: false },
	data: { canBanUser: true },
});

console.log(`Actualizados: ${result.count} permisos`);
await prisma.$disconnect();
process.exit(0);
