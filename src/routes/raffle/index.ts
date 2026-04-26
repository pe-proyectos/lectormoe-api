import { Elysia, t } from "elysia";

import { loggedOptional, loggedUserOnlyGlobal } from "../../plugins/auth";
import { superadminAuth } from "../../plugins/superadmin-auth";

import { prisma } from "../../models/prisma";
import { listRaffles } from "../../controllers/raffle/list";
import { getRaffleBySlug } from "../../controllers/raffle/get";
import { getRaffleDrawState } from "../../controllers/raffle/draw-state";
import {
  listRaffleTickets,
  createPaypalOrderForRaffle,
  purchaseTickets,
} from "../../controllers/raffle/tickets";
import {
  listRaffleComments,
  createRaffleComment,
} from "../../controllers/raffle/comments";
import { getMyRaffleHistory } from "../../controllers/raffle/me";
import {
  createRaffleAdmin,
  editRaffleAdmin,
  softDeleteRaffleAdmin,
  triggerDrawAdmin,
  cancelRaffleAdmin,
} from "../../controllers/raffle/admin";

import { padTicket } from "../../services/raffle-draw";
import { broadcast, subscribe } from "../../services/raffle-events";

const SSE_HEARTBEAT_MS = 25_000;

const buildSnapshot = async (slug: string, viewerUserId: number | null) => {
  const r = await prisma.raffle.findUnique({
    where: { slug },
    include: { _count: { select: { tickets: true } } },
  });
  if (!r || r.deletedAt) return null;
  let viewerTicketsCount = 0;
  if (viewerUserId) {
    viewerTicketsCount = await prisma.raffleTicket.count({
      where: { raffleId: r.id, userId: viewerUserId, refundedAt: null },
    });
  }
  let winners: any[] | null = null;
  if (r.status === "completed") {
    const survivors = await prisma.raffleTicket.findMany({
      where: { raffleId: r.id, eliminatedAt: null },
      orderBy: { number: "asc" },
      include: { user: { select: { slug: true, username: true, imageUrl: true } } },
    });
    winners = survivors.map((t) => ({
      ticketNumber: padTicket(t.number),
      userSlug: t.user.slug,
      userUsername: t.user.username,
      userImageUrl: t.user.imageUrl,
      comment: t.comment,
    }));
  }
  const winner = winners && winners.length > 0 ? winners[0] : null;
  return {
    raffleId: r.id,
    snapshot: {
      slug: r.slug,
      status: r.status,
      sold: r._count.tickets,
      available: Math.max(0, r.maxTickets - r._count.tickets),
      winnersCount: r.winnersCount,
      eliminationIntervalMs: r.eliminationIntervalMs,
      winner,
      winners,
      viewerTicketsCount,
    },
  };
};

