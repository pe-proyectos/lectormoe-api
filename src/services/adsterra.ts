// Adsterra Publishers API v3
// Docs: https://docs.adsterratools.com/public/v3/publishers-api
//
// Endpoints we use:
//   GET https://api3.adsterratools.com/publisher/stats.json
//     ?start_date=YYYY-MM-DD&finish_date=YYYY-MM-DD&group_by=date
//   The response shape returns rows with a `revenue` field.

const ADSTERRA_FALLBACK_KEY = 'a4a73929c91104b88d1a2b7d84c1c847';
const ADSTERRA_API_BASE = 'https://api3.adsterratools.com/publisher';

function getApiKey(): string {
  return process.env.ADSTERRA_API_KEY ?? ADSTERRA_FALLBACK_KEY;
}

interface AdsterraStatsRow {
  revenue?: number | string;
  [k: string]: unknown;
}

interface AdsterraStatsResponse {
  items?: AdsterraStatsRow[];
  data?: AdsterraStatsRow[];
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * Fetch total Adsterra revenue (USD) for the given calendar month.
 * @param year e.g. 2026
 * @param monthIndex 0-indexed (0 = January, like Date.prototype.getMonth())
 */
export async function fetchAdsterraRevenue(year: number, monthIndex: number): Promise<number> {
  const apiKey = getApiKey();
  // First day of month -> last day of month (UTC, inclusive)
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const finish = new Date(Date.UTC(year, monthIndex + 1, 0));

  const url = `${ADSTERRA_API_BASE}/stats.json?start_date=${formatDate(start)}&finish_date=${formatDate(finish)}&group_by=date`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-API-Key': apiKey,
      },
    });

    if (!res.ok) {
      console.error(`[Adsterra] Stats request failed ${res.status} ${res.statusText}`);
      return 0;
    }

    const json = (await res.json()) as AdsterraStatsResponse;
    const rows = json.items ?? json.data ?? [];

    let total = 0;
    for (const row of rows) {
      const v = typeof row.revenue === 'string' ? parseFloat(row.revenue) : (row.revenue ?? 0);
      if (Number.isFinite(v)) total += v as number;
    }

    console.log(`[Adsterra] ${year}-${pad2(monthIndex + 1)} total revenue: $${total.toFixed(2)} (${rows.length} rows)`);
    return total;
  } catch (err) {
    console.error('[Adsterra] Error fetching stats:', err);
    return 0;
  }
}
