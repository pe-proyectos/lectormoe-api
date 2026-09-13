import { prisma } from '../models/prisma'
import { sendEmail } from './email'
import { canSendEmail, getUnsubscribeUrl } from './email-preferences'
import { commentDigestMail } from './charca-email-templates'

// Resumen horario de los comentarios que no son respuestas directas. Sin esto,
// el equipo de un scan recibiría un correo por cada comentario de sus lectores.

const MAX_POR_CORREO = 20

interface Detalle {
  author?: string
  text?: string
  url?: string
  context?: string
  work?: string | null
}

const leer = (raw: any): Detalle => {
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw || {}) } catch { return {} }
}

export async function sendCommentDigests(): Promise<{ correos: number; agrupados: number }> {
  // Pendientes de avisar: las respuestas directas ya salieron al momento y
  // quedaron marcadas.
  const pendientes = await prisma.notification.findMany({
    where: { type: 'charca_comment', emailSentAt: null, readAt: null },
    orderBy: { createdAt: 'asc' },
    take: 2000,
  })
  if (!pendientes.length) return { correos: 0, agrupados: 0 }

  const porUsuario = new Map<number, typeof pendientes>()
  for (const n of pendientes) {
    porUsuario.set(n.userId, [...(porUsuario.get(n.userId) || []), n])
  }

  let correos = 0
  for (const [userId, avisos] of porUsuario) {
    // Marcamos siempre, mande o no: si no, el cron lo reintenta para siempre.
    const ids = avisos.map((a) => a.id)
    try {
      if (await canSendEmail(userId, 'comment_on_owned_content')) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, username: true } })
        if (user?.email) {
          const items = avisos.slice(0, MAX_POR_CORREO).map((a) => {
            const d = leer(a.details)
            return {
              author: d.author || 'Alguien',
              text: d.text || '',
              context: d.context || '',
              work: d.work || null,
              url: d.url || 'https://lacharca.com',
            }
          })
          const unsubscribeUrl = await getUnsubscribeUrl(userId, 'comment_on_owned_content').catch(() => undefined)
          const { subject, html } = commentDigestMail({
            recipientName: user.username || 'Hola',
            items,
            total: avisos.length,
            unsubscribeUrl,
          })
          await sendEmail({ to: user.email, subject, html, emailType: 'comment_on_owned_content', userId })
          correos++
        }
      }
    } catch (e: any) {
      console.error('[Resumen La Charca] error con el usuario', userId, e?.message)
    }
    await prisma.notification.updateMany({ where: { id: { in: ids } }, data: { emailSentAt: new Date() } })
  }

  return { correos, agrupados: pendientes.length }
}
