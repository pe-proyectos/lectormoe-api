// Importacion de EPUB -> capitulos de novela. Respeta el orden del spine,
// mapea el TOC (nav EPUB3 o NCX EPUB2) a titulos/volumenes, extrae las
// imagenes internas a R2 y devuelve markdown con ![alt](urlR2 "w100") en su
// posicion exacta. Funcion pura respecto a la BD: no crea capitulos, solo los
// devuelve para que el llamador los revise/persista.
import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'
import { uploadFile } from './files'
import { htmlWithImagesToMarkdown } from './markdown-pipeline'

const MAX_SPINE_ITEMS = 2000
const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB por imagen
const MAX_TOTAL_IMAGE_BYTES = 200 * 1024 * 1024 // 200MB total (anti zip-bomb)

const IMAGE_EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

export interface EpubChapter {
  number: number
  title: string
  volumeNumber: number | null
  bodyMarkdown: string
}

export interface EpubParseResult {
  chapters: EpubChapter[]
  images: number
  warnings: string[]
  bookTitle: string | null
}

export interface EpubParseOptions {
  organizationSlug?: string
  organizationId?: number
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  textNodeName: '#text',
})

function asArray<T>(x: T | T[] | undefined | null): T[] {
  if (x == null) return []
  return Array.isArray(x) ? x : [x]
}

// Resuelve una ruta relativa dentro del zip contra un directorio base,
// normalizando '.' y '..'. Nunca deja escapar de la raiz (anti path-traversal).
function resolvePath(baseDir: string, href: string): string {
  const clean = decodeURIComponent((href || '').split('#')[0])
  const parts = (baseDir ? baseDir.split('/') : []).concat(clean.split('/'))
  const stack: string[] = []
  for (const p of parts) {
    if (p === '' || p === '.') continue
    if (p === '..') {
      stack.pop()
      continue
    }
    stack.push(p)
  }
  return stack.join('/')
}

function dirOf(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i)
}

// Extrae texto plano de un nodo de titulo del NCX/nav (puede venir anidado).
function textOf(node: any): string {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  if (typeof node === 'object') {
    if (node['#text'] != null) return String(node['#text'])
    return Object.values(node).map(textOf).join(' ')
  }
  return ''
}

// Construye el mapa href(normalizado) -> { title, volumeIndex } a partir del
// nav EPUB3 (lista <ol><li><a>). Si hay anidamiento, el nivel 1 son volumenes.
function parseNavToc(
  navXml: string,
  navDir: string
): Map<string, { title: string; volumeIndex: number | null; volumeTitle: string | null }> {
  const map = new Map<string, { title: string; volumeIndex: number | null; volumeTitle: string | null }>()
  let doc: any
  try {
    doc = parser.parse(navXml)
  } catch {
    return map
  }
  // Busca el primer <nav> con una <ol>.
  const navs = findAll(doc, 'nav')
  const toc = navs.find((n) => n && n.ol) || navs[0]
  if (!toc || !toc.ol) return map

  const topItems = asArray(toc.ol.li)
  const hasNesting = topItems.some((li: any) => li && li.ol)
  let volumeIndex = 0
  for (const li of topItems) {
    if (li && li.ol && hasNesting) {
      volumeIndex += 1
      const volTitle = textOf(li.a) || textOf(li.span) || `Volumen ${volumeIndex}`
      for (const child of asArray(li.ol.li)) {
        addNavLeaf(map, child, navDir, volumeIndex, volTitle)
      }
    } else {
      addNavLeaf(map, li, navDir, hasNesting ? null : null, null)
    }
  }
  return map
}

function addNavLeaf(
  map: Map<string, { title: string; volumeIndex: number | null; volumeTitle: string | null }>,
  li: any,
  navDir: string,
  volumeIndex: number | null,
  volumeTitle: string | null
) {
  if (!li) return
  const a = li.a
  if (!a) return
  const href = a['@_href']
  if (!href) return
  const key = resolvePath(navDir, href)
  const title = textOf(a).trim()
  if (!map.has(key)) map.set(key, { title, volumeIndex, volumeTitle })
}

// Recorre recursivamente un objeto parseado y devuelve todos los nodos con la
// clave dada (para encontrar <nav> aunque este anidado).
function findAll(obj: any, key: string): any[] {
  const out: any[] = []
  const walk = (o: any) => {
    if (o == null || typeof o !== 'object') return
    for (const k of Object.keys(o)) {
      if (k === key) out.push(...asArray(o[k]))
      walk(o[k])
    }
  }
  walk(obj)
  return out
}

