import { prisma, Prisma } from "../../models/prisma";
import { getTransactionsOfSubscription } from "../../util/paypal";

export const listOwnSubscriptions = async (userId: number) => {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: Prisma.SortOrder.desc,
    },
    include: {
      subscriptionPlan: {
        include: {
          organization: true,
        },
      },
    },
  });

  return subscriptions.map((sub) => ({
    id: sub.id,
    status: sub.status,
    active: sub.active,
    startDate: sub.startDate,
    endDate: sub.endDate,
    nextPayment: sub.nextPayment,
    lastPayment: sub.lastPayment,
    lastAmount: sub.lastAmount,
    cycleExecutions: sub.cycleExecutions,
    failedPaymentsCount: sub.failedPaymentsCount,
    paypalSubscriptionId: sub.paypalSubscriptionId,
    subscriptionPlan: {
      id: sub.subscriptionPlan.id,
      name: sub.subscriptionPlan.name,
      price: sub.subscriptionPlan.price,
      currency: sub.subscriptionPlan.currency,
      interval: sub.subscriptionPlan.interval,
      organization: {
        id: sub.subscriptionPlan.organization.id,
        slug: sub.subscriptionPlan.organization.slug,
        name: sub.subscriptionPlan.organization.name,
        logoUrl: sub.subscriptionPlan.organization.logoUrl,
      },
    },
  }));
};

export const getOwnSubscriptionById = async (userId: number, subscriptionId: number) => {
  return prisma.subscription.findFirst({
    where: {
      id: subscriptionId,
      userId,
    },
  });
};

type PaymentRow = {
  id: number | string;
  transactionDate: Date | string | null;
  beforeFeesAmount: number;
  amount: number;
  currency: string;
  status: string;
  transactionId: string | null;
  source?: "db" | "paypal";
};

export const listOwnSubscriptionPayments = async (
  userId: number,
  subscriptionId: number,
) => {
  const subscription = await getOwnSubscriptionById(userId, subscriptionId);
  if (!subscription) {
    return null;
  }

  const dbTransactions = await prisma.organizationTransaction.findMany({
    where: {
      subscriptionId: subscription.id,
    },
    orderBy: {
      transactionDate: Prisma.SortOrder.desc,
    },
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

  // Best-effort merge of PayPal-side transactions so users can see payments that
  // haven't been reconciled yet. If PayPal fails, just return the DB rows.
  try {
    const paypalTxs = await getTransactionsOfSubscription(subscription.paypalSubscriptionId);
    if (Array.isArray(paypalTxs)) {
      const knownIds = new Set(
        rows.map((r) => r.transactionId).filter((id): id is string => !!id),
      );
      for (const ptx of paypalTxs) {
        const ptxId: string | undefined = ptx?.id;
        if (!ptxId || knownIds.has(ptxId)) continue;
        const grossAmount = parseFloat(ptx?.amount_with_breakdown?.gross_amount?.value ?? "0");
        const feeAmount = parseFloat(ptx?.amount_with_breakdown?.fee_amount?.value ?? "0");
        const netAmount = parseFloat(ptx?.amount_with_breakdown?.net_amount?.value ?? `${grossAmount - feeAmount}`);
        const currency =
          ptx?.amount_with_breakdown?.gross_amount?.currency_code ?? subscription.lastAmount != null ? "USD" : "USD";
        rows.push({
          id: `paypal:${ptxId}`,
          transactionDate: ptx?.time ? new Date(ptx.time) : null,
          beforeFeesAmount: grossAmount,
          amount: netAmount,
          currency,
          status: ptx?.status ?? "UNKNOWN",
          transactionId: ptxId,
          source: "paypal",
        });
      }
    }
  } catch (err) {
    console.warn("listOwnSubscriptionPayments: PayPal transactions fetch failed", err);
  }

  rows.sort((a, b) => {
    const aTime = a.transactionDate ? new Date(a.transactionDate).getTime() : 0;
    const bTime = b.transactionDate ? new Date(b.transactionDate).getTime() : 0;
    return bTime - aTime;
  });

  return rows;
};