export const router = () =>
  new Elysia()
    // ─── PUBLIC + LOGGED + SUPERADMIN routes are split into separate groups so
    // each group's auth `.use(...)` only applies to its own endpoints. Without
    // this isolation, `loggedUserOnlyGlobal` would gate the superadmin routes
    // too and reject Bearer-only requests as "No autorizado, token incorrecto".
    .group("", (app) => app
    .use(loggedOptional())
    .get(
      "/api/raffle",
      async ({ query }) => {
        const status = (query.status as any) ?? "all";
        const page = query.page ? Number(query.page) : 1;
        const limit = query.limit ? Number(query.limit) : 24;
        const data = await listRaffles({ status, page, limit });
        return { status: true, data };
      },
      {
        query: t.Object({
          status: t.Optional(t.String()),
          page: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
      },
    )
    // ─── ME (place BEFORE /:slug to avoid shadowing) ─────────────────────────
    .get("/api/raffle/me/tickets", async ({ user }: any) => {
      if (!user) throw new Error("No autorizado.");
      const data = await getMyRaffleHistory(user.id);
      return { status: true, data: data.tickets };
    })
    .get("/api/raffle/me/refunds", async ({ user }: any) => {
      if (!user) throw new Error("No autorizado.");
      const data = await getMyRaffleHistory(user.id);
      return { status: true, data: data.refunds };
    })
    // ─── DETAIL ──────────────────────────────────────────────────────────────
    .get(
      "/api/raffle/:slug",
      async ({ params, user }: any) => {
        const data = await getRaffleBySlug(params.slug, user?.id ?? null);
        if (!data) throw new Error("Sorteo no encontrado.");
        return { status: true, data };
      },
      { params: t.Object({ slug: t.String() }) },
    )
    .get(
      "/api/raffle/:slug/tickets",
      async ({ params, query }) => {
        const page = query.page ? Number(query.page) : 1;
        const limit = query.limit ? Number(query.limit) : 30;
        const data = await listRaffleTickets(params.slug, { page, limit, q: query.q });
        return { status: true, data };
      },
      {
        params: t.Object({ slug: t.String() }),
        query: t.Object({
          page: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          q: t.Optional(t.String()),
        }),
      },
    )
    .get(
      "/api/raffle/:slug/draw-state",
      async ({ params, set }: any) => {
        const data = await getRaffleDrawState(params.slug);
        if (!data) {
          set.status = 404;
          return { status: false, message: "Sorteo no encontrado." };
        }
        return { status: true, data };
      },
      { params: t.Object({ slug: t.String() }) },
    )
    .get(
      "/api/raffle/:slug/comments",
      async ({ params, query }) => {
        const before = query.before ? Number(query.before) : undefined;
        const after = query.after ? Number(query.after) : undefined;
        const limit = query.limit ? Number(query.limit) : 50;
        const data = await listRaffleComments(params.slug, { before, after, limit });
        return { status: true, data };
      },
      {
        params: t.Object({ slug: t.String() }),
        query: t.Object({
          before: t.Optional(t.String()),
          after: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
      },
    )
    // ─── SSE STREAM ──────────────────────────────────────────────────────────
    .get(
      "/api/raffle/:slug/events",
      async ({ params, user, set }: any) => {
        const snap = await buildSnapshot(params.slug, user?.id ?? null);
        if (!snap) {
          set.status = 404;
          return { status: false, message: "Sorteo no encontrado." };
        }
        const { raffleId, snapshot } = snap;

        const stream = new ReadableStream({
          start(controller) {
            const enc = new TextEncoder();
            const send = (data: string) => {
              try {
                controller.enqueue(enc.encode(data));
              } catch (e) {
                // Connection closed.
              }
            };

            // Initial snapshot lets late joiners (and mid-draw reconnects) rehydrate.
            send(`data: ${JSON.stringify({ type: "snapshot", raffle: snapshot })}\n\n`);

            const unsub = subscribe(raffleId, (e) => {
              send(`data: ${JSON.stringify(e)}\n\n`);
            });

            const heartbeat = setInterval(() => send(`: keepalive\n\n`), SSE_HEARTBEAT_MS);

            const close = () => {
              clearInterval(heartbeat);
              unsub();
              try { controller.close(); } catch (e) { /* already closed */ }
            };
            // Best-effort cleanup; the runtime will GC the controller when the
            // socket goes away, and our heartbeat enqueue will throw on a closed
            // controller so the listener keeps working until then.
            (controller as any).__close = close;
          },
          cancel() {
            const close = (this as any).__close;
            if (typeof close === "function") close();
          },
        });

        // Returning a raw Response bypasses Elysia's serialization so the stream
        // pipes straight through. Headers go on the Response init only.
        return new Response(stream as any, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
      { params: t.Object({ slug: t.String() }) },
    )
    )
    // ─── LOGGED-IN ACTIONS ───────────────────────────────────────────────────
    .group("", (app) => app
    .use(loggedUserOnlyGlobal())
    .post(
      "/api/raffle/:slug/comments",
      async ({ params, body, user }: any) => {
        const data = await createRaffleComment(params.slug, user.id, body.body);
        return { status: true, data };
      },
      {
        params: t.Object({ slug: t.String() }),
        body: t.Object({ body: t.String() }),
      },
    )
    .post(
      "/api/raffle/:slug/orders",
      async ({ params, body, user }: any) => {
        const count = Math.max(1, Math.floor(body.count ?? 1));
        const data = await createPaypalOrderForRaffle(params.slug, user.id, count);
        return { status: true, data };
      },
      {
        params: t.Object({ slug: t.String() }),
        body: t.Object({ count: t.Number() }),
      },
    )
    .post(
      "/api/raffle/:slug/tickets",
      async ({ params, body, user }: any) => {
        const data = await purchaseTickets(params.slug, user.id, {
          count: body.count,
          comment: body.comment,
          paypalOrderId: body.paypalOrderId,
        });
        return { status: true, data };
      },
      {
        params: t.Object({ slug: t.String() }),
        body: t.Object({
          count: t.Optional(t.Number()),
          comment: t.Optional(t.String()),
          paypalOrderId: t.Optional(t.String()),
        }),
      },
    )
    )
    // ─── SUPERADMIN ──────────────────────────────────────────────────────────
    .group("", (app) => app
    .use(superadminAuth())
    .get(
      "/api/superadmin/raffles",
      async ({ query }) => {
        const status = (query.status as any) ?? "all";
        const page = query.page ? Number(query.page) : 1;
        const limit = query.limit ? Number(query.limit) : 24;
        const data = await listRaffles({ status, page, limit, includeDeleted: true });
        return { status: true, data };
      },
      {
        query: t.Object({
          status: t.Optional(t.String()),
          page: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
      },
    )
    .post(
      "/api/superadmin/raffles",
      async ({ body }) => {
        const data = await createRaffleAdmin(body as any);
        return { status: true, data };
      },
      {
        body: t.Object({
          slug: t.String(),
          title: t.String(),
          description: t.Optional(t.Union([t.String(), t.Null()])),
          imageUrl: t.Optional(t.Union([t.String(), t.Null()])),
          bannerUrl: t.Optional(t.Union([t.String(), t.Null()])),
          ticketPrice: t.Optional(t.Number()),
          currency: t.Optional(t.String()),
          minTickets: t.Optional(t.Number()),
          maxTickets: t.Number(),
          maxTicketsPerUser: t.Optional(t.Number()),
          winnersCount: t.Optional(t.Number()),
          eliminationIntervalMs: t.Optional(t.Number()),
          drawType: t.String(),
          drawAt: t.Optional(t.Union([t.String(), t.Null()])),
        }),
      },
    )
    .patch(
      "/api/superadmin/raffles/:slug",
      async ({ params, body }) => {
        const data = await editRaffleAdmin(params.slug, body as any);
        return { status: true, data };
      },
      {
        params: t.Object({ slug: t.String() }),
        body: t.Object({
          slug: t.Optional(t.String()),
          title: t.Optional(t.String()),
          description: t.Optional(t.Union([t.String(), t.Null()])),
          imageUrl: t.Optional(t.Union([t.String(), t.Null()])),
          bannerUrl: t.Optional(t.Union([t.String(), t.Null()])),
          ticketPrice: t.Optional(t.Number()),
          currency: t.Optional(t.String()),
          minTickets: t.Optional(t.Number()),
          maxTickets: t.Optional(t.Number()),
          maxTicketsPerUser: t.Optional(t.Number()),
          winnersCount: t.Optional(t.Number()),
          eliminationIntervalMs: t.Optional(t.Number()),
          drawType: t.Optional(t.String()),
          drawAt: t.Optional(t.Union([t.String(), t.Null()])),
        }),
      },
    )
    .delete(
      "/api/superadmin/raffles/:slug",
      async ({ params }) => {
        const data = await softDeleteRaffleAdmin(params.slug);
        return { status: true, data };
      },
      { params: t.Object({ slug: t.String() }) },
    )
    .post(
      "/api/superadmin/raffles/:slug/draw-now",
      async ({ params }) => {
        const data = await triggerDrawAdmin(params.slug);
        return { status: true, data };
      },
      { params: t.Object({ slug: t.String() }) },
    )
    .post(
      "/api/superadmin/raffles/:slug/cancel",
      async ({ params, body }) => {
        const data = await cancelRaffleAdmin(params.slug, (body as any).reason ?? "");
        return { status: true, data };
      },
      {
        params: t.Object({ slug: t.String() }),
        body: t.Object({ reason: t.Optional(t.String()) }),
      },
    )
    );
