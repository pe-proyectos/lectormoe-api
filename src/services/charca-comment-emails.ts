import { prisma } from '../models/prisma'
import { sendEmail } from './email'
import { canSendEmail, getUnsubscribeUrl } from './email-preferences'
import { commentMail } from './charca-email-templates'

// Avisos por correo de los comentarios que viven en La Charca. hilos.rest emite
// el evento; aquí decidimos a quién le importa y se lo contamos con contexto.

const CHARCA_URL = process.env.CHARCA_URL || 'https://lacharca.com'
const LACHARCA_API = process.env.LACHARCA_API || 'https://lacharca.com/api'

interface EventPage { handle: string; externalId: string | null; displayName?: string | null; avatarUrl?: string | null; type?: string }
interface CommentEvent {
  comment: { id: number; content: string; createdAt: string; parentCommentId: number | null }
  author: EventPage
  post: { id: number; content?: string; externalRef?: string | null; author?: EventPage | null; wall?: EventPage | null }
  replyTo: EventPage | null
  threadParticipants: EventPage[]
}

type Reason = 'reply' | 'thread' | 'staff'
interface Recipient { userId: number; email: string; name: string; reason: Reason }

// Una page puede ser de CapibaraTraductor o de La Charca. Solo la primera vive
// en esta base; para la segunda preguntamos a lacharca, que guarda su correo.
async function userFromExternalId(externalId: string | null | undefined): Promise<{ id: number; email: string; name: string } | null> {
  if (!externalId) return null

  const capibara = externalId.match(/^capibara:user:(\d+)$/)
  if (capibara) {
    const u = await prisma.user.findUnique({ where: { id: Number(capibara[1]) }, select: { id: true, email: true, username: true } })
    return u?.email ? { id: u.id, email: u.email, name: u.username || 'Lector' } : null
  }

  const charca = externalId.match(/^lacharca:user:(\d+)$/)
  if (charca) {
    try {
      const res = await fetch(`${LACHARCA_API}/internal/user/${charca[1]}`, {
        headers: { 'x-internal-secret': process.env.LACHARCA_INTERNAL_SECRET || '' },
        signal: AbortSignal.timeout(6000),
      })
      const json: any = await res.json().catch(() => ({}))
      if (!json?.status || !json?.data?.email) return null
      // Su cuenta de La Charca nació vinculada a una de CapibaraTraductor: esa
      // es la que guarda las preferencias de correo.
      const linkedId = Number(json.data.capibaraUserId || 0)
      if (!linkedId) return null
      const u = await prisma.user.findUnique({ where: { id: linkedId }, select: { id: true, email: true, username: true } })
      return u ? { id: u.id, email: json.data.email || u.email, name: json.data.displayName || u.username || 'Lector' } : null
    } catch { return null }
  }
  return null
}

// El contenido del que se habla, para poder decir "en el capítulo tal de tal obra".
async function resolveContext(post: CommentEvent['post']) {
  const ref = post.externalRef || ''
  const chapter = ref.match(/^chapter:(\d+)$/)
  if (chapter) {
    const ch = await prisma.chapter.findUnique({
      where: { id: Number(chapter[1]) },
      select: {
        number: true, title: true,
        mangaCustom: { select: { title: true, organization: { select: { id: true, slug: true } }, manga: { select: { slug: true } } } },
      },
    })
    if (ch) {
      const org = ch.mangaCustom?.organization
      const slug = ch.mangaCustom?.manga?.slug
      return {
        kind: 'chapter' as const,
        title: ch.title ? `Capítulo ${ch.number}: ${ch.title}` : `Capítulo ${ch.number}`,
        workTitle: ch.mangaCustom?.title || null,
        organizationId: org?.id ?? null,
        readerUrl: org?.slug && slug ? `https://capibaratraductor.com/${org.slug}/manga/${slug}/chapters/${ch.number}` : null,
      }
    }
  }

  const manga = ref.match(/^manga:(\d+)$/)
  if (manga) {
    const mc = await prisma.mangaCustom.findUnique({
      where: { id: Number(manga[1]) },
      select: { title: true, organizationId: true, organization: { select: { slug: true } }, manga: { select: { slug: true } } },
    })
    if (mc) {
      return {
        kind: 'manga' as const,
        title: mc.title,
        workTitle: null,
        organizationId: mc.organizationId ?? null,
        readerUrl: mc.organization?.slug && mc.manga?.slug ? `https://capibaratraductor.com/${mc.organization.slug}/manga/${mc.manga.slug}` : null,
      }
    }
  }

  return {
    kind: 'post' as const,
    title: (post.content || 'una publicación').slice(0, 80),
    workTitle: null,
    organizationId: null,
    readerUrl: null,
  }
}

