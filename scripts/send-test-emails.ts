/**
 * Script to send all email template examples to a test address.
 * Usage: bun run scripts/send-test-emails.ts
 */
import { Resend } from 'resend';
import * as templates from '../src/services/email-templates';

const resend = new Resend(Bun.env.RESEND_API_KEY);
const FROM = 'Capibara Traductor <noreply@capibaratraductor.com>';
const TO = 'luis.choque.castro@outlook.com';

const SAMPLE_UNSUB = 'https://capibaratraductor.com/unsubscribe?token=test-token-123&category=example';
const SAMPLE_URL = 'https://capibaratraductor.com';
const SAMPLE_IMAGE = 'https://capibaratraductor.com/logo.png';

async function send(subject: string, html: string) {
  try {
    const result = await resend.emails.send({ from: FROM, to: TO, subject, html });
    console.log(`[OK] ${subject} -> ${result.data?.id}`);
  } catch (err: any) {
    console.error(`[FAIL] ${subject}: ${err?.message}`);
  }
  // Small delay to avoid rate limits
  await new Promise(r => setTimeout(r, 500));
}

async function main() {
  console.log(`Sending all email templates to ${TO}...\n`);

  // 1. Password Reset
  await send(
    'TEST - Restablecer Contrasena',
    templates.passwordResetTemplate('Luis', `${SAMPLE_URL}/reset-password?token=abc123`)
  );

  // 2. Email Verification
  await send(
    'TEST - Verifica tu Email',
    templates.emailVerificationTemplate('Luis', `${SAMPLE_URL}/verify-email?token=abc123`)
  );

  // 3. Welcome
  await send(
    'TEST - Bienvenido a Capibara Traductor',
    templates.welcomeTemplate('Luis', SAMPLE_URL, SAMPLE_UNSUB)
  );

  // 4. New Chapter Alert
  await send(
    'TEST - Nuevo Capitulo Disponible',
    templates.newChapterAlertTemplate(
      'Luis',
      'Solo Leveling',
      45,
      'El Despertar del Monarca',
      SAMPLE_IMAGE,
      `${SAMPLE_URL}/senshi-manga/manga/solo-leveling/chapters/45`,
      'Senshi Manga',
      SAMPLE_UNSUB
    )
  );

  // 5. New Manga Release
  await send(
    'TEST - Nuevo Manga Publicado',
    templates.newMangaReleaseTemplate(
      'Luis',
      'Chainsaw Man',
      'Denji es un joven que vive en la pobreza absoluta. Para pagar las deudas de su difunto padre, trabaja como Devil Hunter junto con su demonio mascota Pochita.',
      SAMPLE_IMAGE,
      `${SAMPLE_URL}/senshi-manga/manga/chainsaw-man`,
      'Senshi Manga',
      SAMPLE_UNSUB
    )
  );

  // 6. Daily Digest
  await send(
    'TEST - Tu Resumen Diario',
    templates.dailyDigestTemplate(
      'Luis',
      [
        { mangaTitle: 'Solo Leveling', chapterNumber: '45', imageUrl: SAMPLE_IMAGE, readUrl: SAMPLE_URL, orgName: 'Senshi Manga' },
        { mangaTitle: 'One Piece', chapterNumber: '1120', imageUrl: SAMPLE_IMAGE, readUrl: SAMPLE_URL, orgName: 'Grand Line Scans' },
        { mangaTitle: 'Jujutsu Kaisen', chapterNumber: '267', imageUrl: SAMPLE_IMAGE, readUrl: SAMPLE_URL, orgName: 'Senshi Manga' },
      ],
      [
        { mangaTitle: 'Naruto', imageUrl: SAMPLE_IMAGE, lastChapter: '234', readUrl: SAMPLE_URL },
        { mangaTitle: 'Bleach', imageUrl: SAMPLE_IMAGE, lastChapter: '180', readUrl: SAMPLE_URL },
      ],
      [
        { mangaTitle: 'Demon Slayer', imageUrl: SAMPLE_IMAGE, readUrl: SAMPLE_URL, genre: 'Accion' },
        { mangaTitle: 'My Hero Academia', imageUrl: SAMPLE_IMAGE, readUrl: SAMPLE_URL, genre: 'Superheroes' },
      ],
      SAMPLE_UNSUB
    )
  );

  // 7. Weekly Reading Summary
  await send(
    'TEST - Tu Semana en Numeros',
    templates.weeklyReadingSummaryTemplate(
      'Luis',
      {
        chaptersRead: 47,
        mangasRead: 12,
        streakDays: 14,
        topGenre: 'Accion',
        percentile: 92,
      },
      SAMPLE_UNSUB
    )
  );

  // 8. Weekly Org Report
  await send(
    'TEST - Reporte Semanal - Senshi Manga',
    templates.weeklyOrgReportTemplate(
      'Senshi Manga',
      'Luis',
      {
        totalViews: 15420,
        viewsChange: '+23%',
        uniqueVisitors: 4230,
        visitorsChange: '+12%',
        newFollowers: 87,
        followersChange: '+15%',
        revenue: 234.50,
        revenueChange: '+8%',
        activeSubscribers: 156,
        subscribersChange: '+5%',
        topManga: [
          { title: 'Solo Leveling', views: 5230 },
          { title: 'Chainsaw Man', views: 3120 },
          { title: 'Jujutsu Kaisen', views: 2450 },
          { title: 'One Piece', views: 1890 },
          { title: 'Spy x Family', views: 1340 },
        ],
        topChapters: [
          { manga: 'Solo Leveling', chapter: 'Cap. 45', reads: 1230 },
          { manga: 'Chainsaw Man', chapter: 'Cap. 167', reads: 980 },
        ],
        platformAvgViews: 8500,
      },
      SAMPLE_UNSUB
    )
  );

  // 9. New Subscriber Alert
  await send(
    'TEST - Nuevo Suscriptor en Senshi Manga',
    templates.newSubscriberAlertTemplate(
      'Luis',
      'Senshi Manga',
      'NarutFan2024',
      'Premium Mensual',
      '$4.99/mes',
      SAMPLE_UNSUB
    )
  );

  // 10. Subscription Reminder
  await send(
    'TEST - Aviso de Suscripcion',
    templates.subscriptionReminderTemplate(
      'Luis',
      'Premium Mensual',
      'Senshi Manga',
      'Tu ultimo pago no pudo ser procesado. Por favor, verifica tu metodo de pago para mantener tu suscripcion activa.',
      SAMPLE_UNSUB
    )
  );

  // 11. Failed Payment Alert
  await send(
    'TEST - Pago Fallido',
    templates.failedPaymentAlertTemplate(
      'Luis',
      'Senshi Manga',
      'NarutFan2024',
      'Premium Mensual',
      3,
      SAMPLE_UNSUB
    )
  );

  // 12. Reading Streak (30 days)
  await send(
    'TEST - Racha de 30 Dias!',
    templates.readingStreakTemplate('Luis', 30, SAMPLE_UNSUB)
  );

  // 13. Re-engagement
  await send(
    'TEST - Te Echamos de Menos!',
    templates.reEngagementTemplate(
      'Luis',
      [
        { mangaTitle: 'Solo Leveling', chapterCount: 5, imageUrl: SAMPLE_IMAGE, readUrl: SAMPLE_URL },
        { mangaTitle: 'Chainsaw Man', chapterCount: 3, imageUrl: SAMPLE_IMAGE, readUrl: SAMPLE_URL },
        { mangaTitle: 'One Piece', chapterCount: 8, imageUrl: SAMPLE_IMAGE, readUrl: SAMPLE_URL },
      ],
      [
        { mangaTitle: 'Demon Slayer', imageUrl: SAMPLE_IMAGE, readUrl: SAMPLE_URL, genre: 'Accion' },
        { mangaTitle: 'Spy x Family', imageUrl: SAMPLE_IMAGE, readUrl: SAMPLE_URL, genre: 'Comedia' },
      ],
      SAMPLE_UNSUB
    )
  );

  // 14. Monthly Recap
  await send(
    'TEST - Tu Mes en Numeros: Enero',
    templates.monthlyRecapTemplate(
      'Luis',
      'Enero',
      {
        chaptersRead: 182,
        mangasRead: 23,
        hoursEstimated: 15,
        topManga: 'Solo Leveling',
        topGenre: 'Accion',
        favoriteCount: 34,
      },
      SAMPLE_UNSUB
    )
  );

  // 15. Top Reader
  await send(
    'TEST - Eres Top 1 en Senshi Manga!',
    templates.topReaderTemplate('Luis', 1, 'Senshi Manga', SAMPLE_UNSUB)
  );

  // 16. Achievement
  await send(
    'TEST - Logro Desbloqueado: Centurion del Manga!',
    templates.achievementTemplate(
      'Luis',
      'Centurion del Manga',
      '100 capitulos leidos! Eres un verdadero fan del manga!',
      '💯',
      SAMPLE_UNSUB
    )
  );

  console.log('\nDone! Check your inbox at luis.choque.castro@outlook.com');
}

main();
