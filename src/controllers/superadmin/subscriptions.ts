import { prisma, Prisma } from "../../models/prisma";
import { getTransactionsOfSubscription } from "../../util/paypal";

export interface ListSubsFilters {
  page?: string;
  limit?: string;
  search?: string;        // username / email / scan name / scan slug
  status?: string;        // ACTIVE | SUSPENDED | CANCELLED | EXPIRED | ...
  organizationId?: string;
}

export const listAllSubscriptions = async (filters: ListSubsFilters) => {
  const limit = Math.max(1, Math.min(100, Number.parseInt(filters?.limit || "25")));
  const page = Math.max(1, Number.parseInt(filters?.page || "1"));

  const where: Prisma.SubscriptionWhereInput = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.organizationId) where.organizationId = Number(filters.organizationId);

  const q = filters?.search?.trim();
  if (q) {
    where.OR = [
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { username: { contains: q, mode: "insensitive" } } },
      { user: { slug: { contains: q, mode: "insensitive" } } },
      { organization: { name: { contains: q, mode: "insensitive" } } },
      { organization: { slug: { contains: q, mode: "insensitive" } } },
      { paypalSubscriptionId: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { createdAt: Prisma.SortOrder.desc },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        status: true,
        active: true,
        startDate: true,
        endDate: true,
        nextPayment: true,
        lastPayment: true,
        lastAmount: true,
        cycleExecutions: true,
        failedPaymentsCount: true,
        paypalSubscriptionId: true,
        createdAt: true,
        user: { select: { id: true, slug: true, username: true, email: true, imageUrl: true } },
        subscriptionPlan: {
          select: {
            id: true, name: true, price: true, currency: true, interval: true,
            organization: { select: { id: true, slug: true, name: true, logoUrl: true } },
          },
        },
      },
    }),
    prisma.subscription.count({ where }),
  ]);

  return {
    items,
    total,
    maxPage: Math.max(1, Math.ceil(total / limit)),
  };
};

interface PaymentRow {
  id: string | number;
  transactionDate: Date | null;
  beforeFeesAmount: number | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  transactionId: string | null;
  source: "db" | "paypal";
}

export const listAnySubscriptionPayments = async (subscriptionId: number) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, paypalSubscriptionId: true, lastAmount: true },
  });
  if (!subscription) return null;

  const dbTransactions = await prisma.organizationTransaction.findMany({
    where: { subscriptionId: subscription.id },
    orderBy: { transactionDate: Prisma.SortOrder.desc },
  });

  const rows: PaymentRow[] = dbTransactions.map((tx) => ({
    id: tx.id,
    transactionDate: tx.transactionDate,
    beforeFeesAmount: tx.beforeFeesAmount,
    amount: tx.amount,
    currency: tx.currency,
    status: tx.status,
    transactionId: tx.transactionId,
    source: "db",
  }));

  if (subscription.paypalSubscriptionId) {
    try {
      const paypalTxs = await getTransactionsOfSubscription(subscription.paypalSubscriptionId);
      if (Array.isArray(paypalTxs)) {
        const known = new Set(rows.map((r) => r.transactionId).filter((id): id is string => !!id));
        for (const ptx of paypalTxs) {
          const ptxId: string | undefined = ptx?.id;
          if (!ptxId || known.has(ptxId)) continue;
          const grossAmount = parseFloat(ptx?.amount_with_breakdown?.gross_amount?.value ?? "0");
          const feeAmount = parseFloat(ptx?.amount_with_breakdown?.fee_amount?.value ?? "0");
          const netAmount = parseFloat(ptx?.amount_with_breakdown?.net_amount?.value ?? `${grossAmount - feeAmount}`);
          rows.push({
            id: `paypal:${ptxId}`,
            transactionDate: ptx?.time ? new Date(ptx.time) : null,
            beforeFeesAmount: grossAmount,
            amount: netAmount,
            currency: ptx?.amount_with_breakdown?.gross_amount?.currency_code ?? "USD",
            status: ptx?.status ?? "UNKNOWN",
            transactionId: ptxId,
            source: "paypal",
          });
        }
      }
    } catch (err) {
      console.warn("listAnySubscriptionPayments: PayPal fetch failed", err);
    }
  }

  rows.sort((a, b) => {
    const aT = a.transactionDate ? new Date(a.transactionDate).getTime() : 0;
    const bT = b.transactionDate ? new Date(b.transactionDate).getTime() : 0;
    return bT - aT;
  });

  return rows;
};
