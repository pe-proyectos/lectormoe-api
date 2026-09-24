import { prisma } from '../models/prisma'
import { autopostChapter } from './hilos-autopost'
import { notifyNewChapter } from './notify-new-chapter'

// Publicacion programada de capitulos (Chapter.publishAt).
//
// - publishAt = null  -> capitulo publicado (comportamiento de siempre).
// - publishAt != null -> capitulo invisible para TODO el publico hasta esa
//   fecha; solo el staff de la organizacion lo ve en el admin.
//
// Es independiente de releasedAt/isUnreleased (acceso anticipado para
// suscriptores), que sigue funcionando igual una vez publicado.

const MAX_SCHEDULE_MS = 2 * 365 * 24 * 60 * 60 * 1000

// Crea la columna al arrancar el API (idempotente). El deploy no corre
// _apply-migrations.ts, asi que sin esto el cliente de Prisma fallaria al
// leer/escribir publishAt.
export async function ensureChapterPublishAtColumn() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "chapter" ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP(6);`
  )
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "chapter_publishAt_idx" ON "chapter"("publishAt");`
  )
}

// Staff de la organizacion: unico que ve capitulos programados (admin y vista
// previa en el lector).
export function canSeeScheduledChapters(
  user: any,
  organizationId: number | null | undefined
): boolean {
  if (!user || !organizationId || !Array.isArray(user.permissions)) return false
  return user.permissions.some(
    (p: any) =>
      p.organizationId === organizationId &&
      (p.canSeeAdminPanel === true ||
        p.canCreateChapter === true ||
        p.canEditChapter === true)
  )
}

// Normaliza el publishAt que llega en create/edit.
// - undefined           -> undefined (no tocar)
// - null / '' / pasado  -> null (publicar ya)
// - fecha futura        -> Date
// Lanza si la fecha es invalida o esta demasiado lejos.
export function resolvePublishAt(
  input: unknown,
  now: Date = new Date()
): Date | null | undefined {
  if (input === undefined) return undefined
  if (input === null || input === '' || input === 'null') return null
  const d = input instanceof Date ? input : new Date(String(input))
  if (Number.isNaN(d.getTime())) {
    throw new Error('La fecha de publicación programada no es válida.')
  }
  if (d.getTime() <= now.getTime()) return null
  if (d.getTime() - now.getTime() > MAX_SCHEDULE_MS) {
    throw new Error(
      'La publicación programada no puede estar a más de 2 años.'
    )
  }
  return d
}

// Decide que hacer con publishAt al editar un capitulo.
// - setPublishAt: valor a guardar (undefined = no tocar).
// - publishNow: el capitulo estaba programado y se pide publicarlo ya; el
//   caller debe llamar a publishScheduledChapter tras guardar.
// Un capitulo ya publicado no se puede volver a programar (ya lo vio el
// publico y sus seguidores ya fueron notificados).
export function planPublishAtEdit(
  current: Date | null,
  input: unknown,
  now: Date = new Date()
): { setPublishAt?: Date; publishNow: boolean } {
  const resolved = resolvePublishAt(input, now)
  if (resolved === undefined) return { publishNow: false }
  if (resolved === null) return { publishNow: current !== null }
  if (current === null) {
    throw new Error(
      'Este capítulo ya está publicado; no se puede programar su publicación.'
    )
  }
  return { setPublishAt: resolved, publishNow: false }
}

async function sendDiscordWebhook(
  url: string,
  payload: Record<string, unknown>
) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } catch (error) {
    console.error('Error al enviar el mensaje a Discord:', error)
  }
}

