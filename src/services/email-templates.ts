/**
 * Email HTML templates for Capibara Traductor.
 * Dark theme matching the site's zinc-950/cyan-500 aesthetic.
 * All content in Spanish.
 */

function baseTemplate(content: string, unsubscribeUrl?: string): string {
  const settingsUrl = 'https://capibaratraductor.com/settings';
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="background-color:#09090b;padding:32px 16px;">
    <div style="max-width:600px;margin:0 auto;background-color:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#09090b,#18181b);padding:32px;text-align:center;border-bottom:1px solid #27272a;">
        <span style="color:#ffffff;font-size:24px;font-weight:900;letter-spacing:-0.5px;">Capibara</span><span style="color:#06b6d4;font-size:24px;font-weight:900;letter-spacing:-0.5px;">Traductor</span>
      </div>
      <!-- Content -->
      <div style="padding:32px;color:#a1a1aa;font-size:14px;line-height:1.7;">
        ${content}
      </div>
      <!-- Footer -->
      <div style="padding:24px 32px;text-align:center;border-top:1px solid #27272a;">
        <p style="color:#52525b;font-size:10px;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:0.1em;">
          &copy; ${new Date().getFullYear()} Capibara Traductor. Todos los derechos reservados.
        </p>
        ${unsubscribeUrl ? `<p style="margin:0 0 4px 0;"><a href="${unsubscribeUrl}" style="color:#52525b;font-size:10px;text-decoration:none;">Dejar de recibir este tipo de correo</a></p>` : ''}
        <p style="margin:0;"><a href="${settingsUrl}" style="color:#52525b;font-size:10px;text-decoration:none;">Gestionar todas las preferencias de email</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function ctaButton(text: string, url: string): string {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${url}" style="display:inline-block;background-color:#06b6d4;color:#09090b;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">${text}</a>
  </div>`;
}

function orgBadge(orgName: string): string {
  return `<span style="display:inline-block;background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.2);color:#06b6d4;padding:4px 12px;border-radius:999px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;">${orgName}</span>`;
}

function mangaCard(title: string, imageUrl: string | null, description: string, url: string): string {
  return `<div style="background:#09090b;border:1px solid #27272a;border-radius:12px;padding:16px;margin:12px 0;display:flex;gap:16px;">
    ${imageUrl ? `<img src="${imageUrl}" alt="${title}" style="width:60px;height:85px;border-radius:8px;object-fit:cover;" />` : ''}
    <div>
      <p style="color:#ffffff;font-weight:700;font-size:15px;margin:0 0 4px 0;">${title}</p>
      <p style="color:#71717a;font-size:12px;margin:0 0 8px 0;">${description}</p>
      <a href="${url}" style="color:#06b6d4;font-size:11px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;">Leer ahora &rarr;</a>
    </div>
  </div>`;
}

function statCard(label: string, value: string, change?: string): string {
  const changeHtml = change
    ? `<span style="color:${change.startsWith('+') ? '#10b981' : change.startsWith('-') ? '#ef4444' : '#71717a'};font-size:11px;font-weight:700;margin-left:8px;">${change}</span>`
    : '';
  return `<div style="background:#09090b;border:1px solid #27272a;border-radius:12px;padding:16px;text-align:center;flex:1;min-width:120px;">
    <p style="color:#71717a;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 8px 0;">${label}</p>
    <p style="color:#ffffff;font-size:22px;font-weight:900;margin:0;">${value}${changeHtml}</p>
  </div>`;
}

// ──────────────── Template Functions ────────────────

export function passwordResetTemplate(username: string, resetUrl: string, unsubscribeUrl?: string): string {
  return baseTemplate(`
    <h2 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:-0.5px;">
      Restablecer Contrasena
    </h2>
    <p>Hola <strong style="color:#ffffff;">${username}</strong>,</p>
    <p>Recibimos una solicitud para restablecer la contrasena de tu cuenta. Haz clic en el boton de abajo para crear una nueva contrasena:</p>
    ${ctaButton('Restablecer Contrasena', resetUrl)}
    <p style="font-size:12px;color:#52525b;">Este enlace expira en <strong style="color:#a1a1aa;">1 hora</strong>. Si no solicitaste este cambio, puedes ignorar este correo.</p>
    <p style="font-size:12px;color:#52525b;">Por seguridad, no compartas este enlace con nadie.</p>
  `, unsubscribeUrl);
}

export function emailVerificationTemplate(username: string, verifyUrl: string, unsubscribeUrl?: string): string {
  return baseTemplate(`
    <h2 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:-0.5px;">
      Verifica tu Email
    </h2>
    <p>Hola <strong style="color:#ffffff;">${username}</strong>,</p>
    <p>Gracias por registrarte en Capibara Traductor. Para completar tu registro, verifica tu direccion de correo:</p>
    ${ctaButton('Verificar Email', verifyUrl)}
    <p style="font-size:12px;color:#52525b;">Este enlace expira en <strong style="color:#a1a1aa;">24 horas</strong>.</p>
  `, unsubscribeUrl);
}

export function welcomeTemplate(username: string, exploreUrl: string, unsubscribeUrl?: string): string {
  return baseTemplate(`
    <h2 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:-0.5px;">
      Bienvenido a Capibara Traductor
    </h2>
    <p>Hola <strong style="color:#ffffff;">${username}</strong>, nos alegra tenerte aqui!</p>
    <p>Capibara Traductor es la plataforma donde encontraras los mejores manga, manhwa y manhua traducidos al espanol. Aqui puedes:</p>
    <ul style="color:#a1a1aa;padding-left:20px;">
      <li style="margin-bottom:8px;">Leer miles de capitulos gratis</li>
      <li style="margin-bottom:8px;">Seguir tus mangas favoritos y recibir alertas</li>
      <li style="margin-bottom:8px;">Guardar tu progreso de lectura</li>
      <li style="margin-bottom:8px;">Unirte a comunidades de scanlation</li>
    </ul>
    ${ctaButton('Explorar Manga', exploreUrl)}
    <p style="font-size:12px;color:#52525b;">Configura tus notificaciones en cualquier momento desde tu perfil.</p>
  `, unsubscribeUrl);
}

export function welcomeAndVerifyTemplate(username: string, verifyUrl: string, exploreUrl: string): string {
  return baseTemplate(`
    <h2 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:-0.5px;">
      Bienvenido a Capibara Traductor
    </h2>
    <p>Hola <strong style="color:#ffffff;">${username}</strong>, nos alegra tenerte aqui!</p>
    <p><strong style="color:#06b6d4;">Primero, verifica tu email</strong> para completar tu registro:</p>
    ${ctaButton('Verificar Email', verifyUrl)}
    <p style="font-size:12px;color:#52525b;margin:16px 0;">Este enlace expira en <strong style="color:#a1a1aa;">24 horas</strong>.</p>

    <div style="border-top:1px solid #27272a;margin:24px 0;padding-top:24px;">
      <h3 style="color:#ffffff;font-size:18px;font-weight:700;margin:0 0 12px 0;">Que puedes hacer en Capibara Traductor:</h3>
      <ul style="color:#a1a1aa;padding-left:20px;">
        <li style="margin-bottom:8px;">Leer miles de capitulos gratis</li>
        <li style="margin-bottom:8px;">Seguir tus mangas favoritos y recibir alertas</li>
        <li style="margin-bottom:8px;">Guardar tu progreso de lectura</li>
        <li style="margin-bottom:8px;">Unirte a comunidades de scanlation</li>
      </ul>
    </div>
    <p style="font-size:12px;color:#52525b;">Configura tus notificaciones en cualquier momento desde tu perfil.</p>
  `);
}

export function newChapterAlertTemplate(
  username: string,
  mangaTitle: string,
  chapterNumber: number | string,
  chapterTitle: string | null,
  mangaImageUrl: string | null,
  readUrl: string,
  orgName: string,
  unsubscribeUrl?: string
): string {
  const chapterLabel = chapterTitle && chapterTitle !== `Cap. ${chapterNumber}`
    ? `Capitulo ${chapterNumber} - ${chapterTitle}`
    : `Capitulo ${chapterNumber}`;
  return baseTemplate(`
    <div style="margin-bottom:12px;">${orgBadge(orgName)}</div>
    <h2 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:-0.5px;">
      Nuevo Capitulo Disponible
    </h2>
    <p>Hola <strong style="color:#ffffff;">${username}</strong>,</p>
    <p>Un nuevo capitulo de uno de tus mangas favoritos acaba de publicarse:</p>
    ${mangaCard(mangaTitle, mangaImageUrl, chapterLabel, readUrl)}
    ${ctaButton('Leer Ahora', readUrl)}
    <p style="font-size:12px;color:#52525b;">Recibes este correo porque <strong style="color:#a1a1aa;">${mangaTitle}</strong> esta en tus favoritos.</p>
  `, unsubscribeUrl);
}

export function newMangaReleaseTemplate(
  username: string,
  mangaTitle: string,
  mangaDescription: string | null,
  mangaImageUrl: string | null,
  readUrl: string,
  orgName: string,
  unsubscribeUrl?: string
): string {
  return baseTemplate(`
    <div style="margin-bottom:12px;">${orgBadge(orgName)}</div>
    <h2 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:-0.5px;">
      Nuevo Manga Publicado
    </h2>
    <p>Hola <strong style="color:#ffffff;">${username}</strong>,</p>
    <p>Un grupo que sigues acaba de publicar un nuevo manga:</p>
    ${mangaCard(mangaTitle, mangaImageUrl, mangaDescription || 'Descubre esta nueva serie', readUrl)}
    ${ctaButton('Ver Manga', readUrl)}
    <p style="font-size:12px;color:#52525b;">Recibes este correo porque sigues a <strong style="color:#a1a1aa;">${orgName}</strong>.</p>
  `, unsubscribeUrl);
}

export function dailyDigestTemplate(
  username: string,
  newChapters: Array<{ mangaTitle: string; chapterNumber: string; imageUrl: string | null; readUrl: string; orgName: string }>,
  unfinished: Array<{ mangaTitle: string; imageUrl: string | null; lastChapter: string; readUrl: string }>,
  recommendations: Array<{ mangaTitle: string; imageUrl: string | null; readUrl: string; genre: string }>,
  unsubscribeUrl?: string
): string {
  const chaptersHtml = newChapters.length > 0
    ? `<h3 style="color:#ffffff;font-size:16px;font-weight:800;margin:24px 0 12px 0;">Nuevos Capitulos</h3>
       ${newChapters.slice(0, 10).map(ch =>
         mangaCard(ch.mangaTitle, ch.imageUrl, `Cap. ${ch.chapterNumber} - ${ch.orgName}`, ch.readUrl)
       ).join('')}`
    : '';

  const unfinishedHtml = unfinished.length > 0
    ? `<h3 style="color:#ffffff;font-size:16px;font-weight:800;margin:24px 0 12px 0;">Continua Leyendo</h3>
       ${unfinished.slice(0, 5).map(m =>
         mangaCard(m.mangaTitle, m.imageUrl, `Ultimo: Cap. ${m.lastChapter}`, m.readUrl)
       ).join('')}`
    : '';

  const recsHtml = recommendations.length > 0
    ? `<h3 style="color:#ffffff;font-size:16px;font-weight:800;margin:24px 0 12px 0;">Te Puede Interesar</h3>
       ${recommendations.slice(0, 5).map(r =>
         mangaCard(r.mangaTitle, r.imageUrl, r.genre, r.readUrl)
       ).join('')}`
    : '';

  const isEmpty = !chaptersHtml && !unfinishedHtml && !recsHtml;

  return baseTemplate(`
    <h2 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:-0.5px;">
      Tu Resumen Diario
    </h2>
    <p>Hola <strong style="color:#ffffff;">${username}</strong>, esto es lo que te perdiste en las ultimas 24 horas:</p>
    ${isEmpty ? '<p style="color:#71717a;">No hay novedades por ahora. Vuelve pronto!</p>' : ''}
    ${chaptersHtml}
    ${unfinishedHtml}
    ${recsHtml}
  `, unsubscribeUrl);
}

export function weeklyReadingSummaryTemplate(
  username: string,
  stats: {
    chaptersRead: number;
    mangasRead: number;
    streakDays: number;
    topGenre: string | null;
    percentile: number | null;
  },
  unsubscribeUrl?: string
): string {
  return baseTemplate(`
    <h2 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:-0.5px;">
      Tu Semana en Numeros
    </h2>
    <p>Hola <strong style="color:#ffffff;">${username}</strong>, aqui esta tu resumen semanal de lectura:</p>
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin:20px 0;">
      ${statCard('Capitulos Leidos', String(stats.chaptersRead))}
      ${statCard('Mangas Leidos', String(stats.mangasRead))}
      ${statCard('Racha', `${stats.streakDays} dias`)}
    </div>
    ${stats.topGenre ? `<p>Tu genero favorito esta semana: <strong style="color:#06b6d4;">${stats.topGenre}</strong></p>` : ''}
    ${stats.percentile ? `<p style="color:#06b6d4;font-weight:700;">Estas en el top ${stats.percentile}% de lectores de la plataforma!</p>` : ''}
    <p style="font-size:12px;color:#52525b;">Sigue asi! Cada capitulo cuenta.</p>
  `, unsubscribeUrl);
}

export function weeklyOrgReportTemplate(
  orgName: string,
  staffName: string,
  stats: {
    totalViews: number; viewsChange: string;
    uniqueVisitors: number; visitorsChange: string;
    newFollowers: number; followersChange: string;
    revenue: number; revenueChange: string;
    activeSubscribers: number; subscribersChange: string;
    topManga: Array<{ title: string; views: number }>;
    topChapters: Array<{ manga: string; chapter: string; reads: number }>;
    platformAvgViews: number;
  },
  unsubscribeUrl?: string
): string {
  const topMangaHtml = stats.topManga.length > 0
    ? `<h3 style="color:#ffffff;font-size:14px;font-weight:800;margin:20px 0 12px 0;">Top Manga por Vistas</h3>
       <table style="width:100%;border-collapse:collapse;">
         ${stats.topManga.slice(0, 5).map((m, i) => `
           <tr style="border-bottom:1px solid #27272a;">
             <td style="padding:8px;color:#52525b;font-weight:700;">${i + 1}</td>
             <td style="padding:8px;color:#ffffff;">${m.title}</td>
             <td style="padding:8px;color:#06b6d4;text-align:right;font-weight:700;">${m.views.toLocaleString()}</td>
           </tr>
         `).join('')}
       </table>`
    : '';

  const marketSharePct = stats.platformAvgViews > 0
    ? Math.round((stats.totalViews / stats.platformAvgViews) * 100)
    : 0;

  return baseTemplate(`
    <div style="margin-bottom:12px;">${orgBadge(orgName)}</div>
    <h2 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:-0.5px;">
      Reporte Semanal
    </h2>
    <p>Hola <strong style="color:#ffffff;">${staffName}</strong>, aqui esta el resumen semanal de <strong style="color:#06b6d4;">${orgName}</strong>:</p>

    <div style="display:flex;flex-wrap:wrap;gap:12px;margin:20px 0;">
      ${statCard('Vistas', stats.totalViews.toLocaleString(), stats.viewsChange)}
      ${statCard('Visitantes', stats.uniqueVisitors.toLocaleString(), stats.visitorsChange)}
      ${statCard('Seguidores', `+${stats.newFollowers}`, stats.followersChange)}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin:12px 0 20px 0;">
      ${statCard('Ingresos', `$${stats.revenue.toFixed(2)}`, stats.revenueChange)}
      ${statCard('Suscriptores', String(stats.activeSubscribers), stats.subscribersChange)}
      ${statCard('vs Promedio', `${marketSharePct}%`)}
    </div>

    ${topMangaHtml}

    <p style="font-size:12px;color:#52525b;margin-top:24px;">Este reporte se genera automaticamente cada lunes.</p>
  `, unsubscribeUrl);
}

export function newSubscriberAlertTemplate(
  staffName: string,
  orgName: string,
  subscriberUsername: string,
  planName: string,
  amount: string,
  unsubscribeUrl?: string
): string {
  return baseTemplate(`
    <div style="margin-bottom:12px;">${orgBadge(orgName)}</div>
    <h2 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:-0.5px;">
      Nuevo Suscriptor!
    </h2>
    <p>Hola <strong style="color:#ffffff;">${staffName}</strong>,</p>
    <p>Un nuevo usuario se ha suscrito a <strong style="color:#06b6d4;">${orgName}</strong>:</p>
    <div style="background:#09090b;border:1px solid #27272a;border-radius:12px;padding:20px;margin:16px 0;text-align:center;">
      <p style="color:#ffffff;font-size:18px;font-weight:800;margin:0 0 8px 0;">${subscriberUsername}</p>
      <p style="color:#06b6d4;font-size:14px;font-weight:700;margin:0;">Plan: ${planName} - ${amount}</p>
    </div>
  `, unsubscribeUrl);
}

export function subscriptionReminderTemplate(
  username: string,
  planName: string,
  orgName: string,
  message: string,
  unsubscribeUrl?: string
): string {
  return baseTemplate(`
    <div style="margin-bottom:12px;">${orgBadge(orgName)}</div>
    <h2 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:-0.5px;">
      Aviso de Suscripcion
    </h2>
    <p>Hola <strong style="color:#ffffff;">${username}</strong>,</p>
    <p>${message}</p>
    <div style="background:#09090b;border:1px solid #27272a;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="color:#71717a;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 4px 0;">Plan</p>
      <p style="color:#ffffff;font-weight:700;margin:0;">${planName} - ${orgName}</p>
    </div>
    <p style="font-size:12px;color:#52525b;">Si tienes alguna pregunta, contacta al equipo de ${orgName}.</p>
  `, unsubscribeUrl);
}

export function failedPaymentAlertTemplate(
  staffName: string,
  orgName: string,
  subscriberUsername: string,
  planName: string,
  failedCount: number,
  unsubscribeUrl?: string
): string {
  return baseTemplate(`
    <div style="margin-bottom:12px;">${orgBadge(orgName)}</div>
    <h2 style="color:#ef4444;font-size:22px;font-weight:900;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:-0.5px;">
      Pago Fallido
    </h2>
    <p>Hola <strong style="color:#ffffff;">${staffName}</strong>,</p>
    <p>Se ha detectado un pago fallido en una suscripcion de <strong style="color:#06b6d4;">${orgName}</strong>:</p>
    <div style="background:#09090b;border:1px solid #27272a;border-radius:12px;padding:20px;margin:16px 0;">
      <p style="color:#ffffff;font-weight:700;margin:0 0 4px 0;">${subscriberUsername}</p>
      <p style="color:#71717a;font-size:13px;margin:0 0 4px 0;">Plan: ${planName}</p>
      <p style="color:#ef4444;font-size:13px;font-weight:700;margin:0;">Pagos fallidos: ${failedCount}</p>
    </div>
  `, unsubscribeUrl);
}

export function readingStreakTemplate(
  username: string,
  streakDays: number,
  unsubscribeUrl?: string
): string {
  const milestoneMessages: Record<number, string> = {
    7: 'Una semana seguida leyendo! Vas con todo!',
    14: 'Dos semanas sin parar! Eres imparable!',
    30: 'Un mes completo de lectura! Eres una leyenda!',
    60: 'Dos meses seguidos! Tu dedicacion es admirable!',
    100: '100 dias! Eres de los lectores mas dedicados de la plataforma!',
    365: 'UN ANO COMPLETO! Eres absolutamente increible!',
  };
  const message = milestoneMessages[streakDays] || `${streakDays} dias seguidos leyendo!`;

  return baseTemplate(`
    <div style="text-align:center;">
      <div style="font-size:64px;margin:0 0 16px 0;">🔥</div>
      <h2 style="color:#ffffff;font-size:28px;font-weight:900;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:-0.5px;">
        Racha de ${streakDays} Dias!
      </h2>
      <p style="color:#06b6d4;font-size:16px;font-weight:700;margin:0 0 24px 0;">${message}</p>
      <p>Hola <strong style="color:#ffffff;">${username}</strong>, tu constancia es increible. Sigue asi!</p>
    </div>
  `, unsubscribeUrl);
}

export function reEngagementTemplate(
  username: string,
  missedChapters: Array<{ mangaTitle: string; chapterCount: number; imageUrl: string | null; readUrl: string }>,
  recommendations: Array<{ mangaTitle: string; imageUrl: string | null; readUrl: string; genre: string }>,
  unsubscribeUrl?: string
): string {
  const missedHtml = missedChapters.length > 0
    ? `<h3 style="color:#ffffff;font-size:16px;font-weight:800;margin:24px 0 12px 0;">Lo Que Te Perdiste</h3>
       ${missedChapters.slice(0, 5).map(m =>
         mangaCard(m.mangaTitle, m.imageUrl, `${m.chapterCount} capitulo${m.chapterCount > 1 ? 's' : ''} nuevo${m.chapterCount > 1 ? 's' : ''}`, m.readUrl)
       ).join('')}`
    : '';

  const recsHtml = recommendations.length > 0
    ? `<h3 style="color:#ffffff;font-size:16px;font-weight:800;margin:24px 0 12px 0;">Nuevas Recomendaciones</h3>
       ${recommendations.slice(0, 3).map(r =>
         mangaCard(r.mangaTitle, r.imageUrl, r.genre, r.readUrl)
       ).join('')}`
    : '';

  return baseTemplate(`
    <h2 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:-0.5px;">
      Te Echamos de Menos!
    </h2>
    <p>Hola <strong style="color:#ffffff;">${username}</strong>, hace tiempo que no te vemos por aqui. Tus mangas favoritos te esperan!</p>
    ${missedHtml}
    ${recsHtml}
    ${ctaButton('Volver a Leer', 'https://capibaratraductor.com')}
  `, unsubscribeUrl);
}

export function monthlyRecapTemplate(
  username: string,
  monthName: string,
  stats: {
    chaptersRead: number;
    mangasRead: number;
    hoursEstimated: number;
    topManga: string | null;
    topGenre: string | null;
    favoriteCount: number;
  },
  unsubscribeUrl?: string
): string {
  return baseTemplate(`
    <div style="text-align:center;">
      <h2 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:-0.5px;">
        Tu Mes en Numeros
      </h2>
      <p style="color:#71717a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;">${monthName}</p>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin:24px 0;">
      ${statCard('Capitulos', String(stats.chaptersRead))}
      ${statCard('Mangas', String(stats.mangasRead))}
      ${statCard('Horas', `~${stats.hoursEstimated}h`)}
    </div>
    ${stats.topManga ? `<p>Manga mas leido: <strong style="color:#06b6d4;">${stats.topManga}</strong></p>` : ''}
    ${stats.topGenre ? `<p>Genero favorito: <strong style="color:#06b6d4;">${stats.topGenre}</strong></p>` : ''}
    <p>Mangas en favoritos: <strong style="color:#ffffff;">${stats.favoriteCount}</strong></p>
    <p style="font-size:12px;color:#52525b;margin-top:20px;">Gracias por ser parte de Capibara Traductor!</p>
  `, unsubscribeUrl);
}

export function topReaderTemplate(
  username: string,
  position: number,
  orgName: string,
  unsubscribeUrl?: string
): string {
  const ordinals = ['1er', '2do', '3er', '4to', '5to', '6to', '7mo', '8vo', '9no', '10mo'];
  const ordinal = ordinals[position - 1] || `#${position}`;

  return baseTemplate(`
    <div style="text-align:center;">
      <div style="font-size:64px;margin:0 0 16px 0;">🏆</div>
      <div style="margin-bottom:12px;">${orgBadge(orgName)}</div>
      <h2 style="color:#ffffff;font-size:28px;font-weight:900;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:-0.5px;">
        Top Reader!
      </h2>
      <p>Hola <strong style="color:#ffffff;">${username}</strong>,</p>
      <p>Eres el <span style="color:#06b6d4;font-size:24px;font-weight:900;">${ordinal}</span> lector mas activo de <strong style="color:#ffffff;">${orgName}</strong> esta semana!</p>
      <p style="color:#71717a;font-size:13px;margin-top:16px;">Sigue leyendo para mantener tu posicion!</p>
    </div>
  `, unsubscribeUrl);
}

export function commentReplyTemplate(
  username: string,
  replierUsername: string,
  originalComment: string,
  replyText: string,
  threadUrl: string,
  unsubscribeUrl?: string
): string {
  const truncatedOriginal = originalComment.length > 150 ? originalComment.slice(0, 150) + '...' : originalComment;
  const truncatedReply = replyText.length > 200 ? replyText.slice(0, 200) + '...' : replyText;

  return baseTemplate(`
    <h2 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:-0.5px;">
      Nueva Respuesta a tu Comentario
    </h2>
    <p>Hola <strong style="color:#ffffff;">${username}</strong>,</p>
    <p><strong style="color:#06b6d4;">${replierUsername}</strong> ha respondido a tu comentario:</p>
    <div style="background:#09090b;border:1px solid #27272a;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="color:#52525b;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 8px 0;">Tu comentario</p>
      <p style="color:#71717a;font-size:13px;margin:0;font-style:italic;">"${truncatedOriginal}"</p>
    </div>
    <div style="background:#09090b;border:1px solid rgba(6,182,212,0.2);border-radius:12px;padding:16px;margin:16px 0;">
      <p style="color:#06b6d4;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 8px 0;">${replierUsername} respondio</p>
      <p style="color:#ffffff;font-size:14px;margin:0;">"${truncatedReply}"</p>
    </div>
    ${ctaButton('Ver Conversacion', threadUrl)}
    <p style="font-size:12px;color:#52525b;">Recibes este correo porque alguien respondio a tu comentario.</p>
  `, unsubscribeUrl);
}

export function achievementTemplate(
  username: string,
  achievementTitle: string,
  achievementDescription: string,
  emoji: string,
  unsubscribeUrl?: string
): string {
  return baseTemplate(`
    <div style="text-align:center;">
      <div style="font-size:64px;margin:0 0 16px 0;">${emoji}</div>
      <h2 style="color:#ffffff;font-size:28px;font-weight:900;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:-0.5px;">
        Logro Desbloqueado!
      </h2>
      <p style="color:#06b6d4;font-size:18px;font-weight:800;margin:0 0 16px 0;">${achievementTitle}</p>
      <p>Hola <strong style="color:#ffffff;">${username}</strong>,</p>
      <p>${achievementDescription}</p>
      <p style="color:#71717a;font-size:13px;margin-top:20px;">Sigue explorando para desbloquear mas logros!</p>
    </div>
  `, unsubscribeUrl);
}

export function achievementsBatchTemplate(
  username: string,
  achievements: Array<{ key: string; title: string; emoji: string; description: string }>,
  unsubscribeUrl?: string
): string {
  if (achievements.length === 1) {
    return achievementTemplate(username, achievements[0].title, achievements[0].description, achievements[0].emoji, unsubscribeUrl);
  }

  const achievementsHtml = achievements.map((a) => `
    <div style="background:#09090b;border:1px solid #27272a;border-radius:12px;padding:20px;margin:12px 0;text-align:center;">
      <div style="font-size:40px;margin:0 0 8px 0;">${a.emoji}</div>
      <p style="color:#ffffff;font-size:16px;font-weight:800;margin:0 0 4px 0;">${a.title}</p>
      <p style="color:#71717a;font-size:12px;margin:0;">${a.description}</p>
    </div>
  `).join('');

  return baseTemplate(`
    <div style="text-align:center;">
      <div style="font-size:64px;margin:0 0 16px 0;">🏆</div>
      <h2 style="color:#ffffff;font-size:28px;font-weight:900;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:-0.5px;">
        ${achievements.length} Logros Desbloqueados!
      </h2>
      <p>Hola <strong style="color:#ffffff;">${username}</strong>, has desbloqueado nuevos logros!</p>
    </div>
    ${achievementsHtml}
    <p style="color:#71717a;font-size:13px;margin-top:20px;text-align:center;">Sigue explorando para desbloquear mas logros!</p>
  `, unsubscribeUrl);
}

export function contentRemovedTemplate(
  orgName: string,
  mangaTitle: string,
  reason: string
): string {
  return baseTemplate(`
    <h2 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:-0.5px;">
      Obra retirada de la plataforma
    </h2>
    <p>Hola equipo de <strong style="color:#ffffff;">${orgName}</strong>,</p>
    <p>Les informamos que la siguiente obra fue retirada de CapibaraTraductor por el equipo de moderacion:</p>
    <div style="background:#09090b;border:1px solid #27272a;border-radius:12px;padding:20px;margin:16px 0;">
      <p style="color:#71717a;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 8px 0;">Obra</p>
      <p style="color:#ffffff;font-weight:700;font-size:18px;margin:0 0 16px 0;">${mangaTitle}</p>
      <p style="color:#71717a;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 8px 0;">Razon</p>
      <p style="color:#f87171;font-weight:700;margin:0;">${reason}</p>
    </div>
    <p>La obra y sus capitulos dejaron de ser visibles para los lectores. Si consideran que se trata de un error, respondan a este correo o contacten al equipo de la plataforma.</p>
    <p style="font-size:12px;color:#52525b;">Publicar contenido que infrinja las politicas de la plataforma de forma reiterada puede resultar en la suspension del scan.</p>
  `);
}

export function organizationRegistrationTemplate(
  orgName: string,
  contactEmail: string,
  description: string
): string {
  return baseTemplate(`
    <h2 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:-0.5px;">
      Nueva Solicitud de Registro
    </h2>
    <p>Se ha recibido una nueva solicitud de registro de organizacion:</p>
    <div style="background:#09090b;border:1px solid #27272a;border-radius:12px;padding:20px;margin:16px 0;">
      <p style="color:#71717a;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 8px 0;">Organizacion</p>
      <p style="color:#ffffff;font-weight:700;font-size:18px;margin:0 0 16px 0;">${orgName}</p>
      <p style="color:#71717a;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 8px 0;">Email de Contacto</p>
      <p style="color:#06b6d4;font-weight:700;margin:0 0 16px 0;">${contactEmail}</p>
      <p style="color:#71717a;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 8px 0;">Descripcion</p>
      <p style="color:#a1a1aa;margin:0;">${description}</p>
    </div>
  `);
}