// El staff del scan se entera de lo que se comenta en sus obras.
async function staffOf(organizationId: number | null): Promise<number[]> {
  if (!organizationId) return []
  const perms = await prisma.permission.findMany({
    where: { organizationId, OR: [{ canHideComment: true }, { canBanUser: true }] },
    select: { userId: true },
  }).catch(() => [])
  return perms.map((p) => p.userId)
}

// La campana de CapibaraTraductor sigue siendo la misma, pero el comentario ya
// no vive en su base: por eso guardamos el contexto en 'details' en vez de
// enlazar la fila antigua de comentarios.
async function createInAppNotifications(
  ev: CommentEvent,
  ctx: Awaited<ReturnType<typeof resolveContext>>,
  recipients: Recipient[],
  actorUserId: number | null,
  commentUrl: string,
  authorName: string,
) {
  if (!recipients.length) return
  const details = JSON.stringify({
    author: authorName,
    text: ev.comment.content.slice(0, 200),
    url: commentUrl,
    readerUrl: ctx.readerUrl,
    context: ctx.title,
    work: ctx.workTitle,
    kind: ctx.kind,
  }).slice(0, 500)

  await prisma.notification.createMany({
    data: recipients.map((r) => ({
      userId: r.userId,
      type: 'charca_comment',
      source: r.reason === 'reply' ? 'reply' : r.reason === 'staff' ? 'org_staff' : 'favorite',
      details,
      actorUserId,
      organizationId: ctx.organizationId,
      // Las respuestas directas ya salen por correo desde aquí. El resto queda
      // sin marcar para que el resumen horario las recoja.
      emailSentAt: r.reason === 'reply' ? new Date() : null,
    })),
  }).catch((e) => console.error('charca notif:', e?.message))
}

export async function handleCommentEvent(ev: CommentEvent): Promise<{ sent: number; skipped: number }> {
  const ctx = await resolveContext(ev.post)
  const authorName = ev.author.displayName || ev.author.handle
  const commentUrl = `${CHARCA_URL}/post/${ev.post.id}#c${ev.comment.id}`

  const recipients = new Map<number, Recipient>()
  const add = (u: { id: number; email: string; name: string } | null, reason: Reason) => {
    if (!u || recipients.has(u.id)) return
    recipients.set(u.id, { userId: u.id, email: u.email, name: u.name, reason })
  }

  // 1. A quien respondes es el primero en enterarse.
  if (ev.replyTo) add(await userFromExternalId(ev.replyTo.externalId), 'reply')

  // 2. El resto de participantes del hilo.
  for (const p of ev.threadParticipants || []) {
    if (ev.replyTo && p.externalId === ev.replyTo.externalId) continue
    add(await userFromExternalId(p.externalId), 'thread')
  }

  // 3. El equipo del scan dueño del contenido.
  for (const userId of await staffOf(ctx.organizationId)) {
    if ([...recipients.values()].some((r) => r.userId === userId)) continue
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, username: true } })
    if (u?.email) add({ id: u.id, email: u.email, name: u.username || 'Equipo' }, 'staff')
  }

  // Nunca se avisa a quien acaba de escribir.
  const self = await userFromExternalId(ev.author.externalId)
  if (self) recipients.delete(self.id)

  // Aviso dentro del sitio (la campana). El correo puede estar desactivado en
  // las preferencias, pero la notificación in-app siempre se crea.
  await createInAppNotifications(ev, ctx, [...recipients.values()], self?.id ?? null, commentUrl, authorName)

  let sent = 0, skipped = 0
  for (const r of recipients.values()) {
    const type = r.reason === 'reply' ? 'comment_reply' : 'comment_on_owned_content'

    // Los comentarios sueltos (staff del scan, participantes del hilo) no
    // mandan correo aquí: el resumen horario los agrupa.
    if (r.reason !== 'reply') { skipped++; continue }

    if (!(await canSendEmail(r.userId, type))) { skipped++; continue }

    const unsubscribeUrl = await getUnsubscribeUrl(r.userId, type).catch(() => undefined)
    const { subject, html } = commentMail({
      reason: r.reason,
      recipientName: r.name,
      authorName,
      authorAvatar: ev.author.avatarUrl || null,
      commentText: ev.comment.content,
      contextTitle: ctx.title,
      contextKind: ctx.kind,
      workTitle: ctx.workTitle,
      commentUrl,
      readerUrl: ctx.readerUrl,
      parentText: r.reason === 'reply' ? null : null,
      unsubscribeUrl,
    })

    const ok = await sendEmail({ to: r.email, subject, html, emailType: type, userId: r.userId }).catch(() => null)
    if (ok) sent++; else skipped++
  }

  return { sent, skipped }
}
