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
      type: 'elimination';
      ticketNumber: string;
      userSlug: string;
      userUsername: string;
      userImageUrl: string | null;
      comment: string | null;
      eliminationOrder: number;
      remainingCount: number;
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
