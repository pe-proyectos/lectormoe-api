import { checkGuildMembershipViaBot } from "../util/discord";

// Single in-memory cache for bot membership checks. Single Bun process →
// single map; consistent with the SSE bus convention.
//   ok  =true  → cached true for 10 min
//   ok  =false → cached false for 2 min so a denied user can't spam the bot API
const TTL_OK_MS = 10 * 60 * 1000;
const TTL_FAIL_MS = 2 * 60 * 1000;

type Entry = { ok: boolean; until: number };
const cache = new Map<string, Entry>();

export const isInGuildCached = async (discordId: string): Promise<boolean> => {
  const now = Date.now();
  const hit = cache.get(discordId);
  if (hit && hit.until > now) return hit.ok;

  const ok = await checkGuildMembershipViaBot(discordId);
  cache.set(discordId, { ok, until: now + (ok ? TTL_OK_MS : TTL_FAIL_MS) });
  return ok;
};

// Force a re-check — used by the explicit /verify endpoint and by ticket
// purchase when a previous failure has aged past the soft block.
export const forceRecheckMembership = async (discordId: string): Promise<boolean> => {
  cache.delete(discordId);
  return isInGuildCached(discordId);
};

// Test-only: clear cache between unit runs.
export const __clearMembershipCache = () => cache.clear();
