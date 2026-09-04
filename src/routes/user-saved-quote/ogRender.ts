import { createCanvas, registerFont } from 'canvas'

// Registra fuentes empaquetadas (el contenedor de prod no trae fuentes del
// sistema, si no el canvas dibuja cajas/tofu). Se hace una sola vez.
let fontsReady = false
function ensureFonts() {
  if (fontsReady) return
  fontsReady = true
  const dir = `${import.meta.dir}/fonts`
  try {
    registerFont(`${dir}/FreeSerif.ttf`, { family: 'CapiSerif' })
    registerFont(`${dir}/FreeSerifBold.ttf`, { family: 'CapiSerif', weight: 'bold' })
    registerFont(`${dir}/FreeSerifItalic.ttf`, { family: 'CapiSerif', style: 'italic' })
    registerFont(`${dir}/FreeSans.ttf`, { family: 'CapiSans' })
    registerFont(`${dir}/FreeSansBold.ttf`, { family: 'CapiSans', weight: 'bold' })
  } catch { /* si ya estaban registradas o falta el archivo, seguimos */ }
}

// Render server-side de la tarjeta de cita para og:image (1200x630).
// Espeja el dibujo del cliente (QuoteCard) con fuentes genericas del sistema.

export interface CardConfig {
  theme?: string
  accent?: string
  font?: string
  maxChars?: number
  note?: string
  noteMode?: string
}

const THEMES: Record<string, { bg1: string; bg2: string; text: string; sub: string; frame: string }> = {
  dark: { bg1: '#111a27', bg2: '#070b11', text: '#eef1f4', sub: 'rgba(255,255,255,0.45)', frame: 'rgba(255,255,255,0.10)' },
  paper: { bg1: '#f8f3e8', bg2: '#efe6d3', text: '#2b2318', sub: 'rgba(43,35,24,0.5)', frame: 'rgba(43,35,24,0.14)' },
  ink: { bg1: '#1a1a1a', bg2: '#000000', text: '#f5f5f5', sub: 'rgba(255,255,255,0.4)', frame: 'rgba(255,255,255,0.12)' },
  midnight: { bg1: '#1e1b4b', bg2: '#0b1020', text: '#eef2ff', sub: 'rgba(226,232,255,0.5)', frame: 'rgba(199,210,254,0.14)' },
}
const FONTS: Record<string, { body: string; head: string }> = {
  serif: { body: 'CapiSerif', head: 'CapiSans' },
  sans: { body: 'CapiSans', head: 'CapiSans' },
  display: { body: 'CapiSerif', head: 'CapiSerif' },
}

function wrap(ctx: any, text: string, maxWidth: number): string[] {
  const out: string[] = []
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (!words.length) { out.push(''); continue }
    let line = ''
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = w } else line = test
    }
    if (line) out.push(line)
  }
  return out
}

