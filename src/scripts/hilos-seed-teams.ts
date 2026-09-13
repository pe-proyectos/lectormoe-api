import { SQL } from 'bun'
import { createHilos } from '../lib/hilos-sdk'

// Siembra los equipos de los scans en hilos.rest a partir de los permisos que
// ya existen aquí: quien tiene rol 'owner' manda; el resto del staff con
// acceso al panel entra como 'trusted'. No toca nada de CapibaraTraductor.
// Args: --dry, --scan <slug>.
const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const SOLO = (() => { const i = args.indexOf('--scan'); return i >= 0 ? args[i + 1] : null })()

const sql = new SQL({ url: (process.env.DATABASE_URL || '').split('?')[0], max: 3, connectionTimeout: 20 })
const hilos = createHilos({ baseUrl: process.env.HILOS_BASE || 'https://hilos.rest', secretKey: process.env.HILOS_SECRET_KEY || '' })

let owners = 0, trusted = 0, sinPage = 0, errN = 0, scansOk = 0, scansSinStaff = 0
const errs = new Map<string, number>()
const logErr = (e: any) => { errN++; const m = String(e?.message || e).slice(0, 70); errs.set(m, (errs.get(m) || 0) + 1) }

// La page de una persona: si ya reclamó su cuenta en La Charca, esa manda.
const cache = new Map<number, string | null>()
async function pageDe(userId: number): Promise<string | null> {
  if (cache.has(userId)) return cache.get(userId)!
  const [u] = await sql`SELECT id, slug, username, "imageUrl", "createdAt" FROM "user" WHERE id=${userId} LIMIT 1`
  if (!u) { cache.set(userId, null); return null }
  const handle = (u.slug || `u${u.id}`).slice(0, 40)
  const existente: any = await (hilos as any).pages.get(handle).catch(() => null)
  if (existente?.handle) { cache.set(userId, existente.handle); return existente.handle }
  try {
    const creada: any = await hilos.pages.upsert({
      externalId: `capibara:user:${u.id}`, handle, type: 'user',
      displayName: u.username || u.slug,
      avatarUrl: u.imageUrl || undefined,
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : undefined,
    })
    cache.set(userId, creada?.handle || handle)
    return creada?.handle || handle
  } catch (e) { logErr(e); cache.set(userId, null); return null }
}

async function run() {
  const orgs = SOLO
    ? await sql`SELECT id, slug, name FROM organization WHERE slug=${SOLO} AND "isDeleted"=false`
    : await sql`SELECT id, slug, name FROM organization WHERE "isDeleted"=false ORDER BY id`
  console.log(`scans: ${orgs.length}${DRY ? ' (dry-run)' : ''}`)

  for (const org of orgs) {
    // La page del scan tiene que existir ya (la creó la migración inicial).
    const scanPage: any = await (hilos as any).pages.get(`scan-${org.slug}`.slice(0, 40)).catch(() => null)
      || await (hilos as any).pages.get(`scan_${org.slug}`.slice(0, 40)).catch(() => null)
    if (!scanPage?.handle) { sinPage++; continue }

    const staff = await sql`
      SELECT p."userId", p.role, p."hierarchyLevel", p."canSeeAdminPanel", p."canEditOrganization"
      FROM permission p
      WHERE p."organizationId" = ${org.id}
        AND (lower(p.role) = 'owner' OR p."canSeeAdminPanel" = true OR p."canEditOrganization" = true)
      ORDER BY p."hierarchyLevel" DESC`
    if (!staff.length) { scansSinStaff++; continue }

    // Dueños por rol; si el scan no tiene ninguno, el de mayor jerarquía lo es,
    // porque una page sin owner no la podría administrar nadie.
    let jefes = staff.filter((s: any) => String(s.role || '').toLowerCase() === 'owner')
    if (!jefes.length) jefes = [staff[0]]
    const jefeIds = new Set(jefes.map((j: any) => j.userId))

    for (const s of staff) {
      const rol = jefeIds.has(s.userId) ? 'owner' : 'trusted'
      if (DRY) { rol === 'owner' ? owners++ : trusted++; continue }
      const handle = await pageDe(s.userId)
      if (!handle) continue
      try {
        await (hilos as any).members.add(scanPage.handle, handle, rol)
        rol === 'owner' ? owners++ : trusted++
      } catch (e) { logErr(e) }
    }
    scansOk++
  }

  console.log({ scans: scansOk, owners, trusted, sinPageEnHilos: sinPage, sinStaff: scansSinStaff, errores: errN })
  if (errs.size) console.log('errores:', [...errs.entries()].slice(0, 5))
  await sql.end()
}
run()
