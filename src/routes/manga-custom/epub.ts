import { Elysia } from 'elysia'
import { prisma } from '../../models/prisma'
import { getMangaCustomBySlug } from '../../controllers/manga-custom/get'
import { useOrganization } from '../../plugins/organization'
import { loggedOptional } from '../../plugins/auth'
import { buildEpub } from '../../services/epub-export'

// Exporta una novela (obra de texto) a EPUB con sus capitulos en orden.
export const router = () =>
  new Elysia()
    .use(useOrganization())
    .use(loggedOptional())
    .get('/api/manga-custom/:mangaSlug/epub', async ({ organizationId, user, params: { mangaSlug }, set }) => {
      const manga: any = await getMangaCustomBySlug(organizationId, mangaSlug, user)
      if (!manga) throw new Error('Novela no encontrada.')

      const chapters = await prisma.chapter.findMany({
        where: { mangaCustomId: manga.id, deletedAt: null, bodyMarkdown: { not: null } },
        select: { number: true, title: true, bodyMarkdown: true },
        orderBy: { number: 'asc' },
      })
      if (chapters.length === 0) throw new Error('La novela no tiene capitulos de texto para exportar.')

      const author = Array.isArray(manga.authors) && manga.authors.length
        ? manga.authors.map((a: any) => a.name).filter(Boolean).join(', ')
        : null

      const buf = await buildEpub(
        { title: manga.title || 'Novela', author, language: 'es', identifier: `urn:capibara:${manga.id}` },
        chapters
      )

      const safe = (manga.title || 'novela')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '') || 'novela'

      set.headers['content-type'] = 'application/epub+zip'
      set.headers['content-disposition'] = `attachment; filename="${safe}.epub"`
      return new Response(new Uint8Array(buf))
    })
