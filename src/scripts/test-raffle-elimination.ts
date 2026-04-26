// E2E exercise of the elimination-tournament raffle flow. Bypasses HTTP — calls
// controllers/services directly. Free raffles only (no PayPal). Uses
// eliminationIntervalMs=50 / 200 to keep the test fast.
//
// Run: bun run src/scripts/test-raffle-elimination.ts

import { prisma } from "../models/prisma";
import { createRaffleAdmin } from "../controllers/raffle/admin";
import { purchaseTickets } from "../controllers/raffle/tickets";
import { executeDraw, executeCancel } from "../services/raffle-draw";
import { getRaffleDrawState } from "../controllers/raffle/draw-state";

let pass = 0;
let fail = 0;
const log = {
  ok: (msg: string) => { pass++; console.log(`  ✓ ${msg}`); },
  fail: (msg: string, err?: any) => { fail++; console.error(`  ✗ ${msg}`, err ?? ""); },
  info: (msg: string) => console.log(`\n— ${msg}`),
};

async function ensureUser(email: string, username: string) {
  const found = await prisma.user.findFirst({ where: { email } });
  if (found) return found;
  return prisma.user.create({
    data: {
      email,
      username,
      slug: username,
      password: "test-only-not-used",
      emailVerified: true,
    },
  });
}

async function cleanupRaffle(slug: string) {
  const r = await prisma.raffle.findUnique({ where: { slug } });
  if (!r) return;
  await prisma.raffleRefund.deleteMany({ where: { raffleId: r.id } });
  await prisma.raffleComment.deleteMany({ where: { raffleId: r.id } });
  await prisma.raffleTicket.deleteMany({ where: { raffleId: r.id } });
  await prisma.raffle.delete({ where: { id: r.id } });
}

