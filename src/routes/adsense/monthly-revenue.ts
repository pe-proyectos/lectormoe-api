// DEPRECATED: superseded by routes/ad-revenue/cron.ts which combines Google
// AdSense + Adsterra into one monthly run. This file is kept around only so
// the manual `bun run src/commands/update-cron-adsense.ts` script (used for
// historical backfills) still resolves its imports.
import { Elysia } from "elysia";
import { cron, Patterns } from "@elysiajs/cron";
import { updateCronAdSense } from "../../commands/update-cron-adsense";

async function fetchMonthlyAdSenseRevenue() {
  const currentDate = new Date();
  const previousMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const previousMonth = previousMonthDate.getMonth(); // 0-indexed
  const previousYear = previousMonthDate.getFullYear();
  
  await updateCronAdSense(previousMonth, previousYear);
}

export const router = () =>
  new Elysia().use(
    cron({
      name: "monthly-adsense-revenue",
      // Run on the 2nd of every month at 2:00 AM
      pattern: "0 2 2 * *",
      run: fetchMonthlyAdSenseRevenue,
    })
  );
