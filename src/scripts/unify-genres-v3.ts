/**
 * Catálogo de géneros v3: categorías tipo MangaDex (FORMAT/GENRE/THEME/CONTENT)
 * + flag nsfw (+18, solo /red). Alinea los globales ya existentes (v2) con su
 * categoría/flag y agrega las etiquetas nuevas del catálogo. Fusiona más
 * sobrantes por sinónimos. Los que sigan sin mapear se dejan INTACTOS y se
 * vuelcan a un TXT.
 *
 * Dry-run por defecto; `--apply` escribe. Corre contra la DB de .env (PROD).
 */
import { prisma } from '../models/prisma'
import { writeFileSync } from 'fs'

const APPLY = process.argv.includes('--apply')
const TXT_OUT = 'C:\\Users\\luisc\\AppData\\Local\\Temp\\claude\\C--Users-luisc-Desktop-Projects\\15893988-9d73-4b2f-885a-3212c47d4cbc\\scratchpad\\generos-sobrantes-v3.txt'

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const slugify = (name: string) => norm(name).replace(/ /g, '-')

type Cat = 'FORMAT' | 'GENRE' | 'THEME' | 'CONTENT'
interface Entry { name: string; category: Cat; nsfw?: boolean; desc: string; syns?: string[] }

const CATALOG: Entry[] = [
  // ---- FORMATO ----
  { name: '4-Koma', category: 'FORMAT', desc: 'Historietas de cuatro viñetas.', syns: ['4koma', 'yonkoma'] },
  { name: 'Adaptación', category: 'FORMAT', desc: 'Obra adaptada de otra fuente (novela, juego, etc.).', syns: ['adaptation'] },
  { name: 'Antología', category: 'FORMAT', desc: 'Obra compuesta por varias historias independientes.', syns: ['anthology'] },
  { name: 'Premiado', category: 'FORMAT', desc: 'Obra que ha ganado algún premio.', syns: ['award winning'] },
  { name: 'Doujinshi', category: 'FORMAT', desc: 'Obra autopublicada por aficionados.', syns: ['doujin'] },
  { name: 'Coloreado por fans', category: 'FORMAT', desc: 'Coloreado por la comunidad, no oficial.', syns: ['fan colored'] },
  { name: 'Full Color', category: 'FORMAT', desc: 'Capítulos mayormente o totalmente a color.', syns: ['a color', 'a todo color', 'color', 'coloreado'] },
  { name: 'Tira larga', category: 'FORMAT', desc: 'Formato de tira vertical continua (scroll).', syns: ['long strip'] },
  { name: 'Coloreado oficial', category: 'FORMAT', desc: 'Coloreado por el autor o la editorial.', syns: ['official colored'] },
  { name: 'Autopublicado', category: 'FORMAT', desc: 'Publicado por el propio autor.', syns: ['self published'] },
  { name: 'Webcómic', category: 'FORMAT', desc: 'Publicado originalmente en la web.', syns: ['webcomic', 'web comic', 'webtoon'] },

  // ---- GÉNERO ----
  { name: 'Acción', category: 'GENRE', desc: 'Combates, enfrentamientos o situaciones de riesgo.', syns: ['action'] },
  { name: 'Aventura', category: 'GENRE', desc: 'Viajes y descubrimiento de lugares o situaciones nuevas.', syns: ['aventuras'] },
  { name: 'BL', category: 'GENRE', desc: "Romance entre hombres (Boys' Love / Yaoi).", syns: ['boys love', 'yaoi', 'shounen ai', 'shonen ai'] },
  { name: 'Comedia', category: 'GENRE', desc: 'Situaciones humorísticas o absurdas.', syns: ['comedy', 'humor'] },
  { name: 'Crimen', category: 'GENRE', desc: 'Criminales, pandillas o peleas callejeras.', syns: ['crime'] },
  { name: 'Drama', category: 'GENRE', desc: 'Conflictos emocionales que afectan a los personajes.', syns: [] },
  { name: 'Fantasía', category: 'GENRE', desc: 'Elementos o criaturas fantásticas.', syns: ['fantasy'] },
  { name: 'GL', category: 'GENRE', desc: "Romance entre mujeres (Girls' Love / Yuri).", syns: ['girls love', 'yuri', 'shoujo ai', 'shojo ai'] },
  { name: 'Histórico', category: 'GENRE', desc: 'Ambientada en épocas del pasado.', syns: ['historical'] },
  { name: 'Horror', category: 'GENRE', desc: 'Busca perturbar al lector.', syns: ['terror'] },
  { name: 'Isekai', category: 'GENRE', desc: 'El protagonista viaja o renace en otra realidad.', syns: [] },
  { name: 'Mecha', category: 'GENRE', desc: 'Robots o máquinas gigantes.', syns: [] },
  { name: 'Médico', category: 'GENRE', desc: 'Entorno médico u hospitalario.', syns: ['medical'] },
  { name: 'Misterio', category: 'GENRE', desc: 'Enigmas e investigaciones por resolver.', syns: ['mystery'] },
  { name: 'Filosófico', category: 'GENRE', desc: 'Reflexión sobre ideas y dilemas profundos.', syns: ['philosophical'] },
  { name: 'Psicológico', category: 'GENRE', desc: 'La mente y la tensión psicológica de los personajes.', syns: ['psychological', 'sicologico'] },
  { name: 'Romance', category: 'GENRE', desc: 'Relaciones amorosas y sentimientos.', syns: [] },
  { name: 'Ciencia ficción', category: 'GENRE', desc: 'Conceptos científicos o tecnológicos avanzados.', syns: ['sci fi', 'scifi'] },
  { name: 'Slice of Life', category: 'GENRE', desc: 'La vida cotidiana de los personajes.', syns: ['recuentos de vida', 'recuentos de la vida', 'sucesos de la vida', 'vida cotidiana', 'vida diaria'] },
  { name: 'Deporte', category: 'GENRE', desc: 'Los deportes como foco principal.', syns: ['deportes', 'sports', 'spocon', 'spokon'] },
  { name: 'Ecchi', category: 'GENRE', desc: 'Fanservice de carácter erótico ligero.', syns: [] },
  { name: 'Superhéroes', category: 'GENRE', desc: 'Héroes con poderes que protegen a otros.', syns: ['superhero', 'superheroe'] },
  { name: 'Thriller', category: 'GENRE', desc: 'Tensión y suspenso constantes.', syns: ['suspenso', 'suspense'] },
  { name: 'Tragedia', category: 'GENRE', desc: 'Desenlaces dolorosos e inevitables.', syns: ['tragedy', 'tragico'] },
  { name: 'Wuxia', category: 'GENRE', desc: 'Artes marciales y caballería de la China clásica.', syns: [] },

  // ---- TEMÁTICA ----
  { name: 'Extraterrestres', category: 'THEME', desc: 'Presencia de alienígenas.', syns: ['aliens', 'alien'] },
  { name: 'Animales', category: 'THEME', desc: 'Los animales tienen un papel central.', syns: ['animals'] },
  { name: 'Cocina', category: 'THEME', desc: 'La cocina como foco principal.', syns: ['cooking', 'comida'] },
  { name: 'Travestismo', category: 'THEME', desc: 'Personajes que se visten como el otro género.', syns: ['crossdressing'] },
  { name: 'Delincuentes', category: 'THEME', desc: 'Pandilleros y buscapleitos.', syns: ['delinquents'] },
  { name: 'Demonios', category: 'THEME', desc: 'Fuerte presencia de demonios.', syns: ['demons', 'demonio'] },
  { name: 'Cambio de género', category: 'THEME', desc: 'Un personaje cambia de sexo/género.', syns: ['genderswap', 'gender bender', 'gender swap'] },
  { name: 'Fantasmas', category: 'THEME', desc: 'Fuerte presencia de fantasmas o espíritus.', syns: ['ghosts'] },
  { name: 'Gyaru', category: 'THEME', desc: 'Personajes con el estilo gyaru.', syns: [] },
  { name: 'Harem', category: 'THEME', desc: 'Varios personajes se interesan en el protagonista.', syns: [] },
  { name: 'Harem inverso', category: 'THEME', desc: 'Una protagonista rodeada de varios pretendientes.', syns: ['haren inverso', 'reverse harem'] },
  { name: 'Incesto', category: 'THEME', nsfw: true, desc: 'Relaciones entre familiares.', syns: ['incest'] },
  { name: 'Loli', category: 'THEME', nsfw: true, desc: 'Personajes de apariencia infantil femenina.', syns: ['lolicon'] },
  { name: 'Shota', category: 'THEME', nsfw: true, desc: 'Personajes de apariencia infantil masculina.', syns: ['shotacon'] },
  { name: 'Mafia', category: 'THEME', desc: 'Crimen organizado.', syns: [] },
  { name: 'Magia', category: 'THEME', desc: 'La magia tiene un papel central.', syns: ['magic'] },
  { name: 'Mahjong', category: 'THEME', desc: 'El mahjong como eje de la historia.', syns: [] },
  { name: 'Artes marciales', category: 'THEME', desc: 'Combate cuerpo a cuerpo y disciplinas marciales.', syns: ['arte marciales', 'martial arts'] },
  { name: 'Militar', category: 'THEME', desc: 'Fuerzas armadas y conflictos bélicos.', syns: ['military', 'guerra'] },
  { name: 'Chicas monstruo', category: 'THEME', desc: 'Presencia de chicas monstruo o animal.', syns: ['monster girls', 'monster girl', 'demon girl', 'chica monstruo'] },
  { name: 'Monstruo', category: 'THEME', desc: 'Criaturas paranormales o inhumanas.', syns: ['monstruos', 'monsters'] },
  { name: 'Música', category: 'THEME', desc: 'La música como eje de la historia.', syns: ['music'] },
  { name: 'Ninja', category: 'THEME', desc: 'Ninjas y su mundo.', syns: [] },
  { name: 'Oficinistas', category: 'THEME', desc: 'Vida laboral de oficina.', syns: ['office workers'] },
  { name: 'Policía', category: 'THEME', desc: 'Cuerpos policiales y su labor.', syns: ['police', 'policial', 'policias'] },
  { name: 'Postapocalíptico', category: 'THEME', desc: 'Un mundo tras una catástrofe.', syns: ['post apocalyptic'] },
  { name: 'Reencarnación', category: 'THEME', desc: 'Renacer en otro cuerpo o época.', syns: ['reincarnation', 'transmigracion'] },
  { name: 'Samurái', category: 'THEME', desc: 'Samuráis y su época.', syns: ['samurai'] },
  { name: 'Escolar', category: 'THEME', desc: 'Ambientada en un entorno estudiantil.', syns: ['escolares', 'vida escolar', 'school life'] },
  { name: 'Sobrenatural', category: 'THEME', desc: 'Elementos paranormales en general.', syns: ['supernatural'] },
  { name: 'Supervivencia', category: 'THEME', desc: 'Sobrevivir a situaciones extremas.', syns: ['survival'] },
  { name: 'Viaje en el tiempo', category: 'THEME', desc: 'Desplazamientos en el tiempo.', syns: ['time travel'] },
  { name: 'Juegos tradicionales', category: 'THEME', desc: 'Juegos de mesa o clásicos como eje.', syns: ['traditional games'] },
  { name: 'Vampiros', category: 'THEME', desc: 'Fuerte presencia de vampiros.', syns: ['vampires'] },
  { name: 'Videojuegos', category: 'THEME', desc: 'Videojuegos como tema central.', syns: ['video games', 'videogames', 'juegos'] },
  { name: 'Villana', category: 'THEME', desc: 'Protagonista en el rol de villana.', syns: ['villainess', 'villano'] },
  { name: 'Realidad virtual', category: 'THEME', desc: 'Mundos virtuales inmersivos.', syns: ['virtual reality'] },
  { name: 'Chicas mágicas', category: 'THEME', desc: 'Heroínas con poderes mágicos.', syns: ['magical girls', 'mahou shoujo', 'chicas magicas'] },
  { name: 'Zombis', category: 'THEME', desc: 'Fuerte presencia de zombis.', syns: ['zombies'] },
  { name: 'NTR', category: 'THEME', nsfw: true, desc: 'Infidelidad o traición (netorare).', syns: ['netorare'] },

  // ---- CONTENIDO ----
  { name: 'Gore', category: 'CONTENT', desc: 'Violencia gráfica y sangre.', syns: [] },
  { name: 'Violencia sexual', category: 'CONTENT', nsfw: true, desc: 'Escenas de violencia sexual.', syns: ['sexual violence', 'violacion', 'rape'] },
  { name: 'Adulto', category: 'CONTENT', nsfw: true, desc: 'Contenido explícito para adultos.', syns: ['adult'] },
  { name: 'Hentai', category: 'CONTENT', nsfw: true, desc: 'Contenido sexual explícito.', syns: [] },
  { name: 'Smut', category: 'CONTENT', nsfw: true, desc: 'Alto contenido sexual.', syns: [] },
  { name: 'Sin censura', category: 'CONTENT', nsfw: true, desc: 'Sin censura en el contenido explícito.', syns: ['uncensored'] }
]

