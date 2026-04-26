import { Elysia } from "elysia";
import { cron } from "@elysiajs/cron";
import { prisma } from "../../models/prisma";
import { executeDraw } from "../../services/raffle-draw";

async function processDueRaffles() {
  try {
    const due = await prisma.raffle.findMany({
      where: {
        status: "active",
        drawType: "countdown",
        drawAt: { lte: new Date() },
        deletedAt: null,
      },
    });
    if (due.length === 0) return;
    console.log(`[raffle cron] Processing ${due.length} due raffle(s)`);
    for (const r of due) {
      try {
        await executeDraw(r.id);
      } catch (e) {
        console.error(`[raffle cron] draw failed for #${r.id}`, e);
      }
    }
  } catch (e) {
    console.error("[raffle cron] critical error:", e);
  }
}

export const router = () =>
  new Elysia().use(
    cron({
      name: "raffle-due-draws",
      pattern: "* * * * *",
      run: processDueRaffles,
    }),
  );
