import { Elysia } from 'elysia';
import { cron } from '@elysiajs/cron';
import { computeMonthlyAdRevenue, persistMonthlyAdRevenue } from '../../services/ad-revenue';

async function runMonthlyAdRevenue() {
  const now = new Date();
  // Last completed calendar month (server-local).
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = prev.getFullYear();
  const monthIndex = prev.getMonth();

  console.log(`[AdRevenue Cron] Computing for ${year}-${(monthIndex + 1).toString().padStart(2, '0')}`);

  try {
    const breakdown = await computeMonthlyAdRevenue(year, monthIndex);
    const result = await persistMonthlyAdRevenue(breakdown);
    console.log(
      `[AdRevenue Cron] Done. google=$${breakdown.totalGoogle.toFixed(2)} adsterra=$${breakdown.totalAdsterra.toFixed(2)} ` +
        `platformCut=$${breakdown.platformCut.toFixed(2)} scanPool=$${breakdown.scanPool.toFixed(2)} ` +
        `orgs=${result.total} inserted=${result.inserted} skipped=${result.skipped}`,
    );
  } catch (err) {
    console.error('[AdRevenue Cron] Failed:', err);
  }
}

export const router = () =>
  new Elysia().use(
    cron({
      name: 'monthly-ad-revenue',
      // 03:00 server-local on the 2nd of every month — calc previous month.
      pattern: '0 3 2 * *',
      run: runMonthlyAdRevenue,
    }),
  );