// Mapa normalizado -> nombre canónico
const SYN = new Map<string, string>()
for (const e of CATALOG) {
  SYN.set(norm(e.name), e.name)
  for (const s of e.syns || []) SYN.set(norm(s), e.name)
}

async function main() {
  console.log(`Modo: ${APPLY ? 'APPLY (prod)' : 'DRY-RUN'} | catálogo: ${CATALOG.length} etiquetas`)

  const all = await prisma.genre.findMany({ include: { _count: { select: { mangasCustom: true } } } })
  const groups = new Map<string, { display: string; rows: typeof all; links: number; target?: string }>()
  for (const g of all) {
    const k = norm(g.name)
    const grp = groups.get(k) || { display: g.name, rows: [] as any, links: 0 }
    grp.rows.push(g); grp.links += g._count.mangasCustom
    groups.set(k, grp)
  }
  for (const grp of groups.values()) grp.target = SYN.get(norm(grp.display))
  const leftovers = [...groups.values()].filter(g => !g.target).sort((a, b) => b.links - a.links)

  // TXT de sobrantes
  const catGuess = (k: string) => {
    if (/(shonen|shounen|shojo|shoujo|seinen|josei|kodomo)/.test(k)) return 'DEMOGRAFIA'
    if (/(hentai|nsfw|18|smut|ahegao|anal|bukkake|futanari|incest|paizuri|bondage|milf|nakadashi|impregn|desnudo|erotic|vanilla|blowjob|mamadas|masturbacion|voyeur|sucubo|succub|omegaverse|prostitu|sexo|tetas|culos|oppai|lactancia|embarazada|urination|toddler|bestial|cuernos|traicion|futa)/.test(k)) return 'NSFW/FETICHE'
    return 'REVISAR'
  }
  const lines = ['GÉNEROS SOBRANTES v3 (no mapeados al catálogo por categorías). Decide: sumar / fusionar / demografía / ocultar.', '='.repeat(80)]
  for (const g of leftovers) lines.push(`[${catGuess(norm(g.display))}] ${g.display} — ${g.rows.length} filas / ${g.links} vínculos`)
  writeFileSync(TXT_OUT, lines.join('\n'), 'utf8')
  console.log(`Grupos mapeables: ${[...groups.values()].filter(g => g.target).length} | sobrantes: ${leftovers.length} -> ${TXT_OUT}`)

  if (!APPLY) { console.log('(DRY-RUN) revisa y corre con --apply'); await prisma.$disconnect(); return }

  // 1) Upsert catálogo global con category/nsfw/desc
  const idByName = new Map<string, number>()
  for (const e of CATALOG) {
    const slug = slugify(e.name)
    const existing = await prisma.genre.findFirst({ where: { slug, organizationId: null } })
    const data = { name: e.name, description: e.desc, display: true, category: e.category, nsfw: !!e.nsfw }
    if (existing) idByName.set(e.name, (await prisma.genre.update({ where: { id: existing.id }, data })).id)
    else idByName.set(e.name, (await prisma.genre.create({ data: { ...data, slug, organizationId: null } })).id)
  }
  console.log(`Catálogo asegurado: ${idByName.size}`)

  // 2) Fusionar mapeables
  let merged = 0, relinked = 0
  for (const grp of groups.values()) {
    if (!grp.target) continue
    const targetId = idByName.get(grp.target)!
    for (const row of grp.rows) {
      if (row.id === targetId) continue
      const links = await prisma.mangaCustom.findMany({ where: { genres: { some: { id: row.id } } }, select: { id: true } })
      if (links.length) { await prisma.genre.update({ where: { id: targetId }, data: { mangasCustom: { connect: links.map(m => ({ id: m.id })) } } }); relinked += links.length }
      await prisma.genre.delete({ where: { id: row.id } })
      merged++
    }
  }
  console.log(`Fusionadas: ${merged} | re-vinculados: ${relinked} | sobrantes intactos: ${leftovers.length}`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
