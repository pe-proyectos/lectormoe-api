/**
 * Unificación de géneros v2: catálogo global curado + merge de variantes/sinónimos.
 *
 * - Dry-run por defecto: solo imprime el plan y escribe el TXT de sobrantes.
 * - Con `--apply`: crea el catálogo curado global (organizationId=null), re-vincula
 *   las obras de cada género mapeable al curado y borra las filas duplicadas.
 *   Los géneros NO mapeables se dejan INTACTOS (no se pierde nada) y se listan en el TXT.
 *
 * Corre contra la DB de .env (PRODUCCIÓN). Ver docs/runbook.md.
 */
import { prisma } from '../models/prisma'
import { writeFileSync } from 'fs'

const APPLY = process.argv.includes('--apply')
const TXT_OUT = process.argv.find(a => a.startsWith('--out='))?.slice(6)
  || 'C:\\Users\\luisc\\AppData\\Local\\Temp\\claude\\C--Users-luisc-Desktop-Projects\\15893988-9d73-4b2f-885a-3212c47d4cbc\\scratchpad\\generos-sobrantes.txt'

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const slugify = (name: string) => norm(name).replace(/ /g, '-')

// Catálogo curado (aprobado). nsfw solo informativo.
const CATALOG: Array<{ name: string; desc: string }> = [
  { name: 'Acción', desc: 'Historias con varios combates, enfrentamientos o situaciones de riesgo.' },
  { name: 'Aventura', desc: 'Historias centradas en viajes y el descubrimiento de lugares, personas o situaciones nuevas.' },
  { name: 'Comedia', desc: 'Historias que usan situaciones humorísticas o absurdas para entretener.' },
  { name: 'Romance', desc: 'Historias que dan importancia a las relaciones amorosas y los sentimientos entre los personajes.' },
  { name: 'Slice of Life', desc: 'Historias muy centradas en la vida cotidiana de los personajes.' },
  { name: 'Escolar', desc: 'Historias ambientadas en un entorno estudiantil.' },
  { name: 'Fantasía', desc: 'Historias con elementos o criaturas fantásticas, o elementos sobrenaturales.' },
  { name: 'Ciencia ficción', desc: 'Historias que utilizan conceptos científicos o tecnológicos avanzados.' },
  { name: 'Histórico', desc: 'Historias ambientadas en épocas del pasado.' },
  { name: 'Drama', desc: 'Historias enfocadas en conflictos emocionales que afectan profundamente a los personajes.' },
  { name: 'Horror', desc: 'Historias que buscan perturbar al lector.' },
  { name: 'Isekai', desc: 'Historias donde el protagonista viaja o renace en una realidad diferente a la suya.' },
  { name: 'Mecha', desc: 'Historias enfocadas en robots o máquinas gigantes.' },
  { name: 'Militar', desc: 'Historias relacionadas con fuerzas armadas y conflictos bélicos.' },
  { name: 'Deporte', desc: 'Historias donde los deportes son un foco principal.' },
  { name: 'Cocina', desc: 'Historias donde la cocina es un foco principal.' },
  { name: 'Postapocalíptico', desc: 'Historias ambientadas en un mundo o sociedad tras una catástrofe.' },
  { name: 'Crimen', desc: 'Historias centradas en pandillas, criminales o peleas callejeras.' },
  { name: 'Chicas monstruo', desc: 'Historias donde hay fuerte presencia de chicas monstruo o animal.' },
  { name: 'Monstruo', desc: 'Historias donde criaturas paranormales, fantásticas o inhumanas tienen fuerte presencia.' },
  { name: 'Médico', desc: 'Historias centradas en un entorno médico u hospitalario, o en la medicina.' },
  { name: 'Sobrenatural', desc: 'Historias con fantasmas, demonios, vampiros y otros elementos paranormales.' },
  { name: 'Full Color', desc: 'Historias con capítulos mayormente o totalmente a color.' },
  { name: 'Antología', desc: 'Obras compuestas por varias historias independientes o relacionadas entre sí.' },
  { name: 'Ecchi', desc: 'Historias que incluyen situaciones de fanservice de carácter erótico.' },
  { name: 'BL', desc: "Historias de romance entre hombres (Boys' Love / Yaoi)." },
  { name: 'GL', desc: "Historias de romance entre mujeres (Girls' Love / Yuri)." },
  { name: 'NTR', desc: 'Historias centradas en la infidelidad o traición (netorare).' },
  { name: 'Psicológico', desc: 'Historias enfocadas en la mente y la tensión psicológica de los personajes.' },
  { name: 'Harem', desc: 'Historias donde varios personajes se interesan románticamente en el protagonista.' }
]

