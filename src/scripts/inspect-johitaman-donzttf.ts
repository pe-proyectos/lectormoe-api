import { prisma } from '../models/prisma'

const users = await prisma.user.findMany({
  where: {
    OR: [
      { username: { contains: 'johitaman', mode: 'insensitive' } },
      { username: { contains: 'donzttf', mode: 'insensitive' } },
      { slug: { contains: 'johitaman', mode: 'insensitive' } },
      { slug: { contains: 'donzttf', mode: 'insensitive' } },
      { username: { contains: 'johita', mode: 'insensitive' } },
      { username: { contains: 'zttf', mode: 'insensitive' } }
    ]
  },
  select: {
    id: true,
    username: true,
    slug: true,
    email: true,
    permissions: {
      select: {
        role: true,
        organizationId: true,
        organization: { select: { name: true, slug: true } },
        canDeleteComment: true,
        canBanUser: true,
        canCreateChapter: true,
        canEditMangaCustom: true,
        canSeeAdminPanel: true,
        hierarchyLevel: true,
        canEditSubscriptionPlan: true,
        createdAt: true
      }
    }
  }
})

for (const u of users) {
  console.log(`\n=== ${u.username} (id=${u.id}, slug=${u.slug}, email=${u.email}) ===`)
  if (u.permissions.length === 0) {
    console.log('  SIN PERMISOS / SIN ACCESO A NINGUNA ORG')
  }
  for (const p of u.permissions) {
    console.log(
      `  org=${p.organization?.slug} (${p.organization?.name}) role=${p.role} creado=${p.createdAt?.toISOString()?.slice(0, 10)}`
    )
    console.log(
      `    adminPanel=${p.canSeeAdminPanel} nivel=${p.hierarchyLevel} canCreateChapter=${p.canCreateChapter} canEditMangaCustom=${p.canEditMangaCustom} canDeleteComment=${p.canDeleteComment} canBanUser=${p.canBanUser} canEditSubscriptionPlan=${p.canEditSubscriptionPlan}`
    )
  }
}

if (users.length === 0) console.log('No se encontraron usuarios johitaman/donzttf')

await prisma.$disconnect()
process.exit(0)
