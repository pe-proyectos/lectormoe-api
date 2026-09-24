import { prisma } from '../models/prisma';
import { fetchAdsterraRevenue } from './adsterra';
import { fetchGoogleAdsenseRevenue } from './google-adsense';
import { fetchAdcashRevenue } from './adcash';
import { fetchMonetagRevenue } from './monetag';
import { getJointParticipants } from './joint-participants';

export interface OrgPayout {
  organizationId: number;
  shares: number;
  payout: number;
}

export interface MonthlyAdRevenueBreakdown {
  year: number;
  monthIndex: number; // 0-indexed
  totalGoogle: number;
  totalAdsterra: number;
  totalAdcash: number;
  totalMonetag: number;
  platformCut: number;
  scanPool: number;
  perOrg: OrgPayout[];
}

const PLATFORM_FEE_RATE = 0.5; // platform keeps 50%

// Primer mes (indice year*12+month) en el que Adcash y Monetag forman parte
// del reparto: septiembre de 2026.

/**
 * Compute the breakdown for one calendar month. Pure function — no DB writes.
 *
 * @param year e.g. 2026
 * @param monthIndex 0-indexed month, like Date.prototype.getMonth() (0 = Jan)
 */
export async function computeMonthlyAdRevenue(
  year: number,
  monthIndex: number,
): Promise<MonthlyAdRevenueBreakdown> {
  const startOfMonth = new Date(year, monthIndex, 1);
  const startOfNextMonth = new Date(year, monthIndex + 1, 1);

  // 1. Google + Adsterra. Adcash y Monetag se reparten APARTE
  // (repartirRedMensual): sus APIs pueden no estar disponibles el dia 2 y un
  // mes guardado no se puede rehacer, asi que cada una entra cuando se puede
  // leer, con las mismas participaciones, sin retrasar ni recortar este.
  const [totalGoogle, totalAdsterra] = await Promise.all([
    fetchGoogleAdsenseRevenue(year, monthIndex),
    fetchAdsterraRevenue(year, monthIndex),
  ]);
  const totalAdcash = 0;
  const totalMonetag = 0;

  const grossTotal = totalGoogle + totalAdsterra;
  const platformCut = grossTotal * PLATFORM_FEE_RATE;
  const scanPool = grossTotal - platformCut;

  const sharesByOrg = await calcularParticipaciones(startOfMonth, startOfNextMonth);

  const totalShares = [...sharesByOrg.values()].reduce((a, b) => a + b, 0);

  const perOrg: OrgPayout[] = [];
  for (const [organizationId, shares] of sharesByOrg.entries()) {
    const payout = totalShares > 0 ? (shares / totalShares) * scanPool : 0;
    perOrg.push({ organizationId, shares, payout });
  }
  // Sort biggest payout first for nicer logs / reports.
  perOrg.sort((a, b) => b.payout - a.payout);

  return {
    year,
    monthIndex,
    totalGoogle,
    totalAdsterra,
    totalAdcash,
    totalMonetag,
    platformCut,
    scanPool,
    perOrg,
  };
}


/**
 * Participaciones de cada scan en un mes: sus vistas de obras propias, mas su
 * parte (1/n) de las vistas de los joints en los que participa.
 */