// Sinónimos/variantes -> nombre curado. Conservador: solo mapeos de alta confianza.
const EXTRA_SYN: Record<string, string> = {
  'action': 'Acción',
  'aventuras': 'Aventura',
  'comedy': 'Comedia', 'humor': 'Comedia',
  'recuentos de vida': 'Slice of Life', 'recuentos de la vida': 'Slice of Life',
  'sucesos de la vida': 'Slice of Life', 'vida cotidiana': 'Slice of Life', 'vida diaria': 'Slice of Life',
  'escolares': 'Escolar', 'vida escolar': 'Escolar',
  'fantasy': 'Fantasía',
  'sci fi': 'Ciencia ficción', 'scifi': 'Ciencia ficción',
  'ciencia ficcion sci fi': 'Ciencia ficción', 'ciencia ficcion scifi': 'Ciencia ficción',
  'terror': 'Horror',
  'sports': 'Deporte', 'deportes': 'Deporte', 'spocon': 'Deporte', 'spokon': 'Deporte',
  'chica monstruo': 'Chicas monstruo', 'monster girl': 'Chicas monstruo', 'demon girl': 'Chicas monstruo',
  'monstruos': 'Monstruo', 'monsters': 'Monstruo',
  'supernatural': 'Sobrenatural', 'fantasmas': 'Sobrenatural', 'demonios': 'Sobrenatural',
  'vampiros': 'Sobrenatural', 'angeles': 'Sobrenatural',
  'a color': 'Full Color', 'color': 'Full Color', 'coloreado por fans': 'Full Color', 'coloreado': 'Full Color',
  'anthology': 'Antología',
  'boys love': 'BL', 'boysloves': 'BL', 'yaoi': 'BL', 'shounen ai': 'BL', 'shonen ai': 'BL',
  'girls love': 'GL', 'girlsloves': 'GL', 'yuri': 'GL', 'shoujo ai': 'GL', 'shojo ai': 'GL',
  'netorare': 'NTR',
  'psychological': 'Psicológico', 'sicologico': 'Psicológico'
}

// Mapa normalizado -> nombre curado (incluye los nombres curados exactos)
const SYN = new Map<string, string>()
for (const c of CATALOG) SYN.set(norm(c.name), c.name)
for (const [k, v] of Object.entries(EXTRA_SYN)) SYN.set(norm(k), v)

