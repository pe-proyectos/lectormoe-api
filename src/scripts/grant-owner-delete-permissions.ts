// Concede canDeleteChapter y canDeleteMangaCustom a los duenos de scan legacy
// (filas con canSeeAdminPanel + canEditOrganization) que no los tienen. Las orgs
// nuevas ya nacen con ambos (controllers/superadmin/scan.ts). Aditivo: solo pone
// booleanos en true, no toca nada mas. Uso: bun ... [--apply] (sin flag = dry-run).
import { prisma } from '../models/prisma'

const apply = process.argv.includes('--apply')

const owners = await prisma.permission.findMany({
  where: {
    canSeeAdminPanel: true,
    canEditOrganization: true,
    OR: [{ canDeleteChapter: false }, { canDeleteMangaCustom: false }]
  },
  select: {
    id: true,
    canDeleteChapter: true,
    canDeleteMangaCustom: true,
    user: { select: { username: true } },
    organization: { select: { slug: true } }
  }
})

console.log(`${apply ? 'APLICANDO' : 'DRY-RUN'}: ${owners.length} duenos sin permiso de borrado completo\n`)
for (const p of owners) {
  console.log(`- ${p.organization.slug} @${p.user.username} (delCh: ${p.canDeleteChapter} -> true, delMc: ${p.canDeleteMangaCustom} -> true)`)
}

if (apply && owners.length > 0) {
  const res = await prisma.permission.updateMany({
    where: { id: { in: owners.map((p) => p.id) } },
    data: { canDeleteChapter: true, canDeleteMangaCustom: true }
  })
  console.log(`\nActualizadas ${res.count} filas.`)
} else if (!apply) {
  console.log('\nSin cambios (dry-run). Corre con --apply para aplicar.')
}

await prisma.$disconnect()
process.exit(0)
