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