async function main() {
  const all = await prisma.genre.findMany({
    include: { _count: { select: { mangasCustom: true } }, organization: { select: { slug: true } } }
  })

  // Agrupar por nombre normalizado
  type Grp = { key: string; display: string; rows: typeof all; links: number; target?: string }
  const groups = new Map<string, Grp>()
  for (const g of all) {
    const k = norm(g.name)
    const grp = groups.get(k) || { key: k, display: g.name, rows: [] as any, links: 0 }
    grp.rows.push(g); grp.links += g._count.mangasCustom
    groups.set(k, grp)
  }
  for (const grp of groups.values()) grp.target = SYN.get(grp.key)

  const mappable = [...groups.values()].filter(g => g.target)
  const leftovers = [...groups.values()].filter(g => !g.target).sort((a, b) => b.links - a.links)

  // Resumen por curado
  const perTarget = new Map<string, { links: number; sources: string[] }>()
  for (const g of mappable) {
    const t = g.target!
    const e = perTarget.get(t) || { links: 0, sources: [] }
    e.links += g.links; e.sources.push(`${g.display}(${g.links})`)
    perTarget.set(t, e)
  }

  console.log(`Modo: ${APPLY ? 'APPLY (escribe en prod)' : 'DRY-RUN (no toca datos)'}`)
  console.log(`Filas de género totales: ${all.length} | grupos por nombre: ${groups.size}`)
  console.log(`Grupos mapeables a curados: ${mappable.length} | sobrantes: ${leftovers.length}`)
  console.log(`\nPlan de fusión hacia el catálogo curado:`)
  for (const c of CATALOG) {
    const e = perTarget.get(c.name)
    if (e) console.log(`  ${c.name}  <-  ${e.links} vínculos de: ${e.sources.join(', ')}`)
    else console.log(`  ${c.name}  <-  (sin coincidencias existentes; se crea vacío)`)
  }

  // Escribir TXT de sobrantes
  const catGuess = (k: string) => {
    if (/(shonen|shounen|shojo|shoujo|seinen|josei|kodomo)/.test(k)) return 'DEMOGRAFIA'
    if (/(webtoon|web comic|oneshot|one shot|4 ?koma|4koma|doujin|cortos?|one shot|full color|manhwa)/.test(k)) return 'FORMATO'
    if (/(hentai|nsfw|18|smut|ahegao|anal|bukkake|futanari|incest|loli|shota|rape|violacion|tentaculos|paizuri|bondage|bdsm|orgia|milf|nakadashi|impregn|desnudo|erotic|sin censura|vanilla|blowjob|mamadas|masturbacion|voyeur|sucubo|succub|omegaverse|netori|prostitu|sexo|pechos|tetas|culos|oppai|gyaru|maid|bunny|swimsuit|lactancia|embarazada|urination|x ray|toddler|bestial|zoofilia|cuernos|traicion)/.test(k)) return 'NSFW/FETICHE'
    return 'GENERO?'
  }
  const lines: string[] = []
  lines.push('GÉNEROS SOBRANTES (no fusionados automáticamente) — decide qué hacer con cada uno.')
  lines.push('Formato: [categoría sugerida] nombre — filas / vínculos con obras — variantes')
  lines.push('Opciones típicas: (a) sumar al catálogo curado, (b) fusionar con un curado existente, (c) mover a Demografía, (d) marcar NSFW, (e) dejar como está / ocultar.')
  lines.push('='.repeat(90))
  for (const g of leftovers) {
    const variants = [...new Set(g.rows.map(r => `${r.name}${r.organization ? '' : ' [GLOBAL]'}`))]
    lines.push(`[${catGuess(g.key)}] ${g.display} — ${g.rows.length} filas / ${g.links} vínculos — variantes: ${variants.join(' | ')}`)
  }
  writeFileSync(TXT_OUT, lines.join('\n'), 'utf8')
  console.log(`\nTXT de sobrantes escrito en:\n  ${TXT_OUT}`)
  console.log(`  (${leftovers.length} nombres sobrantes)`)

  if (!APPLY) {
    console.log('\n(DRY-RUN) No se creó ni modificó nada. Revisa el plan y el TXT, luego corre con --apply.')
    await prisma.$disconnect(); return
  }

  // ---- APPLY ----
  console.log('\n== APLICANDO ==')
  // 1) Upsert catálogo curado global
  const targetIdByName = new Map<string, number>()
  for (const c of CATALOG) {
    const slug = slugify(c.name)
    const existing = await prisma.genre.findFirst({ where: { slug, organizationId: null } })
    if (existing) {
      const up = await prisma.genre.update({ where: { id: existing.id }, data: { name: c.name, description: c.desc, display: true } })
      targetIdByName.set(c.name, up.id)
    } else {
      const cr = await prisma.genre.create({ data: { name: c.name, slug, description: c.desc, display: true, organizationId: null } })
      targetIdByName.set(c.name, cr.id)
    }
  }
  console.log(`Catálogo curado global asegurado: ${targetIdByName.size} géneros.`)

  // 2) Fusionar mapeables
  let mergedRows = 0, relinked = 0
  for (const g of mappable) {
    const targetId = targetIdByName.get(g.target!)!
    for (const row of g.rows) {
      if (row.id === targetId) continue
      const links = await prisma.mangaCustom.findMany({ where: { genres: { some: { id: row.id } } }, select: { id: true } })
      if (links.length) {
        await prisma.genre.update({ where: { id: targetId }, data: { mangasCustom: { connect: links.map(m => ({ id: m.id })) } } })
        relinked += links.length
      }
      await prisma.genre.delete({ where: { id: row.id } })
      mergedRows++
    }
  }
  console.log(`Filas fusionadas y borradas: ${mergedRows} | vínculos re-conectados: ${relinked}`)
  console.log('Sobrantes: intactos (no se tocaron).')
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