export async function calcularParticipaciones(startOfMonth: Date, startOfNextMonth: Date): Promise<Map<number, number>> {
  // 2. Solo MangaCustom views in the window grouped by mangaCustomId.
  const customViewGroups = await prisma.viewsHistory.groupBy({
    by: ['mangaCustomId'],
    where: {
      viewedAt: { gte: startOfMonth, lt: startOfNextMonth },
      mangaCustomId: { not: null },
      jointId: null,
    },
    _count: { _all: true },
  });

  // 3. Joint views grouped by jointId.
  const jointViewGroups = await prisma.viewsHistory.groupBy({
    by: ['jointId'],
    where: {
      viewedAt: { gte: startOfMonth, lt: startOfNextMonth },
      jointId: { not: null },
    },
    _count: { _all: true },
  });

  // 4. Resolve mangaCustom -> organizationId.
  const customIds = customViewGroups
    .map(g => g.mangaCustomId)
    .filter((v): v is number => v != null);
  const customs = customIds.length
    ? await prisma.mangaCustom.findMany({
        where: { id: { in: customIds } },
        select: { id: true, organizationId: true },
      })
    : [];
  const customToOrg = new Map(customs.map(c => [c.id, c.organizationId]));

  // 5. Resolve joint -> participants. Sequential to keep memory predictable
  //    even if a month has thousands of joints (typical: tens to low hundreds).
  const jointParticipants = new Map<number, Awaited<ReturnType<typeof getJointParticipants>>>();
  for (const g of jointViewGroups) {
    if (g.jointId == null) continue;
    jointParticipants.set(g.jointId, await getJointParticipants(g.jointId));
  }

  // 6. Tally shares per org.
  const sharesByOrg = new Map<number, number>();

  for (const g of customViewGroups) {
    if (g.mangaCustomId == null) continue;
    const orgId = customToOrg.get(g.mangaCustomId);
    if (!orgId) continue;
    const views = g._count._all;
    sharesByOrg.set(orgId, (sharesByOrg.get(orgId) ?? 0) + views);
  }

  for (const g of jointViewGroups) {
    if (g.jointId == null) continue;
    const participants = jointParticipants.get(g.jointId) ?? [];
    if (participants.length === 0) continue;
    const sharePerView = 1 / participants.length;
    const totalForJoint = g._count._all * sharePerView;
    for (const p of participants) {
      sharesByOrg.set(p.organizationId, (sharesByOrg.get(p.organizationId) ?? 0) + totalForJoint);
    }
  }

  return sharesByOrg;
}

/**
 * Stable transaction id for a (org, year, month) ad-revenue row.
 * Used for idempotency: the unique key the persist function checks against.
 */
export function adRevenueTransactionId(
  organizationId: number,
  year: number,
  monthIndex: number,
): string {
  const m = (monthIndex + 1).toString().padStart(2, '0');
  return `ad-rev-${year}-${m}-org-${organizationId}`;
}

export interface PersistResult {
  inserted: number;
  skipped: number;
  total: number;
}

/**
 * Persist one OrganizationTransaction per org payout. Idempotent: if a
 * transactionId already exists for (org, year, month), it is left untouched.
 * Re-running for the same month is a no-op for orgs that already have a row.
 */
