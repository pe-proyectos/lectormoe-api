import { prisma } from "./src/models/prisma";

async function test() {
  try {
    const users = await prisma.user.findMany();
    console.log("✅ Prisma funciona correctamente!");
    console.log(`Encontrados ${users.length} usuarios`);
    await prisma.$disconnect();
  } catch (error) {
    console.error("❌ Error:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

test();