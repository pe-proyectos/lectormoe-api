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
const REDES_NUEVAS_DESDE = 2026 * 12 + 8;

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

  // 1. Fetch revenue from both networks in parallel.
  // Adcash y Monetag sirven el lado azul desde el 23-sep-2026 (AdSense quedo
  // restringido). Antes de ese mes no se consultan. Si fallan, se LANZA el
  // error: el reparto no se puede rehacer una vez guardado, asi que es mejor
  // detenerlo y relanzarlo que repartir de menos sin que nadie se entere.
  const usaRedesNuevas = year * 12 + monthIndex >= REDES_NUEVAS_DESDE;
  const [totalGoogle, totalAdsterra, totalAdcash, totalMonetag] = await Promise.all([
    fetchGoogleAdsenseRevenue(year, monthIndex),
    fetchAdsterraRevenue(year, monthIndex),
    usaRedesNuevas ? fetchAdcashRevenue(year, monthIndex) : Promise.resolve(0),
    usaRedesNuevas ? fetchMonetagRevenue(year, monthIndex) : Promise.resolve(0),
  ]);

  const grossTotal = totalGoogle + totalAdsterra + totalAdcash + totalMonetag;
  const platformCut = grossTotal * PLATFORM_FEE_RATE;
  const scanPool = grossTotal - platformCut;

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
        description: `${monthLabel} | ad revenue (google + adsterra + adcash + monetag) — shares: ${row.shares.toFixed(4)}`,
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
