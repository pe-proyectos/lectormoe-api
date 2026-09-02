// Exportacion de una novela a EPUB (lo inverso de epub-pipeline). Toma la obra
// y sus capitulos (bodyMarkdown en orden) y construye un EPUB3 valido: mimetype,
// container.xml, OPF (manifest + spine), nav.xhtml (TOC) y un XHTML por capitulo.
// Las imagenes del R2 propio se descargan y se embeben para que el EPUB sea
// autocontenido; si una imagen falla, se conserva la URL remota.
import JSZip from 'jszip'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ html: false, xhtmlOut: true, linkify: true, typographer: true, breaks: false })

export interface ExportChapter {
  number: number
  title: string
  bodyMarkdown: string | null
}

export interface ExportNovel {
  title: string
  author?: string | null
  language?: string | null
  identifier?: string | null
}

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function pad(n: number, w = 4): string {
  return String(n).padStart(w, '0')
}

// Convierte el markdown del capitulo a XHTML y embebe las imagenes (descarga de
// R2). Devuelve el cuerpo XHTML y las imagenes a agregar al zip.
async function chapterToXhtml(
  markdown: string,
  imgOut: Map<string, { data: Buffer; path: string }>,
  fetchImpl: typeof fetch
): Promise<string> {
  let html = md.render(markdown || '')
  // Embeber imagenes: <img src="https://r2..." ...>
  const srcs = [...new Set([...html.matchAll(/<img[^>]*\bsrc="([^"]+)"/gi)].map((m) => m[1]))]
  for (const src of srcs) {
    if (!/^https?:\/\//i.test(src)) continue
    let entry = imgOut.get(src)
    if (!entry) {
      try {
        const res = await fetchImpl(src)
        if (!res.ok) continue
        const ct = res.headers.get('content-type') || 'image/jpeg'
        const ext = EXT_BY_MIME[ct.split(';')[0].trim()] || 'jpg'
        const buf = Buffer.from(await res.arrayBuffer())
        const path = `images/img${pad(imgOut.size + 1)}.${ext}`
        entry = { data: buf, path }
        imgOut.set(src, entry)
      } catch {
        continue
      }
    }
    // Reescribe el src a la ruta relativa dentro del EPUB.
    html = html.split(`"${src}"`).join(`"${entry.path}"`)
  }
  return html
}

export async function buildEpub(
  novel: ExportNovel,
  chapters: ExportChapter[],
  fetchImpl: typeof fetch = fetch
): Promise<Buffer> {
  const zip = new JSZip()
  // mimetype primero y sin comprimir (requisito EPUB).
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n  <rootfiles>\n    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n  </rootfiles>\n</container>`
  )

  const lang = novel.language || 'es'
  const bookId = novel.identifier || `urn:uuid:capibara-${Date.now()}`
  const images = new Map<string, { data: Buffer; path: string }>()
  const ordered = [...chapters].sort((a, b) => a.number - b.number)

  const chapterFiles: { file: string; id: string; title: string }[] = []
  for (let i = 0; i < ordered.length; i++) {
    const ch = ordered[i]
    const body = await chapterToXhtml(ch.bodyMarkdown || '', images, fetchImpl)
    const file = `chapter${pad(i + 1)}.xhtml`
    const id = `ch${i + 1}`
    const xhtml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}">\n<head><meta charset="utf-8"/><title>${esc(ch.title)}</title></head>\n<body>\n<h1>${esc(ch.title)}</h1>\n${body}\n</body>\n</html>`
    zip.file(`OEBPS/${file}`, xhtml)
    chapterFiles.push({ file, id, title: ch.title })
  }

  // Imagenes al zip.
  for (const { data, path } of images.values()) {
    zip.file(`OEBPS/${path}`, data)
  }

  // nav.xhtml (TOC EPUB3).
  const navItems = chapterFiles.map((c) => `        <li><a href="${c.file}">${esc(c.title)}</a></li>`).join('\n')
  zip.file(
    'OEBPS/nav.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}">\n<head><meta charset="utf-8"/><title>Indice</title></head>\n<body>\n  <nav epub:type="toc" id="toc">\n    <h1>Indice</h1>\n    <ol>\n${navItems}\n    </ol>\n  </nav>\n</body>\n</html>`
  )

  // OPF: manifest + spine.
  let imgIdx = 0
  const imgManifest = [...images.values()]
    .map((img) => {
      imgIdx++
      const mime = Object.entries(EXT_BY_MIME).find(([, e]) => img.path.endsWith(`.${e}`))?.[0] || 'image/jpeg'
      return `    <item id="img${imgIdx}" href="${img.path}" media-type="${mime}"/>`
    })
    .join('\n')
  const chapManifest = chapterFiles
    .map((c) => `    <item id="${c.id}" href="${c.file}" media-type="application/xhtml+xml"/>`)
    .join('\n')
  const spine = chapterFiles.map((c) => `    <itemref idref="${c.id}"/>`).join('\n')

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${lang}">\n  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n    <dc:identifier id="book-id">${esc(bookId)}</dc:identifier>\n    <dc:title>${esc(novel.title)}</dc:title>\n    <dc:language>${lang}</dc:language>\n    ${novel.author ? `<dc:creator>${esc(novel.author)}</dc:creator>` : ''}\n    <meta property="dcterms:modified">${new Date(0).toISOString().replace(/\.\d+Z$/, 'Z')}</meta>\n  </metadata>\n  <manifest>\n    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n${chapManifest}\n${imgManifest}\n  </manifest>\n  <spine>\n${spine}\n  </spine>\n</package>`
  )

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
