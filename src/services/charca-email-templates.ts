/**
 * Plantillas de correo de La Charca (lacharca.com), la comunidad donde viven
 * los comentarios. Identidad propia: fondo claro, azul de marca y el logo LC.
 * Nada que ver con el tema oscuro de CapibaraTraductor.
 */

const CHARCA_URL = process.env.CHARCA_URL || 'https://lacharca.com'
const LOGO = `${CHARCA_URL}/logo.png`

const esc = (s: string) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

function base(content: string, unsubscribeUrl?: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#eef3fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="background-color:#eef3fb;padding:32px 16px;">
    <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dfe7f3;">
      <div style="padding:28px 32px 20px;text-align:center;border-bottom:1px solid #dfe7f3;">
        <img src="${LOGO}" alt="La Charca" width="52" height="52" style="display:block;margin:0 auto 10px;width:52px;height:52px;">
        <span style="color:#101f38;font-size:20px;font-weight:700;letter-spacing:-0.5px;">La Charca</span>
        <p style="margin:4px 0 0;color:#8a97ac;font-size:12px;">La comunidad de CapibaraTraductor</p>
      </div>
      <div style="padding:28px 32px;color:#4a5a75;font-size:15px;line-height:1.65;">
        ${content}
      </div>
      <div style="padding:22px 32px;text-align:center;border-top:1px solid #dfe7f3;">
        <p style="color:#8a97ac;font-size:11px;margin:0 0 8px;">
          Recibes este correo porque participas en una conversación en La Charca.
        </p>
        ${unsubscribeUrl ? `<p style="margin:0 0 4px;"><a href="${unsubscribeUrl}" style="color:#8a97ac;font-size:11px;">Dejar de recibir estos avisos</a></p>` : ''}
        <p style="margin:0;"><a href="${CHARCA_URL}" style="color:#2563eb;font-size:11px;text-decoration:none;">lacharca.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>`
}

function button(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:22px auto;"><tr><td style="border-radius:999px;background-color:#2563eb;">
    <a href="${url}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:999px;">${esc(text)}</a>
  </td></tr></table>`
}

function quote(author: string, avatarUrl: string | null, text: string): string {
  const avatar = avatarUrl
    ? `<img src="${esc(avatarUrl)}" width="36" height="36" style="width:36px;height:36px;border-radius:999px;object-fit:cover;display:block;">`
    : `<div style="width:36px;height:36px;border-radius:999px;background:#dbe8fb;color:#2563eb;font-weight:700;text-align:center;line-height:36px;">${esc((author || '?')[0].toUpperCase())}</div>`
  return `<table cellpadding="0" cellspacing="0" style="width:100%;background:#f5f8fd;border:1px solid #dfe7f3;border-radius:14px;margin:18px 0;">
    <tr>
      <td style="padding:14px 16px;vertical-align:top;width:52px;">${avatar}</td>
      <td style="padding:14px 16px 14px 0;">
        <p style="margin:0 0 4px;color:#101f38;font-weight:600;font-size:14px;">${esc(author)}</p>
        <p style="margin:0;color:#4a5a75;font-size:14px;line-height:1.6;white-space:pre-wrap;">${esc(text)}</p>
      </td>
    </tr>
  </table>`
}

interface CommentMailArgs {
  /** A quién escribimos y por qué. */
  reason: 'reply' | 'thread' | 'staff' | 'mention'
  recipientName: string
  authorName: string
  authorAvatar: string | null
  commentText: string
  /** De qué se está hablando: capítulo, obra o publicación. */
  contextTitle: string
  contextKind: 'chapter' | 'manga' | 'post'
  /** Obra a la que pertenece el capítulo, si la hay. */
  workTitle?: string | null
  /** Enlace directo al comentario en La Charca. */
  commentUrl: string
  /** Enlace al capítulo en el lector, cuando aplica. */
  readerUrl?: string | null
  /** Texto al que se responde, si es una respuesta. */
  parentText?: string | null
  parentAuthor?: string | null
  unsubscribeUrl?: string
}

const REASON_LINE: Record<CommentMailArgs['reason'], string> = {
  reply: 'respondió a tu comentario',
  thread: 'escribió en una conversación en la que participas',
  staff: 'comentó en una publicación de tu scan',
  mention: 'te mencionó',
}

export function commentMail(a: CommentMailArgs): { subject: string; html: string } {
  const where =
    a.contextKind === 'chapter'
      ? `${a.workTitle ? `${a.workTitle} — ` : ''}${a.contextTitle}`
      : a.contextTitle

  const subject =
    a.reason === 'reply' ? `${a.authorName} respondió a tu comentario`
    : a.reason === 'mention' ? `${a.authorName} te mencionó en La Charca`
    : a.reason === 'staff' ? `Nuevo comentario en ${where}`
    : `${a.authorName} escribió en una conversación que sigues`

  const contextLine =
    a.contextKind === 'chapter'
      ? `En <strong style="color:#101f38;">${esc(a.contextTitle)}</strong>${a.workTitle ? ` de <strong style="color:#101f38;">${esc(a.workTitle)}</strong>` : ''}`
      : a.contextKind === 'manga'
        ? `En la página de <strong style="color:#101f38;">${esc(a.contextTitle)}</strong>`
        : `En <strong style="color:#101f38;">${esc(a.contextTitle)}</strong>`

  const html = base(`
    <p style="margin:0 0 6px;color:#101f38;font-size:19px;font-weight:600;letter-spacing:-0.3px;">
      ${esc(a.authorName)} ${REASON_LINE[a.reason]}
    </p>
    <p style="margin:0;color:#8a97ac;font-size:13px;">${contextLine}</p>

    ${a.parentText ? `
      <p style="margin:20px 0 0;color:#8a97ac;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;">Tu comentario</p>
      ${quote(a.parentAuthor || a.recipientName, null, a.parentText.slice(0, 400))}
      <p style="margin:14px 0 0;color:#8a97ac;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;">Respuesta</p>
    ` : ''}

    ${quote(a.authorName, a.authorAvatar, a.commentText.slice(0, 600))}

    ${button('Ver la conversación', a.commentUrl)}

    ${a.readerUrl ? `<p style="margin:0;text-align:center;font-size:13px;"><a href="${a.readerUrl}" style="color:#2563eb;text-decoration:none;">Ir al capítulo en CapibaraTraductor</a></p>` : ''}
  `, a.unsubscribeUrl)

  return { subject, html }
}
