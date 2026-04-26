// In-memory pub/sub for raffle realtime events. Single Bun process = single bus;
// scaling to N processes will need Redis pubsub.

export type RaffleEvent =
  | {
      type: 'snapshot';
      raffle: {
        slug: string;
        status: string;
        sold: number;
        available: number;
        revealStartedAt: string | null;
        revealOrder: number[] | null;
        revealDigits: string | null;
        winner: {
          ticketNumber: string;
          userSlug: string;
          userUsername: string;
          userImageUrl: string | null;
        } | null;
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
      revealOrder: number[];
      revealDigits: string;
      revealStartedAt: string;
    }
  | {
      type: 'draw_completed';
      winner: {
        ticketNumber: string;
        userSlug: string;
        userUsername: string;
        userImageUrl: string | null;
      };
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
