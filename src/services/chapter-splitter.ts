// Splitter general de markdown -> capitulos, por encabezados (indice del doc).
// Reutilizable por docx, md y como fallback. Robusto:
//  - Si hay H1, divide por H1; si no hay H1 pero hay H2, divide por H2.
//  - El contenido antes del primer encabezado se conserva como capitulo inicial
//    (prologo) si tiene texto.
//  - Si no hay encabezados, devuelve un unico capitulo.
// No decide numeracion final (eso lo hace quien persiste); solo estructura.

export interface SplitChapter {
  title: string
  bodyMarkdown: string
}

export interface SplitOptions {
  // Nivel preferido para dividir. Por defecto 'auto' (H1, si no H2).
  level?: 1 | 2 | 'auto'
  // Titulo para el bloque inicial sin encabezado (prologo).
  prefaceTitle?: string
}

// Detecta lineas de encabezado atx (# .. ###) respetando bloques de codigo.
function findHeadings(lines: string[], level: number): number[] {
  const idxs: number[] = []
  let inFence = false
  const re = new RegExp(`^#{${level}}\\s+\\S`)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (/^\s*(```|~~~)/.test(l)) inFence = !inFence
    if (inFence) continue
    if (re.test(l)) idxs.push(i)
  }
  return idxs
}

function headingText(line: string): string {
  return line.replace(/^#{1,6}\s+/, '').replace(/\s+#+\s*$/, '').trim()
}

export function splitMarkdownIntoChapters(markdown: string, opts: SplitOptions = {}): SplitChapter[] {
  const src = (markdown || '').replace(/\r\n/g, '\n').trim()
  if (!src) return []
  const lines = src.split('\n')

  let level: number
  if (opts.level === 1 || opts.level === 2) {
    level = opts.level
  } else {
    level = findHeadings(lines, 1).length >= 2 ? 1 : findHeadings(lines, 2).length >= 2 ? 2 : 1
  }

  const heads = findHeadings(lines, level)
  // Sin (o con un solo) encabezado util: un unico capitulo.
  if (heads.length === 0) {
    return [{ title: '', bodyMarkdown: src }]
  }

  const chapters: SplitChapter[] = []

  // Prologo: contenido antes del primer encabezado.
  const first = heads[0]
  if (first > 0) {
    const pre = lines.slice(0, first).join('\n').trim()
    if (pre) chapters.push({ title: opts.prefaceTitle || 'Prologo', bodyMarkdown: pre })
  }

  for (let h = 0; h < heads.length; h++) {
    const start = heads[h]
    const end = h + 1 < heads.length ? heads[h + 1] : lines.length
    const title = headingText(lines[start])
    // El cuerpo incluye el encabezado (el lector lo usa como titulo visible).
    const body = lines.slice(start, end).join('\n').trim()
    chapters.push({ title, bodyMarkdown: body })
  }

  return chapters
}
