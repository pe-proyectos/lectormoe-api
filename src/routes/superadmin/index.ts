import jwt from '@elysiajs/jwt'
import { Elysia, t } from 'elysia'
import {
  listRequests,
  reviewRequest
} from '../../controllers/superadmin/requests'
import { createScan, searchUsers } from '../../controllers/superadmin/scan'
import { getGlobalStats, getOrgStats } from '../../controllers/superadmin/stats'
import {
  listAllSubscriptions,
  listAnySubscriptionPayments
} from '../../controllers/superadmin/subscriptions'
import {
  listUsersAdmin,
  resendVerificationEmail,
  setUserHideAds
} from '../../controllers/superadmin/users'
import { prisma } from '../../models/prisma'
import {
  getSuperadminSecret,
  superadminAuth
} from '../../plugins/superadmin-auth'
import {
  computeMonthlyAdRevenue,
  persistMonthlyAdRevenue
} from '../../services/ad-revenue'
import {
  generatePresignedUploadUrl,
  getContentType
} from '../../services/files'

export const router = () =>
  new Elysia()
    .use(jwt({ name: 'saJwt', secret: getSuperadminSecret() }))
    // ── Login (no auth) ──────────────────────────────────────────────────────
    .post(
      '/api/superadmin/login',
      async ({ saJwt, body }) => {
        const { username, password } = body
        if (
          username !== Bun.env.SUPERADMIN_USER ||
          password !== Bun.env.SUPERADMIN_PASSWORD
        ) {
          throw new Error('Credenciales incorrectas.')
        }
        const token = await saJwt.sign({ superadmin: true })
        return { status: true, token }
      },
      {
        body: t.Object({ username: t.String(), password: t.String() }),
        response: t.Object({ status: t.Boolean(), token: t.String() })
      }
    )
    // ── Protected routes ─────────────────────────────────────────────────────
    .use(superadminAuth())
    .post(
      '/api/superadmin/files/presigned-url',
      async ({ body }) => {
        const { filename, contentType, expiresIn, contentFolder } = body
        if (!filename) throw new Error('Filename is required.')
        if (
          filename.includes('..') ||
          filename.includes('/') ||
          filename.includes('\\')
        ) {
          throw new Error('Invalid filename.')
        }
        const finalContentType = contentType || getContentType(filename)
        const { uploadUrl, fileKey } = await generatePresignedUploadUrl(
          filename,
          finalContentType,
          expiresIn || 3600,
          'superadmin',
          undefined,
          contentFolder
        )
        return { status: true, data: { uploadUrl, fileKey } }
      },
      {
        body: t.Object({
          filename: t.String(),
          contentType: t.Optional(t.String()),
          expiresIn: t.Optional(t.Number()),
          contentFolder: t.Optional(t.String())
        })
      }
    )
    .get('/api/superadmin/stats', async () => {
      const data = await getGlobalStats()
      return { status: true, data }
    })
    .get('/api/superadmin/org-stats', async () => {
      const data = await getOrgStats()
      return { status: true, data }
    })
    // ── Reportes de contenido ──────────────────────────────────────────────
    .get(
      '/api/superadmin/reports',
      async ({ query }) => {
        const status =
          query?.status === 'all' ? undefined : query?.status || 'pending'
        const reports = await prisma.contentReport.findMany({
          where: status ? { status } : undefined,
          orderBy: { createdAt: 'desc' },
          take: 200,
          include: {
            reporter: { select: { username: true, slug: true } },
            mangaCustom: {
              select: {
                title: true,
                imageUrl: true,
                isNSFW: true,
                manga: { select: { slug: true } },
                organization: { select: { name: true, slug: true } }
              }
            },
            joint: { select: { title: true, imageUrl: true, slug: true } }
          }
        })
        // Conteo de reportes pendientes por objetivo (agrupar duplicados).
        const grouped = new Map<string, number>()
        for (const r of reports) {
          const key = r.mangaCustomId
            ? `mc:${r.mangaCustomId}`
            : `j:${r.jointId}`
          grouped.set(key, (grouped.get(key) || 0) + 1)
        }
        const data = reports.map((r) => ({
          ...r,
          reportsForTarget:
            grouped.get(
              r.mangaCustomId ? `mc:${r.mangaCustomId}` : `j:${r.jointId}`
            ) || 1
        }))
        return { status: true, data }
      },
      { query: t.Optional(t.Object({ status: t.Optional(t.String()) })) }
    )
    .patch(
      '/api/superadmin/reports/:id',
      async ({ params, body }) => {
        const report = await prisma.contentReport.findUnique({
          where: { id: Number.parseInt(params.id) }
        })
        if (!report) throw new Error('Reporte no encontrado.')
        if (body.action === 'hide_content') {
          // Ocultar el contenido: soft-delete (list/get filtran deletedAt: null).
          if (report.mangaCustomId)
            await prisma.mangaCustom.update({
              where: { id: report.mangaCustomId },
              data: { deletedAt: new Date() }
            })
          if (report.jointId)
            await prisma.mangaJoint.update({
              where: { id: report.jointId },
              data: { deletedAt: new Date() }
            })
          // Marcar este y todos los pendientes del mismo objetivo como atendidos.
          await prisma.contentReport.updateMany({
            where: {
              status: 'pending',
              ...(report.mangaCustomId
                ? { mangaCustomId: report.mangaCustomId }
                : { jointId: report.jointId })
            },
            data: {
              status: 'actioned',
              resolutionNote: body.resolutionNote ?? null,
              reviewedAt: new Date()
            }
          })
        } else {
          await prisma.contentReport.update({
            where: { id: report.id },
            data: {
              status: 'dismissed',
              resolutionNote: body.resolutionNote ?? null,
              reviewedAt: new Date()
            }
          })
        }
        return { status: true, data: true }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          action: t.Union([t.Literal('dismiss'), t.Literal('hide_content')]),
          resolutionNote: t.Optional(t.Union([t.String(), t.Null()]))
        })
      }
    )
    .get(
      '/api/superadmin/requests',
      async ({ query }) => {
        const data = await listRequests(query.status as string | undefined)
        return { status: true, data }
      },
      {
        query: t.Object({ status: t.Optional(t.String()) })
      }
    )
    .patch(
      '/api/superadmin/requests/:id/review',
      async ({ params, body }) => {
        const data = await reviewRequest(
          Number(params.id),
          body.action as 'accept' | 'reject',
          body.notes
        )
        return { status: true, data }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          action: t.String(),
          notes: t.Optional(t.String())
        })
      }
    )
    .get(
      '/api/superadmin/users/search',
      async ({ query }) => {
        const limit = query.limit ? Number(query.limit) : 10
        const data = await searchUsers(query.q ?? '', limit)
        return { status: true, data }
      },
      {
        query: t.Object({
          q: t.Optional(t.String()),
          limit: t.Optional(t.String())
        })
      }
    )
    .post(
      '/api/superadmin/scan',
      async ({ body }) => {
        const data = await createScan({
          name: body.name,
          slug: body.slug,
          isNSFW: body.isNSFW,
          ownerUserId: body.ownerUserId
        })
        return { status: true, data }
      },
      {
        body: t.Object({
          name: t.String(),
          slug: t.String(),
          isNSFW: t.Boolean(),
          ownerUserId: t.Number()
        })
      }
    )
    .get(
      '/api/superadmin/users',
      async ({ query }) => {
        const data = await listUsersAdmin({
          page: query.page,
          limit: query.limit,
          search: query.search,
          verified: query.verified
        })
        return { status: true, data }
      },
      {
        query: t.Object({
          page: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          search: t.Optional(t.String()),
          verified: t.Optional(t.String())
        })
      }
    )
    .patch(
      '/api/superadmin/users/:id/hide-ads',
      async ({ params, body }) => {
        const id = Number.parseInt(params.id)
        if (Number.isNaN(id)) throw new Error('Id inválido.')
        const data = await setUserHideAds(id, !!body.hideAds)
        return { status: true, data }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({ hideAds: t.Boolean() })
      }
    )
    .post(
      '/api/superadmin/users/:id/resend-verification',
      async ({ params }) => {
        const id = Number.parseInt(params.id)
        if (Number.isNaN(id)) throw new Error('Id inválido.')
        const data = await resendVerificationEmail(id)
        return { status: true, data }
      },
      { params: t.Object({ id: t.String() }) }
    )
    .get(
      '/api/superadmin/subscriptions',
      async ({ query }) => {
        const data = await listAllSubscriptions({
          page: query.page,
          limit: query.limit,
          search: query.search,
          status: query.status,
          organizationId: query.organizationId
        })
        return { status: true, data }
      },
      {
        query: t.Object({
          page: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          search: t.Optional(t.String()),
          status: t.Optional(t.String()),
          organizationId: t.Optional(t.String())
        })
      }
    )
    .get(
      '/api/superadmin/subscriptions/:id/payments',
      async ({ params }) => {
        const id = Number.parseInt(params.id)
        if (Number.isNaN(id)) throw new Error('Id inválido.')
        const data = await listAnySubscriptionPayments(id)
        if (!data) throw new Error('Suscripción no encontrada.')
        return { status: true, data }
      },
      { params: t.Object({ id: t.String() }) }
    )
    // Manual ad-revenue trigger (back-fills, re-runs). Idempotent: orgs that
    // already have an ad-revenue tx for the period are skipped.
    // `month` is 1-indexed in the query string (1 = January) for human-friendliness;
    // internally we convert to the 0-indexed monthIndex used by the service.
    .post(
      '/api/superadmin/process-ad-revenue',
      async ({ query }) => {
        const year = Number(query.year)
        const month = Number(query.month)
        if (!Number.isInteger(year) || year < 2000 || year > 3000) {
          throw new Error('Invalid year.')
        }
        if (!Number.isInteger(month) || month < 1 || month > 12) {
          throw new Error('Invalid month (expected 1-12).')
        }
        const breakdown = await computeMonthlyAdRevenue(year, month - 1)
        const persistResult = await persistMonthlyAdRevenue(breakdown)
        return {
          status: true,
          data: {
            year,
            month,
            totalGoogle: breakdown.totalGoogle,
            totalAdsterra: breakdown.totalAdsterra,
            platformCut: breakdown.platformCut,
            scanPool: breakdown.scanPool,
            orgsWithPayout: breakdown.perOrg.length,
            inserted: persistResult.inserted,
            skipped: persistResult.skipped,
            perOrg: breakdown.perOrg
          }
        }
      },
      {
        query: t.Object({
          year: t.String(),
          month: t.String()
        })
      }
    )
