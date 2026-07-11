import { prisma } from '../models/prisma'
import { sendAdminEmail } from './email'
import { contentRemovedTemplate } from './email-templates'

// Aviso al scan cuando moderación retira una de sus obras: notificación in-app
// a todo el staff con panel y correo a los dueños (canEditOrganization).
export async function notifyContentRemoved(mangaCustomId: number, reason: string) {
  const mc = await prisma.mangaCustom.findUnique({
    where: { id: mangaCustomId },
    select: {
      id: true,
      title: true,
      organizationId: true,
      manga: { select: { title: true } },
      organization: { select: { name: true } }
    }
  })
  if (!mc) return

  const title = mc.title || mc.manga.title
  const staff = await prisma.permission.findMany({
    where: { organizationId: mc.organizationId, canSeeAdminPanel: true },
    select: {
      userId: true,
      canEditOrganization: true,
      user: { select: { email: true, username: true } }
    }
  })
  if (staff.length === 0) return

  await prisma.notification.createMany({
    data: staff.map((s) => ({
      userId: s.userId,
      type: 'content_removed',
      mangaCustomId: mc.id,
      organizationId: mc.organizationId,
      source: 'org_staff',
      details: reason.slice(0, 500)
    })),
    skipDuplicates: true
  })

  const owners = staff.filter((s) => s.canEditOrganization && s.user.email)
  for (const o of owners) {
    sendAdminEmail(
      o.user.email,
      `Obra retirada: ${title}`,
      contentRemovedTemplate(mc.organization.name, title, reason)
    ).catch((e) => console.error('contentRemoved email failed:', e?.message))
  }
}
