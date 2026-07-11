import { prisma } from '../../models/prisma'

export const getGlobalStats = async (from?: Date, to?: Date) => {
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )

  // Rango de fechas SOLO para las métricas de dinero; los conteos de la
  // plataforma (usuarios, mangas, etc.) siguen siendo históricos.
  const dateRange =
    from || to
      ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}

  const [
    totalUsers,
    totalOrgs,
    totalMangas,
    totalChapters,
    totalComments,
    totalSubscriptions,
    earningsAgg,
    withdrawalsAgg,
    newUsersThisMonth,
    newOrgsThisMonth
  ] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count({ where: { isDeleted: false } }),
    prisma.mangaCustom.count({ where: { deletedAt: null } }),
    prisma.chapter.count({ where: { deletedAt: null } }),
    prisma.comment.count({ where: { hiddenAt: null } }),
    prisma.subscription.count({ where: { active: true } }),
    prisma.organizationTransaction.aggregate({
      where: { status: 'COMPLETED', type: 'EARNING', ...dateRange },
      // amount = neto de la org; beforeFeesAmount = bruto cobrado al lector.
      _sum: {
        amount: true,
        capibaraFee: true,
        paypalFee: true,
        beforeFeesAmount: true
      }
    }),
    prisma.organizationTransaction.aggregate({
      where: { status: 'COMPLETED', type: 'WITHDRAWAL', ...dateRange },
      _sum: { amount: true }
    }),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.organization.count({
      where: { isDeleted: false, createdAt: { gte: startOfMonth } }
    })
  ])

  return {
    totalUsers,
    totalOrgs,
    totalMangas,
    totalChapters,
    totalComments,
    totalSubscriptions,
    // Neto histórico de las orgs (amount ya viene con fees descontadas al crearse).
    totalRevenue: earningsAgg._sum.amount ?? 0,
    grossRevenue: earningsAgg._sum.beforeFeesAmount ?? 0,
    totalCapibaraFees: earningsAgg._sum.capibaraFee ?? 0,
    totalPaypalFees: earningsAgg._sum.paypalFee ?? 0,
    totalWithdrawn: withdrawalsAgg._sum.amount ?? 0,
    newUsersThisMonth,
    newOrgsThisMonth
  }
}

export const getOrgStats = async () => {
  const orgs = await prisma.organization.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      createdAt: true,
      _count: {
        select: {
          followers: true,
          mangaCustoms: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  // Separate queries to avoid guessing relation names
  const [revenueByOrg, withdrawalsByOrg, subsByOrg] = await Promise.all([
    prisma.organizationTransaction.groupBy({
      by: ['organizationId'],
      where: { status: 'COMPLETED', type: 'EARNING' },
      _sum: {
        amount: true,
        capibaraFee: true,
        paypalFee: true,
        beforeFeesAmount: true
      }
    }),
    prisma.organizationTransaction.groupBy({
      by: ['organizationId'],
      where: { status: 'COMPLETED', type: 'WITHDRAWAL' },
      _sum: { amount: true }
    }),
    prisma.subscription.groupBy({
      by: ['organizationId'],
      where: { active: true },
      _count: { id: true }
    })
  ])

  const revenueMap = new Map(
    revenueByOrg.map((r) => [
      r.organizationId,
      {
        // amount YA es el neto de la org (las fees salen del 50% de Capibara,
        // ver paypal_webhook.ts). No volver a restarle comisiones.
        revenue: r._sum.amount ?? 0,
        gross: r._sum.beforeFeesAmount ?? 0,
        capibaraFees: r._sum.capibaraFee ?? 0,
        paypalFees: r._sum.paypalFee ?? 0
      }
    ])
  )
  const withdrawnMap = new Map(
    withdrawalsByOrg.map((w) => [w.organizationId, w._sum.amount ?? 0])
  )
  const subsMap = new Map(subsByOrg.map((s) => [s.organizationId, s._count.id]))

  const results = await Promise.all(
    orgs.map(async (org) => {
      const chapterCount = await prisma.chapter.count({
        where: {
          mangaCustom: { organizationId: org.id, deletedAt: null },
          deletedAt: null
        }
      })
      const rev = revenueMap.get(org.id) ?? {
        revenue: 0,
        gross: 0,
        capibaraFees: 0,
        paypalFees: 0
      }
      const totalWithdrawn = withdrawnMap.get(org.id) ?? 0
      // Misma fórmula que la página de finanzas del scan (AdminFinance):
      // saldo = ganancias netas - retiros. Las fees son informativas.
      const saldo = rev.revenue - totalWithdrawn
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        createdAt: org.createdAt,
        mangaCount: org._count.mangaCustoms,
        chapterCount,
        subscriptionCount: subsMap.get(org.id) ?? 0,
        followerCount: org._count.followers,
        totalRevenue: rev.revenue,
        grossRevenue: rev.gross,
        capibaraFees: rev.capibaraFees,
        paypalFees: rev.paypalFees,
        totalWithdrawn,
        saldo
      }
    })
  )

  return results
}