// Efectos de "capitulo nuevo publicado": lastChapterAt, webhooks de Discord,
// autopost en hilos y notificaciones a seguidores (+ milestone alerts, que
// dispara notifyNewChapter). Lo usan la creacion de capitulos (cuando no se
// programan) y el cron de publicacion programada, para que ambos caminos
// hagan exactamente lo mismo.
export async function firePublishEffects(chapterId: number) {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: {
      id: true,
      number: true,
      title: true,
      imageUrl: true,
      isUnreleased: true,
      deletedAt: true,
      publishAt: true,
      mangaCustomId: true,
      jointId: true
    }
  })
  if (!chapter || chapter.deletedAt || chapter.publishAt) return

  if (chapter.mangaCustomId) {
    const mangaCustom = await prisma.mangaCustom.findUnique({
      where: { id: chapter.mangaCustomId },
      include: {
        manga: { select: { title: true, slug: true } },
        organization: {
          select: {
            name: true,
            slug: true,
            enableDiscordWebhookNewChapter: true,
            discordWebhookUrlNewChapter: true,
            discordWebhookMessageTemplateNewChapter: true
          }
        }
      }
    })
    if (!mangaCustom) return

    await prisma.mangaCustom.update({
      where: { id: mangaCustom.id },
      data: { lastChapterAt: new Date() }
    })

    const org = mangaCustom.organization
    if (org.enableDiscordWebhookNewChapter && org.discordWebhookUrlNewChapter) {
      const mangaSlug = mangaCustom.manga?.slug
      const description = org.discordWebhookMessageTemplateNewChapter
        ?.replaceAll(
          '%manga%',
          `${mangaCustom.manga?.title || mangaSlug || 'manga no encontrado'}`
        )
        .replaceAll('%chapter%', `${chapter.number}`)
        .replaceAll('%chapter_title%', `${chapter.title || ''}`)
        .replaceAll('%scan%', `${org.name || ''}`)
        .replaceAll(
          '%link%',
          `https://capibaratraductor.com/${org.slug}/manga/${mangaSlug}/chapters/${chapter.number}`
        )
      await sendDiscordWebhook(org.discordWebhookUrlNewChapter, {
        username: `${org.name}`,
        embeds: [
          {
            title: '📣 - Nuevo capítulo publicado',
            description,
            color: 0x00b0f4,
            image: { url: chapter.imageUrl || mangaCustom.imageUrl },
            timestamp: new Date().toISOString()
          }
        ]
      })
    }

    // Notificaciones a seguidores (fire-and-forget). El email lo manda el cron
    // de notificaciones 30 min despues si sigue sin leer.
    if (!chapter.isUnreleased) {
      autopostChapter(chapter.id).catch(() => {})
      notifyNewChapter({
        chapterId: chapter.id,
        mangaCustomId: chapter.mangaCustomId
      }).catch(console.error)
    }
    return
  }

  if (chapter.jointId) {
    const joint = await prisma.mangaJoint.findUnique({
      where: { id: chapter.jointId },
      include: {
        manga: { select: { title: true, slug: true } },
        members: { select: { organizationId: true, status: true } }
      }
    })
    if (!joint) return

    await prisma.mangaJoint.update({
      where: { id: joint.id },
      data: { lastChapterAt: new Date() }
    })

    const acceptedOrgIds = joint.members
      .filter((m) => m.status === 'ACCEPTED')
      .map((m) => m.organizationId)

    if (acceptedOrgIds.length > 0) {
      await prisma.mangaCustom.updateMany({
        where: {
          mangaId: joint.mangaId,
          organizationId: { in: acceptedOrgIds },
          deletedAt: null
        },
        data: { lastChapterAt: new Date() }
      })
    }

    const memberOrgs = await prisma.organization.findMany({
      where: {
        id: { in: acceptedOrgIds },
        enableDiscordWebhookNewChapter: true,
        discordWebhookUrlNewChapter: { not: null }
      },
      select: {
        name: true,
        discordWebhookUrlNewChapter: true,
        discordWebhookMessageTemplateNewChapter: true
      }
    })

    for (const org of memberOrgs) {
      const description = org.discordWebhookMessageTemplateNewChapter
        ?.replaceAll(
          '%manga%',
          joint.title || joint.manga?.title || joint.slug
        )
        .replaceAll('%chapter%', `${chapter.number}`)
        .replaceAll('%chapter_title%', chapter.title || '')
        .replaceAll('%scan%', org.name || '')
        .replaceAll(
          '%link%',
          `https://capibaratraductor.com/joint/manga/${joint.slug}/chapters/${chapter.number}`
        )
      await sendDiscordWebhook(org.discordWebhookUrlNewChapter as string, {
        username: org.name,
        embeds: [
          {
            title: '📣 - Nuevo capítulo publicado (Joint)',
            description,
            color: 0x9b59b6,
            timestamp: new Date().toISOString()
          }
        ]
      })
    }

    if (!chapter.isUnreleased) {
      notifyNewChapter({ chapterId: chapter.id, jointId: joint.id }).catch(
        console.error
      )
    }
  }
}

// Publica un capitulo programado. UPDATE condicional: si dos instancias (o el
// cron y un "publicar ya" del admin) compiten, solo una gana y solo esa
// dispara los efectos. `createdAt` pasa a ser la hora de publicacion para que
// el capitulo salga como nuevo en "ultimas actualizaciones".
export async function publishScheduledChapter(
  chapterId: number,
  publishedAt: Date = new Date()
): Promise<boolean> {
  const res = await prisma.chapter.updateMany({
    where: { id: chapterId, publishAt: { not: null } },
    data: { publishAt: null, createdAt: publishedAt }
  })
  if (res.count !== 1) return false
  await firePublishEffects(chapterId)
  return true
}

// Cron: publica los capitulos cuya hora ya llego.
export async function publishDueChapters(now: Date = new Date()) {
  const due = await prisma.chapter.findMany({
    where: { publishAt: { not: null, lte: now }, deletedAt: null },
    select: { id: true, publishAt: true },
    orderBy: [{ publishAt: 'asc' }, { number: 'asc' }],
    take: 200
  })
  let published = 0
  for (const ch of due) {
    try {
      if (await publishScheduledChapter(ch.id, ch.publishAt ?? now)) {
        published++
      }
    } catch (e) {
      console.error('[chapter-schedule] no se pudo publicar', ch.id, e)
    }
  }
  if (published > 0) {
    console.info(`[chapter-schedule] ${published} capítulo(s) publicados`)
  }
  return published
}
