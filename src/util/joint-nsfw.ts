import { prisma } from '../models/prisma'

/**
 * Clasificacion +18 de los joints.
 *
 * Un joint no tiene contenido propio: es la misma obra (`mangaId`) trabajada por
 * varios scans. Por eso su clasificacion se DERIVA y no se edita a mano:
 *
 *   - Es +18 si alguna MangaCustom viva de ese mismo manga es +18, o
 *   - si alguno de sus generos esta marcado como +18.
 *
 * Basta con que UNA de las versiones sea adulta: si una obra es +18, lo es
 * independientemente de quien la publique, y equivocarse hacia el lado
 * permisivo significa servir AdSense junto a contenido adulto.
 */
export async function calcularJointNSFW(jointId: number): Promise<boolean> {
  const joint = await prisma.mangaJoint.findUnique({
    where: { id: jointId },
    select: { mangaId: true, genres: { select: { nsfw: true } } },
  })
  if (!joint) return false

  if (joint.genres.some((g) => g.nsfw)) return true

  const adulto = await prisma.mangaCustom.findFirst({
    where: { mangaId: joint.mangaId, deletedAt: null, isNSFW: true },
    select: { id: true },
  })
  return !!adulto
}

/** Recalcula y guarda. Devuelve el valor final. */
export async function sincronizarJointNSFW(jointId: number): Promise<boolean> {
  const valor = await calcularJointNSFW(jointId)
  await prisma.mangaJoint.update({ where: { id: jointId }, data: { isNSFW: valor } })
  return valor
}

/**
 * Cuando cambia el +18 de una MangaCustom hay que revisar los joints de ese
 * mismo manga. Se llama en fire-and-forget: que falle no debe tumbar la edicion.
 */
export async function sincronizarJointsDeManga(mangaId: number): Promise<void> {
  try {
    const joints = await prisma.mangaJoint.findMany({
      where: { mangaId, deletedAt: null },
      select: { id: true },
    })
    for (const j of joints) await sincronizarJointNSFW(j.id)
  } catch (e) {
    console.error('[joint-nsfw] no se pudo sincronizar para mangaId', mangaId, e)
  }
}
