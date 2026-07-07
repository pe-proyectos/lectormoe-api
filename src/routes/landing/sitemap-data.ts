import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'

// Payload liviano para el sitemap: solo slugs + updatedAt. Cache 1h.
let cache: { data: any; expiresAt: number } | null = null
const TTL = 60 * 60 * 1000

export const router = () =>
  new Elysia().get(
    '/api/sitemap-data',
    async () => {
      if (cache && cache.expiresAt > Date.now())
        return { status: true, data: cache.data }

      const [orgs, mangas, lists] = await Promise.all([
        prisma.organization.findMany({
          where: { isPublic: true, isDeleted: false, isNSFW: false },
          select: { slug: true, updatedAt: true }
        }),
        prisma.mangaCustom.findMany({
          where: {
            deletedAt: null,
            isNSFW: false,
            organization: { isPublic: true, isDeleted: false, isNSFW: false }
          },
          select: {
            updatedAt: true,
            manga: { select: { slug: true } },
            organization: { select: { slug: true } }
          },
          take: 20000
        }),
        prisma.customList.findMany({
          where: { isPublic: true },
          select: {
            slug: true,
            updatedAt: true,
            user: { select: { slug: true } }
          },
          take: 5000
        })
      ])

      const data = {
        orgs: orgs.map((o) => ({ slug: o.slug, updatedAt: o.updatedAt })),
        mangas: mangas
          .filter((m) => m.manga?.slug && m.organization?.slug)
          .map((m) => ({
            orgSlug: m.organization.slug,
            mangaSlug: m.manga.slug,
            updatedAt: m.updatedAt
          })),
        lists: lists
          .filter((l) => l.user?.slug)
          .map((l) => ({
            userSlug: l.user.slug,
            listSlug: l.slug,
            updatedAt: l.updatedAt
          }))
      }
      cache = { data, expiresAt: Date.now() + TTL }
      return { status: true, data }
    },
    { response: t.Object({ status: t.Boolean(), data: t.Any() }) }
  )
