import { prisma } from '../models/prisma'
import { createHilos } from '../lib/hilos-sdk'

// Publica automaticamente en hilos.rest (La Charca) cuando sale un capitulo.
// Fire-and-forget: nunca debe romper la publicacion del capitulo.
// Idempotente por externalRef 'chapter:<id>'.

const BASE = process.env.HILOS_BASE || 'https://hilos.rest'
const SECRET = process.env.HILOS_SECRET_KEY || ''
const enabled = () => !!SECRET && process.env.HILOS_AUTOPOST !== 'off'

export async function autopostChapter(chapterId: number): Promise<void> {
  if (!enabled()) return
  try {
    const ch = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: {
        id: true, number: true, title: true, displayNumber: true, createdAt: true, isUnreleased: true,
        mangaCustom: {
          select: {
            id: true, title: true, imageUrl: true, deletedAt: true, isPublic: true,
            manga: { select: { slug: true } },
            organization: { select: { id: true, name: true, slug: true, logoUrl: true, imageUrl: true, isNSFW: true, isDeleted: true } },
          },
        },
      },
    })
    const mc = ch?.mangaCustom
    const org = mc?.organization
    if (!ch || !mc || !org) return
    if (ch.isUnreleased || mc.deletedAt || !mc.isPublic || org.isDeleted) return

    const hilos = createHilos({ baseUrl: BASE, secretKey: SECRET })

    // Asegura la page del scan y la subpage de la obra (idempotente).
    await hilos.pages.upsert({
      externalId: `scan:${org.id}`, handle: `scan-${org.slug}`.slice(0, 40), type: 'scan',
      displayName: org.name, avatarUrl: org.logoUrl || org.imageUrl || undefined,
      metadata: { isNSFW: org.isNSFW },
    })
    await hilos.pages.upsert({
      externalId: `manga:${mc.id}`, handle: `m-${mc.manga?.slug || mc.id}-${mc.id}`.slice(0, 40), type: 'manga',
      parentExternalId: `scan:${org.id}`, displayName: mc.title, avatarUrl: mc.imageUrl || undefined,
    })

    const label = `Capítulo ${ch.displayNumber ?? ch.number}${ch.title && ch.title !== `Capítulo ${ch.number}` ? `: ${ch.title}` : ''}`
    await hilos.posts.create(
      { content: label, wallExternalId: `manga:${mc.id}`, externalRef: `chapter:${ch.id}`, createdAt: new Date(ch.createdAt).toISOString() },
      `external:scan:${org.id}`,
    )
  } catch (e: any) {
    console.error('[hilos-autopost] falló para chapter', chapterId, e?.message)
  }
}