// TOC EPUB2 (NCX): navMap -> navPoint (anidado) -> content@src, navLabel.text.
function parseNcxToc(
  ncxXml: string,
  ncxDir: string
): Map<string, { title: string; volumeIndex: number | null; volumeTitle: string | null }> {
  const map = new Map<string, { title: string; volumeIndex: number | null; volumeTitle: string | null }>()
  let doc: any
  try {
    doc = parser.parse(ncxXml)
  } catch {
    return map
  }
  const navMap = doc?.ncx?.navMap
  if (!navMap) return map
  const top = asArray(navMap.navPoint)
  const hasNesting = top.some((np: any) => np && np.navPoint)
  let volumeIndex = 0
  for (const np of top) {
    if (np && np.navPoint && hasNesting) {
      volumeIndex += 1
      const volTitle = textOf(np.navLabel?.text) || `Volumen ${volumeIndex}`
      for (const child of asArray(np.navPoint)) {
        addNcxLeaf(map, child, ncxDir, volumeIndex, volTitle)
      }
    } else {
      addNcxLeaf(map, np, ncxDir, null, null)
    }
  }
  return map
}

function addNcxLeaf(
  map: Map<string, { title: string; volumeIndex: number | null; volumeTitle: string | null }>,
  np: any,
  ncxDir: string,
  volumeIndex: number | null,
  volumeTitle: string | null
) {
  if (!np) return
  const src = np.content?.['@_src']
  if (!src) return
  const key = resolvePath(ncxDir, src)
  const title = textOf(np.navLabel?.text).trim()
  if (!map.has(key)) map.set(key, { title, volumeIndex, volumeTitle })
}

