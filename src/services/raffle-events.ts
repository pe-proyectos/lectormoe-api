// In-memory pub/sub for raffle realtime events. Single Bun process = single bus;
// scaling to N processes will need Redis pubsub.

export type RaffleWinner = {
  ticketNumber: string;
  userSlug: string;
  userUsername: string;
  userImageUrl: string | null;
  comment?: string | null;
};

export type RaffleEliminatedEntry = {
  ticketNumber: string;
  userSlug: string;
  userUsername: string;
  userImageUrl: string | null;
  comment: string | null;
  eliminationOrder: number;
};

export type RaffleEvent =
  | {
      type: 'snapshot';
      raffle: {
        slug: string;
        status: string;
        sold: number;
        available: number;
        winnersCount: number;
        eliminationIntervalMs: number;
        winner: RaffleWinner | null;
        winners: RaffleWinner[] | null;
        viewerTicketsCount?: number;
      };
    }
  | {
      type: 'comment';
      comment: {
        id: number;
        userId: number;
        userSlug: string;
        userUsername: string;
        userImageUrl: string | null;
        isTicketHolder: boolean;
        body: string;
        createdAt: string;
      };
    }
  | { type: 'ticket_purchased'; sold: number; available: number }
  | {
      type: 'draw_started';
      totalTickets: number;
      winnersCount: number;
      eliminationIntervalMs: number;
      startedAt: string;
    }
  | {
      // Phase 1 elimination (single ticket every eliminationIntervalMs).
      type: 'elimination';
      ticketId: number;
      ticketNumber: string;
      userSlug: string;
      userUsername: string;
      userImageUrl: string | null;
      comment: string | null;
      eliminationOrder: number;
      remainingCount: number;
    }
  // ─── Three-phase events ──────────────────────────────────────────────
  | { type: 'phase_started'; phase: 'phase1' | 'phase2' | 'phase3_intro' | 'phase3' }
  // Phase 2 wind gust — moves N tickets visually. lightState at gust time
  // determines whether they get eliminated.
  | {
      type: 'wind_gust';
      ticketIds: number[];
      lightState: 'red' | 'green';
      eliminatedTicketIds: number[]; // populated only if lightState=red
    }
  | { type: 'light_change'; lightState: 'red' | 'green' }
  // Phase 3 horse advance — each ticket gets a random +1..+3 step.
  | {
      type: 'horse_advance';
      steps: { ticketId: number; horseSteps: number }[];
    }
  // Phase 3 last-place elimination.
  | {
      type: 'horse_elimination';
      ticketId: number;
      ticketNumber: string;
      userSlug: string;
      userUsername: string;
      userImageUrl: string | null;
    }
  | {
      type: 'draw_completed';
      winners: RaffleWinner[];
    }
  | { type: 'cancelled'; reason: string };

type Listener = (e: RaffleEvent) => void;

const subscribers = new Map<number, Set<Listener>>();

export const subscribe = (raffleId: number, cb: Listener): (() => void) => {
  let set = subscribers.get(raffleId);
  if (!set) {
    set = new Set();
    subscribers.set(raffleId, set);
  }
  set.add(cb);
  return () => {
    const s = subscribers.get(raffleId);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) subscribers.delete(raffleId);
  };
};

export const broadcast = (raffleId: number, e: RaffleEvent) => {
  const set = subscribers.get(raffleId);
  if (!set) return;
  for (const cb of set) {
    try {
      cb(e);
    } catch (err) {
      console.error(`[raffle-events] subscriber threw for raffle #${raffleId}:`, err);
    }
  }
};
