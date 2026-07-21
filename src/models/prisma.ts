import { PrismaClient } from "../prisma-generated/client";
export { Prisma } from "../prisma-generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Crear el pool de conexiones de PostgreSQL.
// El default de `pg` es max: 10. Se quedaba corto: el dashboard del admin
// lanza 8+ consultas en paralelo (Promise.all), así que una sola carga dejaba
// el pool sin cupo y TODAS las demás peticiones del sitio quedaban encoladas
// esperando conexión (de ahí que todo respondiera en 2-30s). Postgres acepta
// max_connections=100 y se usaban ~11, así que hay margen de sobra.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: Number(process.env.DB_POOL_MAX ?? 25),
  idleTimeoutMillis: 30_000,
  // Falla rápido en vez de encolar indefinidamente si el pool se satura.
  connectionTimeoutMillis: 15_000,
});

pool.on('error', (err) => {
  console.error('[pg pool] error en conexión inactiva:', err.message);
});

// Crear el adaptador con el pool
const adapter = new PrismaPg(pool);

// Crear el cliente de Prisma con el adaptador
export const prisma = new PrismaClient({ adapter });
