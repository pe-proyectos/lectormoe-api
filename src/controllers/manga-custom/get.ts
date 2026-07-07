import { Prisma, prisma } from '../../models/prisma'

export const getMangaCustomBySlug = async (
  organizationId: number,
  mangaSlug: string,
  user?: any
) => {
  const mangaCustom = await prisma.mangaCustom.findFirst({
    where: {
      organization: {
        id: organizationId
      },
      manga: {
        slug: mangaSlug
      },
      deletedAt: null
    },
    include: {
      manga: {
        include: {
          authors: true,
          demography: true,
          bookType: true
        }
      },
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          isNSFW: true
        }
      },
      chapters: {
        where: { deletedAt: null },
        orderBy: {
          number: Prisma.SortOrder.desc
        }
      },
      volumes: {
        orderBy: { number: Prisma.SortOrder.asc }
      },
      genres: {
        select: {
          id: true,
          name: true,
          description: true,
          slug: true
        }
      },
      subscriptionPlansCanReadUnreleased: {
        select: {
          id: true,
          name: true,
          canDownload: true,
          canReadUnreleased: true
        }
      },
      subscriptionPlansCanReadReleased: {
        select: {
          id: true,
          name: true,
          canDownload: true,
          canReadUnreleased: true
        }
      },
      rankings: {
        take: 4,
        select: {
          rank: true,
          comment: true,
          createdAt: true,
          User: {
            select: {
              username: true
            }
          }
        },
        orderBy: {
          createdAt: Prisma.SortOrder.desc
        }
      }
    }
  })
  if (!mangaCustom) {
    return null
  }

  // Only redirect to the joint page when the CURRENT org (the one whose
  // page the viewer is on) is an ACCEPTED member of the joint. A joint
  // owned by a different scan should not hijack other scans' manga pages
  // — those scans never agreed to enter the joint.
  const activeJoint = await prisma.mangaJoint.findFirst({
    where: {
      mangaId: mangaCustom.manga.id,
      deletedAt: null,
      members: {
        some: {
          organizationId,
          status: 'ACCEPTED'
        }
      }
    },
    select: { id: true, slug: true }
  })

  // Merge joint chapters into the chapter list so members see joint-uploaded
  // chapters alongside (or instead of) their own solo chapters.
  let chapters: any[] = mangaCustom.chapters
  if (activeJoint) {
    const jointChapters = await prisma.chapter.findMany({
      where: {
        jointId: activeJoint.id,
        deletedAt: null
      },
      select: {
        id: true,
        number: true,
        title: true,
        releasedAt: true,
        isUnreleased: true,
        imageUrl: true,
        views: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { number: 'desc' }
    })

    if (jointChapters.length > 0) {
      // Deduplicate by chapter number, keeping the most recently released entry.
      const merged = new Map<number, any>()
      for (const c of [...chapters, ...jointChapters]) {
        const prev = merged.get(c.number)
        if (!prev) {
          merged.set(c.number, c)
          continue
        }
        const prevTs = prev.releasedAt ? new Date(prev.releasedAt).getTime() : 0
        const cTs = c.releasedAt ? new Date(c.releasedAt).getTime() : 0
        if (cTs >= prevTs) merged.set(c.number, c)
      }
      chapters = [...merged.values()].sort((a, b) => b.number - a.number)
    }
  }

  // Filter unreleased chapters when the opt-in flag is set, unless the user
  // has an active subscription for this organization (subscribers can see
  // early-access / scheduled chapters) OR is staff of this scan (needs to edit
  // scheduled chapters without turning the option off).
  const hideUnreleased = mangaCustom.hideUnreleasedChapters === true
  if (hideUnreleased) {
    const hasActiveSub =
      user != null &&
      Array.isArray(user.subscriptions) &&
      user.subscriptions.some(
        (sub: any) =>
          sub.active && sub.subscriptionPlan?.organizationId === organizationId
      )
    const isStaffHere =
      user != null &&
      Array.isArray(user.permissions) &&
      user.permissions.some(
        (p: any) =>
          p.organizationId === organizationId && p.canSeeAdminPanel === true
      )
    if (!hasActiveSub && !isStaffHere) {
      const now = new Date()
      chapters = chapters.filter(
        (c: any) =>
          !c.isUnreleased && (!c.releasedAt || new Date(c.releasedAt) <= now)
      )
    }
  }

  return {
    ...mangaCustom,
    chapters,
    jointSlug: activeJoint?.slug || null
  }
}
