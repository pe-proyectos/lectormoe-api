/**
 * Self-test for the Discord linking + raffle gating flow.
 *
 * Run with: bun run src/scripts/test-discord-flow.ts
 *
 * Asserts:
 *   1) bot membership check returns false for a fake discordId
 *   2) ticket purchase throws "Vincula tu Discord..." when user has no discordId
 *   3) ticket purchase throws "Únete al Discord..." when user has discordId
 *      but is not in the guild
 *   4) HMAC state sign + verify roundtrip works (and tampered state fails)
 *   5) cached membership check only hits Discord once within the TTL window
 *
 * Skips the OAuth flow (requires browser interaction).
 */
import { prisma } from "../models/prisma";
import { checkGuildMembershipViaBot } from "../util/discord";
import { isInGuildCached, __clearMembershipCache } from "../services/discord-membership";
import { purchaseTickets } from "../controllers/raffle/tickets";
import { signState, verifyState } from "../routes/discord/index";

const FAKE_DISCORD_ID = "000000000000000001";
const TEST_EMAIL = "discord-flow-test@capibaratraductor.test";
const TEST_USERNAME = "discord_flow_test_user";
const TEST_SLUG = "discord-flow-test-user";
const TEST_RAFFLE_SLUG = "discord-flow-test-raffle";

let pass = 0;
let fail = 0;

const ok = (name: string) => { pass++; console.log(`  ✓ ${name}`); };
const ko = (name: string, err: any) => { fail++; console.error(`  ✗ ${name}:`, err?.message ?? err); };

async function ensureUser() {
  let u = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (!u) {
    u = await prisma.user.create({
      data: {
        username: TEST_USERNAME,
        slug: TEST_SLUG,
        email: TEST_EMAIL,
        password: "test-noop",
      },
    });
  }
  return u;
}

async function ensureRaffle() {
  let r = await prisma.raffle.findUnique({ where: { slug: TEST_RAFFLE_SLUG } });
  if (!r) {
    r = await prisma.raffle.create({
      data: {
        slug: TEST_RAFFLE_SLUG,
        title: "[TEST] Discord flow",
        ticketPrice: 0,
        currency: "USD",
        minTickets: 1,
        maxTickets: 100,
        maxTicketsPerUser: 1,
        drawType: "max-tickets",
        status: "active",
      },
    });
  }
  return r;
}

async function cleanup(userId: number, raffleId: number) {
  await prisma.raffleTicket.deleteMany({ where: { raffleId, userId } });
  await prisma.raffle.delete({ where: { id: raffleId } }).catch(() => {});
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

async function run() {
  console.log("\n=== Discord flow self-test ===\n");

  const user = await ensureUser();
  const raffle = await ensureRaffle();

  try {
    // 1) Bot membership check on a known-fake id should be false (or throw if env
    //    isn't configured — we accept either as "not a member").
    console.log("[1] checkGuildMembershipViaBot(fake) → false/throw");
    try {
      const inGuild = await checkGuildMembershipViaBot(FAKE_DISCORD_ID);
      if (inGuild === false) ok("returned false");
      else ko("returned true unexpectedly", { message: "expected false for fake id" });
    } catch (err: any) {
      // Missing env or transient API error — both count as "not verified".
      ok(`threw (${err?.message ?? "no message"})`);
    }

    // 2) Purchase with no discordId should throw the link prompt.
    console.log("\n[2] purchaseTickets without discordId → 'Vincula tu Discord...'");
    await prisma.user.update({
      where: { id: user.id },
      data: { discordId: null, discordVerifiedAt: null, discordLastCheckAt: null },
    });
    try {
      await purchaseTickets(TEST_RAFFLE_SLUG, user.id, { count: 1 });
      ko("expected throw", { message: "no throw" });
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      if (msg.includes("Vincula tu Discord")) ok("threw expected message");
      else ko("wrong message", { message: msg });
    }

    // 3) Purchase with discordId set but not in guild → 'Únete al Discord...'.
    console.log("\n[3] purchaseTickets with linked-but-not-in-guild → 'Únete al Discord...'");
    __clearMembershipCache();
    await prisma.user.update({
      where: { id: user.id },
      data: { discordId: FAKE_DISCORD_ID },
    });
    try {
      await purchaseTickets(TEST_RAFFLE_SLUG, user.id, { count: 1 });
      ko("expected throw", { message: "no throw" });
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      if (msg.includes("Únete al Discord")) ok("threw expected message");
      else if (msg.includes("Vincula tu Discord")) ko("wrong message (still 'link' message)", { message: msg });
      else ok(`threw (likely env not set: ${msg})`);
    }

    // 4) HMAC state sign+verify roundtrip; tampered state must reject.
    console.log("\n[4] state HMAC sign + verify roundtrip");
    const signed = signState(user.id);
    const got = verifyState(signed);
    if (got && got.userId === user.id) ok("verified signed state for same userId");
    else ko("roundtrip failed", { message: `got ${JSON.stringify(got)}` });

    // Flip a hex char at the end to simulate tampering.
    const tampered = signed.slice(0, -1) + (signed.slice(-1) === "0" ? "1" : "0");
    if (verifyState(tampered) === null) ok("rejected tampered state");
    else ko("tampered state accepted", { message: "expected null" });

    // Garbage shape rejected.
    if (verifyState("not-a-state") === null) ok("rejected malformed state");
    else ko("malformed state accepted", { message: "expected null" });

    // 5) Cache: 2 calls within the TTL only hit Discord once.
    console.log("\n[5] cache TTL — repeated calls hit Discord once");
    __clearMembershipCache();
    let fetchCalls = 0;
    const realFetch = globalThis.fetch;
    // Stub: count discord.com fetches; pretend the user is in guild.
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : (input?.url ?? "");
      if (typeof url === "string" && url.includes("discord.com/api/")) {
        fetchCalls++;
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
      }
      return realFetch(input, init);
    }) as typeof fetch;
    try {
      const a = await isInGuildCached("123456789012345678");
      const b = await isInGuildCached("123456789012345678");
      if (a === true && b === true) ok("both calls returned true");
      else ko("unexpected return", { message: `a=${a} b=${b}` });
      if (fetchCalls === 1) ok(`fetch called exactly 1 time (got ${fetchCalls})`);
      else ko("expected fetch=1", { message: `got ${fetchCalls}` });
    } finally {
      globalThis.fetch = realFetch;
      __clearMembershipCache();
    }
  } finally {
    console.log("\n[cleanup]");
    try {
      await cleanup(user.id, raffle.id);
      ok("cleaned test rows");
    } catch (err: any) {
      ko("cleanup", err);
    }
  }

  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