export async function parseEpub(
  buffer: Buffer,
  opts: EpubParseOptions = {}
): Promise<EpubParseResult> {
  const warnings: string[] = []
  let imageCount = 0
  let totalImageBytes = 0

  const zip = await JSZip.loadAsync(buffer)

  // 1. container.xml -> ruta del OPF.
  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) throw new Error('EPUB invalido: falta META-INF/container.xml.')
  const containerDoc = parser.parse(await containerFile.async('text'))
  const rootfile = asArray(containerDoc?.container?.rootfiles?.rootfile)[0]
  const opfPath = rootfile?.['@_full-path']
  if (!opfPath) throw new Error('EPUB invalido: no se encontro el OPF.')
  const opfDir = dirOf(opfPath)

  // 2. OPF: manifest + spine + metadata.
  const opfFile = zip.file(opfPath)
  if (!opfFile) throw new Error('EPUB invalido: OPF no encontrado en el zip.')
  const opf = parser.parse(await opfFile.async('text'))
  const pkg = opf?.package
  if (!pkg) throw new Error('EPUB invalido: OPF sin <package>.')

  const bookTitle = textOf(pkg.metadata?.title) || null

  const manifestItems = asArray(pkg.manifest?.item)
  const byId = new Map<string, any>()
  for (const it of manifestItems) if (it?.['@_id']) byId.set(it['@_id'], it)

  // 3. TOC: nav EPUB3 (properties~=nav) o NCX EPUB2.
  let tocMap = new Map<string, { title: string; volumeIndex: number | null; volumeTitle: string | null }>()
  const navItem = manifestItems.find((it) => (it?.['@_properties'] || '').split(/\s+/).includes('nav'))
  if (navItem?.['@_href']) {
    const navPath = resolvePath(opfDir, navItem['@_href'])
    const navFile = zip.file(navPath)
    if (navFile) tocMap = parseNavToc(await navFile.async('text'), dirOf(navPath))
  }
  if (tocMap.size === 0) {
    const ncxItem =
      manifestItems.find((it) => it?.['@_media-type'] === 'application/x-dtbncx+xml') ||
      (pkg.spine?.['@_toc'] ? byId.get(pkg.spine['@_toc']) : undefined)
    if (ncxItem?.['@_href']) {
      const ncxPath = resolvePath(opfDir, ncxItem['@_href'])
      const ncxFile = zip.file(ncxPath)
      if (ncxFile) tocMap = parseNcxToc(await ncxFile.async('text'), dirOf(ncxPath))
    }
  }

  // 4. Spine en orden.
  const itemrefs = asArray(pkg.spine?.itemref)
  if (itemrefs.length === 0) throw new Error('EPUB invalido: spine vacio.')
  if (itemrefs.length > MAX_SPINE_ITEMS) throw new Error('EPUB demasiado grande (spine).')

  // Cache de imagenes ya subidas (por ruta en el zip) para no duplicar.
  const uploadedImages = new Map<string, string>()

  const chapters: EpubChapter[] = []
  let number = 0

  for (const ref of itemrefs) {
    const idref = ref?.['@_idref']
    if (!idref) continue
    // linear="no" suele ser material auxiliar (portada, notas); lo saltamos.
    if (ref['@_linear'] === 'no') continue
    const item = byId.get(idref)
    if (!item?.['@_href']) continue
    const mediaType = item['@_media-type'] || ''
    if (!mediaType.includes('html') && !mediaType.includes('xml')) continue

    const docPath = resolvePath(opfDir, item['@_href'])
    const docFile = zip.file(docPath)
    if (!docFile) {
      warnings.push(`Documento del spine no encontrado: ${docPath}`)
      continue
    }
    let html = await docFile.async('text')
    const docDir = dirOf(docPath)

    // 5. Imagenes: subir a R2 y reescribir src en el HTML.
    const imgSrcs = extractImgSrcs(html)
    for (const rawSrc of imgSrcs) {
      if (/^https?:\/\//i.test(rawSrc) || rawSrc.startsWith('data:')) continue
      const imgPath = resolvePath(docDir, rawSrc)
      let url = uploadedImages.get(imgPath)
      if (!url) {
        const imgFile = zip.file(imgPath)
        if (!imgFile) {
          warnings.push(`Imagen no encontrada: ${imgPath}`)
          continue
        }
        try {
          const data = await imgFile.async('nodebuffer')
          if (data.length > MAX_IMAGE_BYTES) {
            warnings.push(`Imagen omitida por tamano: ${imgPath}`)
            continue
          }
          totalImageBytes += data.length
          if (totalImageBytes > MAX_TOTAL_IMAGE_BYTES) {
            throw new Error('EPUB excede el tamano total de imagenes permitido.')
          }
          const manifestImg = manifestItems.find(
            (it) => resolvePath(opfDir, it?.['@_href'] || '') === imgPath
          )
          const mt = manifestImg?.['@_media-type'] || 'image/png'
          const ext = IMAGE_EXT_BY_MIME[mt] || 'png'
          url = await uploadFile(data, `novel_${Date.now()}.${ext}`, opts.organizationSlug, opts.organizationId, 'novels')
          uploadedImages.set(imgPath, url)
          imageCount += 1
        } catch (e: any) {
          if (String(e?.message || '').includes('tamano total')) throw e
          warnings.push(`No se pudo subir la imagen ${imgPath}; se omitio.`)
          continue
        }
      }
      html = replaceImgSrc(html, rawSrc, url)
    }

    const bodyMarkdown = htmlWithImagesToMarkdown(html)
    // Saltar documentos vacios (paginas de estilo, portadas sin texto).
    if (!bodyMarkdown.trim()) continue

    number += 1
    const tocEntry = tocMap.get(docPath)
    const title =
      (tocEntry?.title && tocEntry.title.trim()) ||
      firstHeading(bodyMarkdown) ||
      baseName(docPath) ||
      `Capitulo ${number}`
    chapters.push({
      number,
      title: title.slice(0, 250),
      volumeNumber: tocEntry?.volumeIndex ?? null,
      bodyMarkdown,
    })
  }

  if (chapters.length === 0) throw new Error('No se pudo extraer ningun capitulo con texto del EPUB.')

  return { chapters, images: imageCount, warnings, bookTitle }
}

// --- helpers de HTML/markdown ---

function extractImgSrcs(html: string): string[] {
  const out: string[] = []
  const re = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) out.push(m[1])
  // xlink:href (imagenes SVG referenciadas)
  const re2 = /<image\b[^>]*?\b(?:xlink:href|href)\s*=\s*["']([^"']+)["']/gi
  while ((m = re2.exec(html)) !== null) out.push(m[1])
  return [...new Set(out)]
}

function replaceImgSrc(html: string, from: string, to: string): string {
  // Reemplaza el src exacto (escapando caracteres de regex del origen).
  const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return html.replace(new RegExp(`(src\\s*=\\s*["'])${esc}(["'])`, 'g'), `$1${to}$2`)
}

function firstHeading(md: string): string | null {
  const m = md.match(/^\s{0,3}#{1,3}\s+(.+)$/m)
  return m ? m[1].trim() : null
}

function baseName(path: string): string {
  const b = path.split('/').pop() || ''
  return b.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim()
}
