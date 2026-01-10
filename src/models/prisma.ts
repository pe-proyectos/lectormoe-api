import { PrismaClient } from "../prisma-generated/client";
export { Prisma } from "../prisma-generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Crear el pool de conexiones de PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

// Crear el adaptador con el pool
const adapter = new PrismaPg(pool);

// Crear el cliente de Prisma con el adaptador
export const prisma = new PrismaClient({ adapter });
