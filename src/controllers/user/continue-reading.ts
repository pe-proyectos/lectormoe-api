import { prisma } from '../../models/prisma';

// Función (no const): `new Date()` debe evaluarse por petición, no al cargar el
// módulo, o los capítulos publicados después del arranque no aparecerían.
const releasedFilter = () => ({
  deletedAt: null,
  isUnreleased: false,
  OR: [{ releasedAt: null }, { releasedAt: { lte: new Date() } }],
});

// "Continuar leyendo" a partir del HISTORIAL DE LECTURA (todo lo que el usuario
// ha leído), no solo de su lista marcada. Antes salía de `userList`, así que un
// manga leído pero no agregado a la lista nunca aparecía. Ahora agrupa el
// historial por obra (la lectura más reciente de cada una) y sugiere el
// siguiente capítulo disponible.
export const getContinueReading = async (userId: number) => {
  const history = await prisma.userChapterHistory.findMany({
    where: { userId, finishedAt: { not: null } },
    orderBy: { finishedAt: 'desc' },
    take: 100,
    select: {
      finishedAt: true,
      chapter: { select: { number: true, mangaCustomId: true, jointId: true } },
    },
  });

  // Agrupa por obra quedándose con la lectura MÁS RECIENTE de cada una.
  type Last = { kind: 'mangaCustom' | 'joint'; id: number; lastNumber: number; finishedAt: Date | null };
  const seen = new Set<string>();
  const lasts: Last[] = [];
  for (const h of history) {
    const ch = h.chapter;
    if (!ch) continue;
    if (ch.mangaCustomId) {
      const key = `m:${ch.mangaCustomId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lasts.push({ kind: 'mangaCustom', id: ch.mangaCustomId, lastNumber: ch.number, finishedAt: h.finishedAt });
    } else if (ch.jointId) {
      const key = `j:${ch.jointId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lasts.push({ kind: 'joint', id: ch.jointId, lastNumber: ch.number, finishedAt: h.finishedAt });
    }
    if (lasts.length >= 15) break;
  }

  const results: any[] = [];
  for (const last of lasts) {
    if (results.length >= 8) break;

    if (last.kind === 'mangaCustom') {
      const mc = await prisma.mangaCustom.findFirst({
        where: { id: last.id, deletedAt: null },
        select: {
          id: true,
          title: true,
          imageUrl: true,
          organization: { select: { slug: true } },
          manga: { select: { slug: true } },
          chapters: { where: releasedFilter(), orderBy: { number: 'asc' }, select: { number: true } },
        },
      });
      if (!mc || mc.chapters.length === 0) continue;
      const next = mc.chapters.find((c) => c.number > last.lastNumber);
      if (!next) continue; // ya está al día
      results.push({
        type: 'mangaCustom',
        mangaCustomId: mc.id,
        title: mc.title,
        imageUrl: mc.imageUrl,
        orgSlug: mc.organization.slug,
        mangaSlug: mc.manga?.slug,
        nextChapterNumber: next.number,
        lastReadAt: last.finishedAt,
      });
    } else {
      const joint = await prisma.mangaJoint.findFirst({
        where: { id: last.id, deletedAt: null },
        select: {
          id: true,
          slug: true,
          title: true,
          imageUrl: true,
          chapters: { where: releasedFilter(), orderBy: { number: 'asc' }, select: { number: true } },
        },
      });
      if (!joint || joint.chapters.length === 0) continue;
      const next = joint.chapters.find((c) => c.number > last.lastNumber);
      if (!next) continue;
      results.push({
        type: 'joint',
        jointId: joint.id,
        jointSlug: joint.slug,
        title: joint.title,
        imageUrl: joint.imageUrl,
        nextChapterNumber: next.number,
        lastReadAt: last.finishedAt,
      });
    }
  }

  return results;
};
