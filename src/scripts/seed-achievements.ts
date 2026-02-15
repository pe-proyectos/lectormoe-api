/**
 * Seed achievements into the database.
 * Run with: bun run src/scripts/seed-achievements.ts
 */
import { prisma } from '../models/prisma';

const ACHIEVEMENTS = [
  // ── Reading Milestones ──
  { key: 'first_chapter', title: 'Primer Capitulo', description: 'Leiste tu primer capitulo. Tu aventura acaba de comenzar!', emoji: '📖', category: 'reading', sortOrder: 1 },
  { key: 'chapters_10', title: 'Lector Novato', description: 'Has leido 10 capitulos. El habito se forma!', emoji: '📕', category: 'reading', sortOrder: 2 },
  { key: 'chapters_25', title: 'Lector Constante', description: '25 capitulos leidos. Vas por buen camino!', emoji: '📗', category: 'reading', sortOrder: 3 },
  { key: 'chapters_50', title: 'Lector Dedicado', description: '50 capitulos leidos. Tu dedicacion es impresionante!', emoji: '📚', category: 'reading', sortOrder: 4 },
  { key: 'chapters_100', title: 'Centurion del Manga', description: '100 capitulos leidos! Eres un verdadero fan!', emoji: '💯', category: 'reading', sortOrder: 5 },
  { key: 'chapters_250', title: 'Devorador de Paginas', description: '250 capitulos! No puedes parar de leer!', emoji: '🔥', category: 'reading', sortOrder: 6 },
  { key: 'chapters_500', title: 'Leyenda Lectora', description: '500 capitulos! Pocos llegan a este nivel!', emoji: '👑', category: 'reading', sortOrder: 7 },
  { key: 'chapters_1000', title: 'Dios del Manga', description: '1000 capitulos! Has alcanzado la cima!', emoji: '⚡', category: 'reading', sortOrder: 8 },

  // ── Manga Diversity ──
  { key: 'manga_3', title: 'Curioso', description: 'Has leido 3 mangas diferentes. La curiosidad te lleva lejos!', emoji: '🔍', category: 'diversity', sortOrder: 9 },
  { key: 'manga_5', title: 'Explorador', description: '5 mangas diferentes! Sigue explorando!', emoji: '🧭', category: 'diversity', sortOrder: 10 },
  { key: 'manga_10', title: 'Viajero del Manga', description: '10 mangas! Tu mundo se expande!', emoji: '🌍', category: 'diversity', sortOrder: 11 },
  { key: 'manga_20', title: 'Aventurero del Manga', description: '20 mangas! Tu diversidad lectora es admirable!', emoji: '🗺️', category: 'diversity', sortOrder: 12 },
  { key: 'manga_50', title: 'Enciclopedia Viviente', description: '50 mangas diferentes! Conoces de todo!', emoji: '📜', category: 'diversity', sortOrder: 13 },

  // ── Favorites / Collection ──
  { key: 'favorites_5', title: 'Primeros Favoritos', description: 'Tienes 5 mangas en favoritos. Tu coleccion empieza!', emoji: '💛', category: 'collection', sortOrder: 14 },
  { key: 'favorites_10', title: 'Coleccionista', description: '10 mangas en favoritos. Tu coleccion crece!', emoji: '⭐', category: 'collection', sortOrder: 15 },
  { key: 'favorites_25', title: 'Gran Coleccionista', description: '25 mangas en favoritos. Excelente gusto!', emoji: '🌟', category: 'collection', sortOrder: 16 },
  { key: 'favorites_50', title: 'Curador Experto', description: '50 mangas en favoritos! Tienes un gusto exquisito!', emoji: '💎', category: 'collection', sortOrder: 17 },

  // ── Reading Streak ──
  { key: 'streak_3', title: 'Racha Inicial', description: '3 dias seguidos leyendo. El habito comienza!', emoji: '🌱', category: 'streak', sortOrder: 18 },
  { key: 'streak_7', title: 'Semana Completa', description: '7 dias seguidos! Una semana de lectura!', emoji: '🔥', category: 'streak', sortOrder: 19 },
  { key: 'streak_14', title: 'Imparable', description: '14 dias consecutivos! No hay quien te pare!', emoji: '💪', category: 'streak', sortOrder: 20 },
  { key: 'streak_30', title: 'Maestro de la Disciplina', description: '30 dias de racha! Eres un ejemplo a seguir!', emoji: '🏆', category: 'streak', sortOrder: 21 },
  { key: 'streak_100', title: 'Legendario', description: '100 dias consecutivos! Leyenda viviente!', emoji: '🌋', category: 'streak', sortOrder: 22 },
  { key: 'streak_365', title: 'Un Ano Completo', description: '365 dias de lectura sin parar! Increible!', emoji: '👼', category: 'streak', sortOrder: 23 },

  // ── Community / Social ──
  { key: 'first_comment', title: 'Primera Palabra', description: 'Dejaste tu primer comentario. Tu voz se escucha!', emoji: '💬', category: 'community', sortOrder: 24 },
  { key: 'comments_10', title: 'Conversador', description: '10 comentarios! Te encanta compartir!', emoji: '🗣️', category: 'community', sortOrder: 25 },
  { key: 'comments_50', title: 'Voz de la Comunidad', description: '50 comentarios! Eres un pilar de la comunidad!', emoji: '📢', category: 'community', sortOrder: 26 },
  { key: 'comments_100', title: 'Influencer', description: '100 comentarios! Tu opinion cuenta!', emoji: '🎤', category: 'community', sortOrder: 27 },
  { key: 'follow_org', title: 'Primer Seguidor', description: 'Seguiste tu primer scan. Apoyando a los creadores!', emoji: '🤝', category: 'community', sortOrder: 28 },
  { key: 'follow_5_orgs', title: 'Fan de los Scans', description: 'Sigues 5 scans! Apoyas a muchos creadores!', emoji: '❤️', category: 'community', sortOrder: 29 },

  // ── Special ──
  { key: 'night_owl', title: 'Lechuza Nocturna', description: 'Leiste un capitulo entre las 2 AM y 5 AM. La noche es joven!', emoji: '🦉', category: 'special', sortOrder: 30 },
];

async function main() {
  console.log('Seeding achievements...');

  for (const achievement of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { key: achievement.key },
      create: achievement,
      update: {
        title: achievement.title,
        description: achievement.description,
        emoji: achievement.emoji,
        category: achievement.category,
        sortOrder: achievement.sortOrder,
      },
    });
    console.log(`  [${achievement.emoji}] ${achievement.key} - ${achievement.title}`);
  }

  const count = await prisma.achievement.count();
  console.log(`\nDone! ${count} achievements in database.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
