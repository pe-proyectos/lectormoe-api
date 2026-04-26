import { Elysia, t } from "elysia";
import { createHmac, timingSafeEqual } from "crypto";

import { loggedUserOnlyGlobal } from "../../plugins/auth";
import { prisma } from "../../models/prisma";
import {
  buildOauthUrl,
  exchangeCodeForToken,
  fetchDiscordUser,
  fetchUserGuilds,
  ourGuildId,
} from "../../util/discord";
import { forceRecheckMembership } from "../../services/discord-membership";

const STATE_TTL_MS = 5 * 60 * 1000;

const stateSecret = () => process.env.JWT_SECRET || "fallback";

// state = base64url(`${userId}.${expiresAt}`).`${hmacHex}`
// no DB row needed; HMAC verifies authenticity + freshness on callback.
export const signState = (userId: number): string => {
  const expiresAt = Date.now() + STATE_TTL_MS;
  const payload = Buffer.from(`${userId}.${expiresAt}`).toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
};

export const verifyState = (state: string): { userId: number } | null => {
  const dot = state.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac("sha256", stateSecret()).update(payload).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let decoded: string;
  try {
    decoded = Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const [uidStr, expStr] = decoded.split(".");
  const userId = parseInt(uidStr, 10);
  const expiresAt = parseInt(expStr, 10);
  if (!Number.isFinite(userId) || !Number.isFinite(expiresAt)) return null;
  if (Date.now() > expiresAt) return null;
  return { userId };
};

const settingsRedirect = (qs: string) => {
  // Front lives at capibaratraductor.com; we want users back on /settings.
  const base = process.env.FRONTEND_URL || "https://capibaratraductor.com";
  return `${base}/settings?${qs}`;
};

export const router = () =>
  new Elysia()
    // ─── PUBLIC: callback (Discord redirects without our cookies guaranteed)
    .group("", (app) =>
      app.get(
        "/api/discord/callback",
        async ({ query, set }) => {
          const code = query.code as string | undefined;
          const state = query.state as string | undefined;

          const fail = (reason: string) => {
            set.status = 302;
            set.headers["Location"] = settingsRedirect(`discord=error&reason=${encodeURIComponent(reason)}`);
            return "";
          };

          if (!code || !state) return fail("missing-params");
          const verified = verifyState(state);
          if (!verified) return fail("invalid-or-expired-state");

          try {
            const token = await exchangeCodeForToken(code);
            const [me, guilds] = await Promise.all([
              fetchDiscordUser(token.access_token),
              fetchUserGuilds(token.access_token),
            ]);

            const guildId = ourGuildId();
            const inGuild = Array.isArray(guilds) && guilds.some((g) => g.id === guildId);

            if (!inGuild) {
              // Don't write the link yet — they have to join first. The frontend
              // will prompt them and re-run /verify after they join.
              set.status = 302;
              set.headers["Location"] = settingsRedirect("discord=join-required");
              return "";
            }

            // Conflict: another platform user already linked this discordId.
            const existing = await prisma.user.findUnique({
              where: { discordId: me.id },
              select: { id: true },
            });
            if (existing && existing.id !== verified.userId) {
              set.status = 302;
              set.headers["Location"] = settingsRedirect("discord=conflict");
              return "";
            }

            const now = new Date();
            await prisma.user.update({
              where: { id: verified.userId },
              data: {
                discordId: me.id,
                discordUsername: me.global_name || me.username,
                discordAvatar: me.avatar ?? null,
                discordVerifiedAt: now,
                discordLastCheckAt: now,
              },
            });

            set.status = 302;
            set.headers["Location"] = settingsRedirect("discord=ok");
            return "";
          } catch (err: any) {
            return fail(err?.message || "unknown");
          }
        },
        {
          query: t.Object({
            code: t.Optional(t.String()),
            state: t.Optional(t.String()),
          }),
        },
      ),
    )
    // ─── LOGGED-IN: oauth-url, verify, unlink
    .group("", (app) =>
      app
        .use(loggedUserOnlyGlobal())
        .get("/api/discord/oauth-url", async ({ user }: any) => {
          const state = signState(user.id);
          const url = buildOauthUrl(state);
          return { status: true, data: { url, state } };
        })
        .post("/api/discord/verify", async ({ user }: any) => {
          // Re-pull from DB to be sure we have the latest discordId — `user`
          // here came from the token check and may be slightly stale.
          const u = await prisma.user.findUnique({
            where: { id: user.id },
            select: { discordId: true },
          });
          if (!u?.discordId) {
            return { status: true, data: { verified: false, reason: "not-linked" } };
          }
          try {
            const ok = await forceRecheckMembership(u.discordId);
            if (ok) {
              await prisma.user.update({
                where: { id: user.id },
                data: { discordLastCheckAt: new Date() },
              });
              return { status: true, data: { verified: true } };
            }
            return { status: true, data: { verified: false, reason: "not-in-guild" } };
          } catch (err: any) {
            return { status: true, data: { verified: false, reason: err?.message || "check-failed" } };
          }
        })
        .delete("/api/discord/me", async ({ user }: any) => {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              discordId: null,
              discordUsername: null,
              discordAvatar: null,
              discordVerifiedAt: null,
              discordLastCheckAt: null,
            },
          });
          return { status: true, data: { unlinked: true } };
        }),
    );
