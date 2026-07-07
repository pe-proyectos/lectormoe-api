import { prisma } from "../models/prisma";

const result = await prisma.organization.update({
	where: { slug: "shojopapers" },
	data: { slug: "hachimitsu-tsuki" },
	select: { id: true, name: true, slug: true },
});

console.log("Actualizado:", result);
await prisma.$disconnect();
process.exit(0);