async function cleanupUser(email: string) {
  const u = await prisma.user.findFirst({ where: { email } });
  if (!u) return;
  await prisma.user.delete({ where: { id: u.id } });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("=== Raffle Elimination Tournament E2E ===\n");

  // Pre-clean any leftovers from a previous failed run.
  await cleanupRaffle("test-elim-tournament");
  await cleanupRaffle("test-elim-shortcircuit");
  await cleanupRaffle("test-elim-cancel-mid");

  // ── Setup users
  log.info("Setup users");
  const buyers = [];
  for (let i = 1; i <= 50; i++) {
    buyers.push(await ensureUser(`raffle-elim-b${i}@example.com`, `raffleelimbuyer${i}`));
  }
  log.ok(`${buyers.length} users ready`);

  // ── Test 1: 5-ticket raffle, 2 winners, intervalMs=50
  const slug1 = "test-elim-tournament";
  log.info("Tournament: 5 tickets, winnersCount=2, intervalMs=50");
  try {
    await createRaffleAdmin({
      slug: slug1,
      title: "Test Elimination Tournament",
      ticketPrice: 0,
      currency: "USD",
      minTickets: 3,
      maxTickets: 5,
      maxTicketsPerUser: 1,
      winnersCount: 2,
      eliminationIntervalMs: 50,
      drawType: "max-tickets",
    });
    log.ok("created");
  } catch (e) { log.fail("create", e); }

  for (let i = 0; i < 5; i++) {
    try {
      await purchaseTickets(slug1, buyers[i].id, { count: 1 });
    } catch (e) { log.fail(`buyer ${i + 1} purchase`, e); }
  }
  log.ok("5 buyers each got 1 ticket — auto-draw kicked in");

  // Poll until completed, capturing eliminationsRemaining trajectory.
  let lastEliminationsRemaining = Number.POSITIVE_INFINITY;
  let monotonic = true;
  let finalState: any = null;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10_000) {
    const s = await getRaffleDrawState(slug1);
    if (!s) { log.fail("draw-state returned null"); break; }
    if (s.eliminationsRemaining > lastEliminationsRemaining) monotonic = false;
    lastEliminationsRemaining = s.eliminationsRemaining;
    if (s.status === "completed") { finalState = s; break; }
    await sleep(40);
  }

  if (monotonic) log.ok("eliminationsRemaining decreased monotonically");
  else log.fail("eliminationsRemaining did NOT decrease monotonically");

  if (!finalState) log.fail("raffle never reached completed status within 10s");
  else log.ok("status flipped to completed");

  if (finalState) {
    if (finalState.eliminatedCount === 3) log.ok("exactly 3 eliminations happened (5-2)");
    else log.fail(`expected 3 eliminations, got ${finalState.eliminatedCount}`);

    if (finalState.winners && finalState.winners.length === 2) log.ok("winners.length === 2");
    else log.fail(`expected 2 winners, got ${finalState.winners?.length}`);
  }

  const allTickets = await prisma.raffleTicket.findMany({
    where: { raffle: { slug: slug1 } },
    orderBy: { number: "asc" },
  });
  const survivors = allTickets.filter((t) => t.eliminatedAt === null);
  const eliminated = allTickets.filter((t) => t.eliminatedAt !== null);
  if (survivors.length === 2 && survivors.every((t) => t.eliminationOrder === null))
    log.ok("each surviving ticket has eliminatedAt=null and eliminationOrder=null");
  else log.fail("survivors not in expected shape");

  const orders = eliminated.map((t) => t.eliminationOrder).filter((o) => o !== null) as number[];
  const uniqueSorted = Array.from(new Set(orders)).sort((a, b) => a - b);
  if (uniqueSorted.length === 3 && uniqueSorted[0] === 1 && uniqueSorted[2] === 3)
    log.ok("eliminated tickets have unique eliminationOrder 1..3");
  else log.fail(`eliminationOrder set is wrong: ${JSON.stringify(uniqueSorted)}`);

  // ── Test 2: Short-circuit — 2 tickets, winnersCount=2 → no eliminations.
  const slug2 = "test-elim-shortcircuit";
  log.info("Short-circuit: 2 tickets, winnersCount=2 → no eliminations");
  try {
    await createRaffleAdmin({
      slug: slug2,
      title: "Test Short-circuit",
      ticketPrice: 0,
      currency: "USD",
      minTickets: 1,
      maxTickets: 5,
      maxTicketsPerUser: 1,
      winnersCount: 2,
      eliminationIntervalMs: 50,
      drawType: "countdown",
      drawAt: new Date(Date.now() + 10_000).toISOString(),
    });
    log.ok("created");
  } catch (e) { log.fail("create", e); }

  // Buy 2 tickets only.
  for (let i = 5; i < 7; i++) {
    try {
      await purchaseTickets(slug2, buyers[i].id, { count: 1 });
    } catch (e) { log.fail(`shortcircuit buyer ${i + 1}`, e); }
  }
  // Manually trigger the draw (countdown not yet due).
  const r2 = await prisma.raffle.findUnique({ where: { slug: slug2 } });
  if (r2) await executeDraw(r2.id);
  // Short-circuit is synchronous — no setTimeout chain — but give it a beat.
  await sleep(100);
  const s2 = await getRaffleDrawState(slug2);
  if (s2?.status === "completed") log.ok("short-circuit completed");
  else log.fail(`expected completed, got ${s2?.status}`);
  if (s2?.eliminatedCount === 0) log.ok("zero eliminations (no SSE elimination events would fire)");
  else log.fail(`expected 0 eliminations, got ${s2?.eliminatedCount}`);
  if (s2?.winners && s2.winners.length === 2) log.ok("both tickets are winners");
  else log.fail(`expected 2 winners, got ${s2?.winners?.length}`);

  // ── Test 3: Cancel mid-tournament.
  const slug3 = "test-elim-cancel-mid";
  log.info("Cancel mid-tournament: 50 tickets, intervalMs=200, cancel after 1st elimination");
  try {
    await createRaffleAdmin({
      slug: slug3,
      title: "Test Cancel Mid-tournament",
      ticketPrice: 0,
      currency: "USD",
      minTickets: 1,
      maxTickets: 50,
      maxTicketsPerUser: 1,
      winnersCount: 1,
      eliminationIntervalMs: 200,
      drawType: "countdown",
      drawAt: new Date(Date.now() + 60_000).toISOString(),
    });
    log.ok("created");
  } catch (e) { log.fail("create", e); }

  for (let i = 7; i < 50; i++) {
    try {
      await purchaseTickets(slug3, buyers[i].id, { count: 1 });
    } catch (e) { log.fail(`cancel buyer ${i + 1}`, e); }
  }
  // Make sure we have enough tickets — we used 7..49 = 43 tickets which is fine.
  const r3 = await prisma.raffle.findUnique({ where: { slug: slug3 } });
  if (r3) await executeDraw(r3.id);
  // Wait long enough for one elimination tick (~200ms) but cancel before the 2nd.
  await sleep(300);
  const sBefore = await getRaffleDrawState(slug3);
  const eliminatedBefore = sBefore?.eliminatedCount ?? 0;
  if (eliminatedBefore >= 1) log.ok(`first elimination happened (${eliminatedBefore})`);
  else log.fail(`expected at least 1 elimination, got ${eliminatedBefore}`);

  if (r3) await executeCancel(r3.id, "test-mid-cancel");
  await sleep(500); // give pending setTimeouts time to noop

  const sAfter = await getRaffleDrawState(slug3);
  if (sAfter?.status === "cancelled") log.ok("status flipped to cancelled");
  else log.fail(`expected cancelled, got ${sAfter?.status}`);

  // Wait through several would-be elimination intervals to confirm the
  // setTimeout callbacks no-op when status != 'drawing'.
  await sleep(1000);
  const sFinal = await getRaffleDrawState(slug3);
  const eliminatedFinal = sFinal?.eliminatedCount ?? 0;
  if (eliminatedFinal === eliminatedBefore)
    log.ok(`no further eliminations after cancel (count stable at ${eliminatedFinal})`);
  else
    log.fail(`scheduled timeouts kept eliminating: was ${eliminatedBefore}, now ${eliminatedFinal}`);

  // ── Cleanup
  log.info("Cleanup");
  try {
    await cleanupRaffle(slug1);
    await cleanupRaffle(slug2);
    await cleanupRaffle(slug3);
    for (const b of buyers) await cleanupUser(b.email);
    log.ok("cleaned up");
  } catch (e) { log.fail("cleanup", e); }

  // ── Report
  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exit(1);
}

main()
  .catch((e) => { console.error("fatal:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