export function renderOgPng(opts: {
  text: string
  title: string
  chapterLabel: string
  scanName?: string | null
  username?: string | null
  config?: CardConfig | null
}): Buffer {
  ensureFonts()
  const W = 1200, H = 630
  const cfg = opts.config || {}
  const pal = THEMES[cfg.theme || 'dark'] || THEMES.dark
  const font = FONTS[cfg.font || 'serif'] || FONTS.serif
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(cfg.accent || '') ? (cfg.accent as string) : '#22d3ee'
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  const PAD = Math.round(Math.min(W, H) * 0.095)

  const rg = ctx.createRadialGradient(W * 0.3, H * 0.25, 120, W * 0.5, H * 0.6, Math.max(W, H))
  rg.addColorStop(0, pal.bg1); rg.addColorStop(1, pal.bg2)
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H)

  const m = Math.round(PAD * 0.36)
  ctx.strokeStyle = pal.frame; ctx.lineWidth = 2; ctx.strokeRect(m, m, W - m * 2, H - m * 2)

  const qSize = Math.round(Math.min(W, H) * 0.26)
  ctx.fillStyle = accent; ctx.globalAlpha = 0.15
  ctx.font = `700 ${qSize}px CapiSerif`; ctx.textBaseline = 'top'
  ctx.fillText('“', PAD - qSize * 0.06, PAD - qSize * 0.14)
  ctx.globalAlpha = 1

  const footZone = Math.round(H * 0.24)
  const footY = H - footZone
  const maxChars = Math.min(600, Math.max(60, cfg.maxChars || 460))
  const note = (cfg.note || '').trim()
  const noteInImage = cfg.noteMode === 'image' && note.length > 0
  const noteReserve = noteInImage ? Math.round(H * 0.11) : 0
  const topLimit = PAD + Math.round(qSize * 0.42)
  const bottomLimit = footY - Math.round(PAD * 0.5) - noteReserve
  const maxW = W - PAD * 2
  const clipped = opts.text.length > maxChars ? opts.text.slice(0, maxChars).trimEnd() + '…' : opts.text
  const body = `“${clipped}”`
  const region = bottomLimit - topLimit

  let fontSize = 54, lines: string[] = [], lineH = 0
  for (fontSize = 54; fontSize >= 22; fontSize -= 2) {
    ctx.font = `400 ${fontSize}px ${font.body}`
    lineH = Math.round(fontSize * 1.46)
    lines = wrap(ctx, body, maxW)
    if (lines.length * lineH <= region) break
  }
  if (lines.length * lineH > region) {
    const maxLines = Math.max(1, Math.floor(region / lineH))
    lines = lines.slice(0, maxLines)
    if (lines.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/[\s”]*$/, '') + '…”'
  }
  ctx.font = `400 ${fontSize}px ${font.body}`; ctx.fillStyle = pal.text; ctx.textAlign = 'left'
  let y = topLimit + Math.max(0, (region - lines.length * lineH) / 2)
  for (const ln of lines) { ctx.fillText(ln, PAD, y); y += lineH }

  if (noteInImage) {
    const nS = Math.round(fontSize * 0.62)
    ctx.font = `italic 400 ${nS}px ${font.body}`; ctx.fillStyle = pal.sub
    const nLines = wrap(ctx, note, maxW).slice(0, 3)
    let ny = footY - noteReserve + Math.round(nS * 0.4)
    for (const ln of nLines) { ctx.fillText(ln, PAD, ny); ny += Math.round(nS * 1.4) }
    if (opts.username) { ctx.fillStyle = pal.sub; ctx.font = `700 ${Math.round(nS * 0.85)}px ${font.head}`; ctx.fillText(`— ${opts.username}`, PAD, ny) }
  }

  const fTop = footY + Math.round(footZone * 0.14)
  ctx.textAlign = 'left'; ctx.fillStyle = accent; ctx.fillRect(PAD, fTop, Math.round(PAD * 0.7), 5)
  const titleSize = Math.round(Math.min(W, H) * 0.045)
  const brandSize = Math.round(titleSize * 0.6)
  const scanSize = Math.round(titleSize * 0.66)
  const scan = (opts.scanName || '').trim()

  ctx.textAlign = 'right'
  ctx.font = `700 ${scanSize}px ${font.head}`
  const scanW = scan ? ctx.measureText(scan).width : 0
  ctx.font = `600 ${brandSize}px ${font.head}`
  const brandW = ctx.measureText('capibaratraductor.com').width
  const rightW = Math.max(scanW, brandW)
  const availLeft = (W - PAD * 2) - rightW - Math.round(PAD * 0.6)

  let tSize = titleSize
  let tLines: string[] = []
  for (tSize = titleSize; tSize >= Math.round(titleSize * 0.62); tSize -= 2) {
    ctx.font = `800 ${tSize}px ${font.head}`
    tLines = wrap(ctx, opts.title, availLeft)
    if (tLines.length <= 2) break
  }
  if (tLines.length > 2) {
    tLines = tLines.slice(0, 2)
    ctx.font = `800 ${tSize}px ${font.head}`
    let last = tLines[1]
    while (last.length > 1 && ctx.measureText(last + '…').width > availLeft) last = last.slice(0, -1)
    tLines[1] = last.replace(/\s+$/, '') + '…'
  }

  ctx.textAlign = 'left'
  ctx.fillStyle = pal.text; ctx.font = `800 ${tSize}px ${font.head}`
  let ty = fTop + Math.round(tSize * 0.85)
  for (const ln of tLines) { ctx.fillText(ln, PAD, ty); ty += Math.round(tSize * 1.16) }
  ctx.fillStyle = accent; ctx.font = `700 ${Math.round(titleSize * 0.62)}px ${font.head}`
  ctx.fillText(opts.chapterLabel.toUpperCase(), PAD, ty + Math.round(titleSize * 0.15))

  ctx.textAlign = 'right'
  if (scan) { ctx.fillStyle = pal.text; ctx.font = `700 ${scanSize}px ${font.head}`; ctx.fillText(scan, W - PAD, fTop + Math.round(titleSize * 0.85)) }
  ctx.fillStyle = pal.sub; ctx.font = `600 ${brandSize}px ${font.head}`
  ctx.fillText('capibaratraductor.com', W - PAD, fTop + Math.round(titleSize * (scan ? 1.75 : 1.0)))

  return canvas.toBuffer('image/png')
}
