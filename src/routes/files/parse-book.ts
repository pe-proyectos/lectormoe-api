import { Elysia, t } from 'elysia'
import { loggedUserOnlyGlobal } from '../../plugins/auth'
import { docxToMarkdown, cleanMarkdownInput } from '../../services/markdown-pipeline'
import { parseEpub } from '../../services/epub-pipeline'
import { splitMarkdownIntoChapters } from '../../services/chapter-splitter'

const MAX_BYTES = 50 * 1024 * 1024
const isZipMagic = (b: Uint8Array) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04

type Kind = 'epub' | 'docx' | 'md'
function detectKind(name: string, mime: string, bytes: Uint8Array): Kind | null {
  const n = (name || '').toLowerCase()
  if (n.endsWith('.epub') || mime === 'application/epub+zip') return 'epub'
  if (n.endsWith('.docx') || mime.includes('officedocument.wordprocessingml')) return 'docx'
  if (n.endsWith('.md') || n.endsWith('.markdown') || n.endsWith('.txt') || mime.startsWith('text/')) return 'md'
  // fallback por magic: zip -> asumimos epub/docx segun no podemos distinguir; docx tambien es zip.
  if (isZipMagic(bytes)) return n.endsWith('.docx') ? 'docx' : 'epub'
  return null
}

// Importador general de libros: epub, docx y md -> capitulos uniformes para el
// panel editable. Cada capitulo trae title, bodyMarkdown y (si aplica) volumen.
export const router = () =>
  new Elysia()
    .use(loggedUserOnlyGlobal())
    .post(
      '/api/files/parse-book',
      async ({ body, request }) => {
        const file = body.file as File | undefined
        if (!file) throw new Error('Falta el archivo.')
        if (file.size > MAX_BYTES) throw new Error('Archivo demasiado grande (max 50MB).')
        const bytes = new Uint8Array(await file.arrayBuffer())
        const kind = detectKind(file.name || '', file.type || '', bytes)
        if (!kind) throw new Error('Formato no soportado. Usa .epub, .docx o .md.')

        const organizationSlug = request.headers.get('x-organization') || undefined
        const warnings: string[] = []
        let images = 0
        let bookTitle: string | null = null
        let chapters: Array<{ title: string; bodyMarkdown: string; volumeNumber: number | null }> = []

        if (kind === 'epub') {
          const r = await parseEpub(Buffer.from(bytes), { organizationSlug })
          bookTitle = r.bookTitle
          images = r.images
          warnings.push(...r.warnings)
          chapters = r.chapters.map((c) => ({ title: c.title, bodyMarkdown: c.bodyMarkdown, volumeNumber: c.volumeNumber }))
        } else if (kind === 'docx') {
          const { markdown, images: imgs, warnings: w } = await docxToMarkdown(Buffer.from(bytes), { organizationSlug })
          images = imgs
          warnings.push(...w)
          chapters = splitMarkdownIntoChapters(markdown).map((c) => ({ title: c.title, bodyMarkdown: c.bodyMarkdown, volumeNumber: null }))
        } else {
          const { markdown, warnings: w } = cleanMarkdownInput(new TextDecoder().decode(bytes))
          warnings.push(...w)
          chapters = splitMarkdownIntoChapters(markdown).map((c) => ({ title: c.title, bodyMarkdown: c.bodyMarkdown, volumeNumber: null }))
        }

        if (chapters.length === 0) throw new Error('No se pudo extraer contenido del archivo.')

        return { status: true, data: { kind, bookTitle, images, warnings, chapters } }
      },
      {
        body: t.Object({ file: t.Any() }),
        response: t.Object({
          status: t.Boolean(),
          data: t.Object({
            kind: t.String(),
            bookTitle: t.Union([t.String(), t.Null()]),
            images: t.Number(),
            warnings: t.Array(t.String()),
            chapters: t.Array(
              t.Object({
                title: t.String(),
                bodyMarkdown: t.String(),
                volumeNumber: t.Union([t.Number(), t.Null()]),
              })
            ),
          }),
        }),
      }
    )