export async function persistMonthlyAdRevenue(
  breakdown: MonthlyAdRevenueBreakdown,
): Promise<PersistResult> {
  const { year, monthIndex, perOrg, totalGoogle, totalAdsterra, totalAdcash, totalMonetag, platformCut, scanPool } = breakdown;
  // Use the actual run date so the transaction appears on the day the cron
  // executed (2nd of each month), not backdated to the last day of the covered
  // period. This makes the finance panel unambiguous.
  const txDate = new Date();
  const monthLabel = `${year}-${(monthIndex + 1).toString().padStart(2, '0')}`;

  let inserted = 0;
  let skipped = 0;

  for (const row of perOrg) {
    const transactionId = adRevenueTransactionId(row.organizationId, year, monthIndex);
    const existing = await prisma.organizationTransaction.findFirst({
      where: { transactionId },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.organizationTransaction.create({
      data: {
        organizationId: row.organizationId,
        origin: 'AD_REVENUE',
        amount: row.payout,
        // beforeFees = bruto generado por la obra (payout de la org + la mitad
        // de Capibara, que va como capibaraFee para que el dashboard la cuente).
        beforeFeesAmount: row.payout * 2,
        currency: 'USD',
        type: 'EARNING',
        status: 'COMPLETED',
        paymentMethod: 'AD_REVENUE',
        description: `${monthLabel} | ad revenue (google + adsterra) — shares: ${row.shares.toFixed(4)}`,
        paymentDetails: JSON.stringify({
          period: monthLabel,
          shares: row.shares,
          totalGoogle,
          totalAdsterra,
          totalAdcash,
          totalMonetag,
          platformCut,
          scanPool,
        }),
        transactionDate: txDate,
        transactionId,
        capibaraFee: row.payout,
        paypalFee: 0,
      },
    });
    inserted++;
  }

  return { inserted, skipped, total: perOrg.length };
}

export type RedAparte = 'adcash' | 'monetag';

/** Primer mes (indice year*12+month) con Adcash y Monetag: septiembre 2026. */
const REDES_APARTE_DESDE = 2026 * 12 + 8;

const FETCH_RED: Record<RedAparte, (year: number, monthIndex: number) => Promise<number>> = {
  adcash: fetchAdcashRevenue,
  monetag: fetchMonetagRevenue,
};

const TOKEN_RED: Record<RedAparte, string> = {
  adcash: 'ADCASH_API_TOKEN',
  monetag: 'MONETAG_API_TOKEN',
};

function idRed(red: RedAparte, organizationId: number, year: number, monthIndex: number) {
  const m = (monthIndex + 1).toString().padStart(2, '0');
  return `ad-rev-${red}-${year}-${m}-org-${organizationId}`;
}

/**
 * Reparte una red (Adcash o Monetag) de un mes cerrado, aparte del reparto
 * principal y con las mismas participaciones por vistas. Idempotente por
 * (red, mes, scan): si el mes ya se repartio no hace nada. Lanza si la API de
 * la red falla, para no repartir de menos.
 */
export async function repartirRedMensual(red: RedAparte, year: number, monthIndex: number) {
  const m = (monthIndex + 1).toString().padStart(2, '0');
  const monthLabel = `${year}-${m}`;
  const yaRepartido = await prisma.organizationTransaction.findFirst({
    where: { transactionId: { startsWith: `ad-rev-${red}-${monthLabel}-org-` } },
    select: { id: true },
  });
  if (yaRepartido) return { red, mes: monthLabel, total: 0, inserted: 0, yaRepartido: true };

  const total = await FETCH_RED[red](year, monthIndex);
  const scanPool = total * (1 - PLATFORM_FEE_RATE);
  const shares = await calcularParticipaciones(new Date(year, monthIndex, 1), new Date(year, monthIndex + 1, 1));
  const totalShares = [...shares.values()].reduce((a, b) => a + b, 0);
  if (scanPool <= 0 || totalShares <= 0) return { red, mes: monthLabel, total, inserted: 0, yaRepartido: false };

  const txDate = new Date();
  let inserted = 0;
  for (const [organizationId, s] of shares.entries()) {
    const payout = (s / totalShares) * scanPool;
    if (payout <= 0) continue;
    const transactionId = idRed(red, organizationId, year, monthIndex);
    const existe = await prisma.organizationTransaction.findFirst({ where: { transactionId }, select: { id: true } });
    if (existe) continue;
    await prisma.organizationTransaction.create({
      data: {
        organizationId,
        origin: 'AD_REVENUE',
        amount: payout,
        beforeFeesAmount: payout * 2,
        currency: 'USD',
        type: 'EARNING',
        status: 'COMPLETED',
        paymentMethod: 'AD_REVENUE',
        description: `${monthLabel} | ad revenue (${red}) — shares: ${s.toFixed(4)}`,
        paymentDetails: JSON.stringify({ period: monthLabel, red, shares: s, total, scanPool }),
        transactionDate: txDate,
        transactionId,
        capibaraFee: payout,
        paypalFee: 0,
      },
    });
    inserted++;
  }
  return { red, mes: monthLabel, total, inserted, yaRepartido: false };
}

/**
 * Reparte los meses cerrados de Adcash y Monetag que sigan pendientes (desde
 * septiembre 2026). Una red sin token se salta en silencio: el aviso diario
 * ya avisa de eso. Los meses se reparten en cuanto el token exista.
 */
export async function repartirRedesPendientes() {
  const ahora = new Date();
  const ultimoCerrado = ahora.getFullYear() * 12 + ahora.getMonth() - 1;
  const resultados = [];
  for (const red of ['adcash', 'monetag'] as const) {
    if (!process.env[TOKEN_RED[red]]) continue;
    for (let i = REDES_APARTE_DESDE; i <= ultimoCerrado; i++) {
      resultados.push(await repartirRedMensual(red, Math.floor(i / 12), i % 12));
    }
  }
  return resultados;
}
