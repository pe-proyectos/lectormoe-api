# Joints Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow multiple scan organizations to collaborate on the same manga (a "joint"), with a shared public page at `/joint/manga/{slug}`, invitation-based membership, role-based permissions, and joint chapter management.

**Architecture:** Two new Prisma models (`MangaJoint`, `JointMember`) + modify `Chapter` to support nullable `mangaCustomId` and new `jointId`. Backend exposes ~14 new REST endpoints. Frontend adds a public joint page, a joint chapter reader, and an admin panel section. Visiting a joint manga via any participating org's URL redirects to `/joint/manga/{slug}`.

**Tech Stack:** Bun, Elysia (API), Prisma (ORM), PostgreSQL, Astro 5 (SSR), React 18, TypeScript

**Repos:**
- API: `C:\Users\luisc\Desktop\Projects\lectormoe-api`
- Frontend: `C:\Users\luisc\Desktop\Projects\lectormoe-frontend`

---

## File Map

### API — New files
| File | Purpose |
|------|---------|
| `src/types/joint/create.ts` | CreateJointRequest schema |
| `src/types/joint/edit.ts` | EditJointRequest schema |
| `src/types/joint/invite.ts` | InviteToJointRequest schema |
| `src/types/joint/respond.ts` | RespondToJointRequest schema |
| `src/types/joint/transfer.ts` | TransferJointRequest schema |
| `src/types/joint/permissions.ts` | UpdateJointMemberPermissionsRequest schema |
| `src/types/joint/chapter/create.ts` | CreateJointChapterRequest schema |
| `src/types/joint/chapter/edit.ts` | EditJointChapterRequest schema |
| `src/controllers/joint/create.ts` | Create joint, auto-generate slug, add leader member |
| `src/controllers/joint/get.ts` | Get joint by slug (public, includes chapters + members) |
| `src/controllers/joint/edit.ts` | Edit joint info (leader or canEditJoint) |
| `src/controllers/joint/delete.ts` | Soft-delete joint and its chapters |
| `src/controllers/joint/list.ts` | List joints for an org (admin) |
| `src/controllers/joint/invite.ts` | Invite org by slug (leader or canInvite) |
| `src/controllers/joint/respond.ts` | Accept/reject invitation |
| `src/controllers/joint/expel.ts` | Expel member (leader or canExpel) |
| `src/controllers/joint/transfer.ts` | Transfer leadership |
| `src/controllers/joint/member-permissions.ts` | Update member extra permissions |
| `src/controllers/joint/chapter/create.ts` | Upload chapter to joint |
| `src/controllers/joint/chapter/get.ts` | Get joint chapter + pages |
| `src/controllers/joint/chapter/edit.ts` | Edit joint chapter |
| `src/controllers/joint/chapter/delete.ts` | Soft-delete joint chapter |
| `src/routes/joint/index.ts` | All joint + joint-chapter routes |

### API — Modified files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add MangaJoint, JointMember, enums; modify Chapter, Organization, Manga |
| `src/routes/router.ts` | Register joint routes |
| `src/controllers/manga-custom/get.ts` | Return `jointSlug` when manga belongs to active joint |

### Frontend — New files
| File | Purpose |
|------|---------|
| `src/pages/joint/manga/[slug].astro` | Public joint manga detail page |
| `src/pages/joint/manga/[slug]/chapters/[number].astro` | Joint chapter reader |
| `src/pages/[slug]/admin/joints.astro` | Admin joints list (normal path) |
| `src/pages/red/[slug]/admin/joints.astro` | Admin joints list (NSFW path) |
| `src/components/landing/JointMangaDetailPage.tsx` | Joint manga detail React component |
| `src/components/admin/AdminJointGrid.tsx` | Admin joints list + pending invites |
| `src/components/admin/AdminJointDetail.tsx` | Manage a joint (members, chapters, settings) |

### Frontend — Modified files
| File | Change |
|------|--------|
| `src/middleware/index.ts` | Add "joint" to reservedRoutes |
| `src/pages/[slug]/manga/[mangaSlug].astro` | Redirect to /joint if manga belongs to joint |
| `src/pages/red/[slug]/manga/[mangaSlug].astro` | Same redirect for NSFW path |
| `src/pages/[slug]/manga/[mangaSlug]/chapters/[number].astro` | Redirect chapter reader if joint |
| `src/pages/red/[slug]/manga/[mangaSlug]/chapters/[number].astro` | Same for NSFW |
| `src/components/admin/AdminSidebar.tsx` | Add Joints menu item |
| `src/components/admin/AdminNavbar.tsx` | Add Joints menu item |

---

## Task 1: Schema — Add MangaJoint, JointMember, modify Chapter

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums and new models to schema**

Add at the end of `prisma/schema.prisma`, before the last closing:

```prisma
enum JointRole {
  LEADER
  UPLOADER
  VIEWER
}

enum JointMemberStatus {
  INVITED
  ACCEPTED
  REJECTED
  EXPELLED
}

model MangaJoint {
  id               Int           @id @default(autoincrement())
  slug             String        @unique @db.VarChar(256)
  mangaId          Int
  manga            Manga         @relation(fields: [mangaId], references: [id])
  title            String        @default("") @db.VarChar(512)
  shortDescription String?       @db.VarChar(300)
  description      String?
  imageUrl         String?
  bannerUrl        String?
  status           String        @default("ongoing") @db.VarChar(64)
  workType         String        @default("manga") @db.VarChar(64)
  lastChapterAt    DateTime?
  createdAt        DateTime      @default(now()) @db.Timestamp(6)
  updatedAt        DateTime      @updatedAt
  deletedAt        DateTime?
  members          JointMember[]
  chapters         Chapter[]

  @@index([mangaId])
  @@index([lastChapterAt])
  @@map("manga_joint")
}

model JointMember {
  id             Int               @id @default(autoincrement())
  jointId        Int
  joint          MangaJoint        @relation(fields: [jointId], references: [id])
  organizationId Int
  organization   Organization      @relation(fields: [organizationId], references: [id])
  role           JointRole         @default(VIEWER)
  status         JointMemberStatus @default(INVITED)
  canEditJoint   Boolean           @default(false)
  canInvite      Boolean           @default(false)
  canExpel       Boolean           @default(false)
  invitedAt      DateTime          @default(now()) @db.Timestamp(6)
  respondedAt    DateTime?         @db.Timestamp(6)

  @@unique([jointId, organizationId])
  @@map("joint_member")
}
```

- [ ] **Step 2: Modify Chapter model — make mangaCustomId nullable, add jointId and worked-by fields**

Replace the Chapter model:

```prisma
model Chapter {
  id                       Int                  @id @default(autoincrement())
  number                   Float
  title                    String               @default("") @db.VarChar(256)
  imageUrl                 String?              @db.VarChar(256)
  createdAt                DateTime             @default(now()) @db.Timestamp(6)
  updatedAt                DateTime             @updatedAt
  mangaCustomId            Int?
  jointId                  Int?
  uploadedByOrganizationId Int?
  views                    Int                  @default(0)
  releasedAt               DateTime?            @db.Timestamp(6)
  isUnreleased             Boolean              @default(false)
  deletedAt                DateTime?
  mangaCustom              MangaCustom?         @relation(fields: [mangaCustomId], references: [id])
  joint                    MangaJoint?          @relation(fields: [jointId], references: [id])
  uploadedByOrganization   Organization?        @relation("ChapterUploader", fields: [uploadedByOrganizationId], references: [id])
  workedByOrganizations    Organization[]       @relation("ChapterWorkedBy")
  pages                    Page[]
  userHistory              UserChapterHistory[]
  viewsHistory             ViewsHistory[]

  @@unique([number, mangaCustomId])
  @@unique([number, jointId])
  @@map("chapter")
}
```

- [ ] **Step 3: Add back-references to Organization model**

Inside the Organization model, add after the last relation field (before `@@map`):

```prisma
  jointMembers              JointMember[]
  uploadedJointChapters     Chapter[]     @relation("ChapterUploader")
  workedOnJointChapters     Chapter[]     @relation("ChapterWorkedBy")
```

- [ ] **Step 4: Add back-reference to Manga model**

Inside the Manga model, add after `custom MangaCustom[]`:

```prisma
  joints     MangaJoint[]
```

- [ ] **Step 5: Run migration**

```bash
cd C:\Users\luisc\Desktop\Projects\lectormoe-api
bunx prisma migrate dev --name add_joints_feature
```

Expected: migration created and applied, Prisma client regenerated.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add MangaJoint, JointMember models; make Chapter.mangaCustomId nullable"
```

---

## Task 2: Type definitions for all joint requests

**Files:**
- Create: `src/types/joint/create.ts`
- Create: `src/types/joint/edit.ts`
- Create: `src/types/joint/invite.ts`
- Create: `src/types/joint/respond.ts`
- Create: `src/types/joint/transfer.ts`
- Create: `src/types/joint/permissions.ts`
- Create: `src/types/joint/chapter/create.ts`
- Create: `src/types/joint/chapter/edit.ts`

- [ ] **Step 1: Create `src/types/joint/create.ts`**

```typescript
import { type Static, t } from 'elysia';

export const CreateJointRequest = t.Object({
  mangaSlug: t.String(),
});

export type CreateJointRequest = Static<typeof CreateJointRequest>;
```

- [ ] **Step 2: Create `src/types/joint/edit.ts`**

```typescript
import { type Static, t } from 'elysia';

export const EditJointRequest = t.Object({
  title: t.Optional(t.Union([t.String(), t.Null()])),
  shortDescription: t.Optional(t.Union([t.String(), t.Null()])),
  description: t.Optional(t.Union([t.String(), t.Null()])),
  image: t.Optional(t.Union([t.String(), t.Null()])),
  banner: t.Optional(t.Union([t.String(), t.Null()])),
  status: t.Optional(t.Union([t.String(), t.Null()])),
  workType: t.Optional(t.Union([t.String(), t.Null()])),
  genreIds: t.Optional(t.Array(t.Number())),
});

export type EditJointRequest = Static<typeof EditJointRequest>;
```

- [ ] **Step 3: Create `src/types/joint/invite.ts`**

```typescript
import { type Static, t } from 'elysia';

export const InviteToJointRequest = t.Object({
  organizationSlug: t.String(),
  role: t.Union([t.Literal('UPLOADER'), t.Literal('VIEWER')]),
});

export type InviteToJointRequest = Static<typeof InviteToJointRequest>;
```

- [ ] **Step 4: Create `src/types/joint/respond.ts`**

```typescript
import { type Static, t } from 'elysia';

export const RespondToJointRequest = t.Object({
  accept: t.Boolean(),
});

export type RespondToJointRequest = Static<typeof RespondToJointRequest>;
```

- [ ] **Step 5: Create `src/types/joint/transfer.ts`**

```typescript
import { type Static, t } from 'elysia';

export const TransferJointRequest = t.Object({
  organizationSlug: t.String(),
});

export type TransferJointRequest = Static<typeof TransferJointRequest>;
```

- [ ] **Step 6: Create `src/types/joint/permissions.ts`**

```typescript
import { type Static, t } from 'elysia';

export const UpdateJointMemberPermissionsRequest = t.Object({
  canEditJoint: t.Optional(t.Boolean()),
  canInvite: t.Optional(t.Boolean()),
  canExpel: t.Optional(t.Boolean()),
  role: t.Optional(t.Union([t.Literal('UPLOADER'), t.Literal('VIEWER'), t.Literal('LEADER')])),
});

export type UpdateJointMemberPermissionsRequest = Static<typeof UpdateJointMemberPermissionsRequest>;
```

- [ ] **Step 7: Create `src/types/joint/chapter/create.ts`**

```typescript
import { type Static, t } from 'elysia';

export const CreateJointChapterRequest = t.Object({
  number: t.Number(),
  title: t.Optional(t.Union([t.String(), t.Null()])),
  image: t.Optional(t.Union([t.String(), t.Null()])),
  releasedAt: t.Optional(t.Union([t.Date(), t.Null(), t.String()])),
  isUnreleased: t.Optional(t.Boolean()),
  pages: t.Optional(t.Array(t.String())),
  singlePages: t.Optional(t.Array(t.Number())),
  workedByOrganizationIds: t.Optional(t.Array(t.Number())),
});

export type CreateJointChapterRequest = Static<typeof CreateJointChapterRequest>;
```

- [ ] **Step 8: Create `src/types/joint/chapter/edit.ts`**

```typescript
import { type Static, t } from 'elysia';

export const EditJointChapterRequest = t.Object({
  title: t.Optional(t.Union([t.String(), t.Null()])),
  image: t.Optional(t.Union([t.String(), t.Null()])),
  releasedAt: t.Optional(t.Union([t.Date(), t.Null(), t.String()])),
  isUnreleased: t.Optional(t.Boolean()),
  workedByOrganizationIds: t.Optional(t.Array(t.Number())),
});

export type EditJointChapterRequest = Static<typeof EditJointChapterRequest>;
```

- [ ] **Step 9: Commit**

```bash
git add src/types/joint/
git commit -m "feat(joint): add request type definitions"
```

---

## Task 3: Helper — getJointMember

Create a reusable helper to get and validate a caller's membership in a joint. Used across multiple controllers.

**Files:**
- Create: `src/util/joint-auth.ts`

- [ ] **Step 1: Create `src/util/joint-auth.ts`**

```typescript
import { prisma } from '../models/prisma';

/**
 * Returns the JointMember record for the calling org in a joint.
 * Throws if joint not found, org is not an ACCEPTED member, or role check fails.
 */
export async function requireJointMember(
  jointSlug: string,
  organizationId: number,
  requiredRoles?: string[]
) {
  const joint = await prisma.mangaJoint.findFirst({
    where: { slug: jointSlug, deletedAt: null },
    include: { members: true },
  });

  if (!joint) throw new Error('Joint no encontrado.');

  const member = joint.members.find(
    m => m.organizationId === organizationId && m.status === 'ACCEPTED'
  );

  if (!member) throw new Error('Tu organización no es miembro activo de este joint.');

  if (requiredRoles && !requiredRoles.includes(member.role)) {
    throw new Error('No tienes permisos suficientes en este joint.');
  }

  return { joint, member };
}

/**
 * Check if caller can edit joint info (leader OR canEditJoint).
 */
export function canEdit(member: { role: string; canEditJoint: boolean }) {
  return member.role === 'LEADER' || member.canEditJoint;
}

/**
 * Check if caller can invite to joint (leader OR canInvite).
 */
export function canInvite(member: { role: string; canInvite: boolean }) {
  return member.role === 'LEADER' || member.canInvite;
}

/**
 * Check if caller can expel from joint (leader OR canExpel).
 */
export function canExpel(member: { role: string; canExpel: boolean }) {
  return member.role === 'LEADER' || member.canExpel;
}

/**
 * Check if caller can upload chapters (UPLOADER or LEADER).
 */
export function canUpload(member: { role: string }) {
  return member.role === 'LEADER' || member.role === 'UPLOADER';
}
```

- [ ] **Step 2: Commit**

```bash
git add src/util/joint-auth.ts
git commit -m "feat(joint): add joint-auth helper"
```

---

## Task 4: Controller — Create Joint

**Files:**
- Create: `src/controllers/joint/create.ts`

- [ ] **Step 1: Create `src/controllers/joint/create.ts`**

```typescript
import { prisma } from '../../models/prisma';
import type { CreateJointRequest } from '../../types/joint/create';

async function generateJointSlug(baseSlug: string): Promise<string> {
  const suffixes = ['', '-b', '-c', '-d', '-e', '-f'];
  for (const suffix of suffixes) {
    const slug = `${baseSlug}${suffix}`;
    const exists = await prisma.mangaJoint.findUnique({ where: { slug } });
    if (!exists) return slug;
  }
  throw new Error('No se pudo generar un slug único para el joint.');
}

export const createJoint = async (organizationId: number, params: CreateJointRequest) => {
  const manga = await prisma.manga.findFirst({
    where: { slug: params.mangaSlug },
  });
  if (!manga) throw new Error('No se encontró el manga base.');

  // Check manga doesn't already have an active joint
  const existingJoint = await prisma.mangaJoint.findFirst({
    where: { mangaId: manga.id, deletedAt: null },
  });
  if (existingJoint) throw new Error('Este manga ya tiene un joint activo.');

  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isDeleted: false },
  });
  if (!organization) throw new Error('Organización no encontrada.');

  // Try to copy info from org's MangaCustom if it exists
  const existingCustom = await prisma.mangaCustom.findFirst({
    where: { mangaId: manga.id, organizationId, deletedAt: null },
  });

  const slug = await generateJointSlug(manga.slug);

  const joint = await prisma.mangaJoint.create({
    data: {
      slug,
      mangaId: manga.id,
      title: existingCustom?.title || manga.title,
      shortDescription: existingCustom?.shortDescription || manga.shortDescription || null,
      description: existingCustom?.description || manga.description || null,
      imageUrl: existingCustom?.imageUrl || manga.imageUrl || null,
      bannerUrl: existingCustom?.bannerUrl || manga.bannerUrl || null,
      status: existingCustom?.status || 'ongoing',
      workType: existingCustom?.workType || 'manga',
      members: {
        create: {
          organizationId,
          role: 'LEADER',
          status: 'ACCEPTED',
          respondedAt: new Date(),
        },
      },
    },
    include: {
      members: { include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } } } },
    },
  });

  return joint;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/controllers/joint/create.ts
git commit -m "feat(joint): add createJoint controller"
```

---

## Task 5: Controller — Get Joint (public)

**Files:**
- Create: `src/controllers/joint/get.ts`

- [ ] **Step 1: Create `src/controllers/joint/get.ts`**

```typescript
import { prisma } from '../../models/prisma';

const MEMBER_SELECT = {
  id: true,
  role: true,
  status: true,
  canEditJoint: true,
  canInvite: true,
  canExpel: true,
  invitedAt: true,
  respondedAt: true,
  organization: {
    select: { id: true, name: true, slug: true, logoUrl: true, title: true },
  },
};

const CHAPTER_SELECT = {
  id: true,
  number: true,
  title: true,
  imageUrl: true,
  releasedAt: true,
  isUnreleased: true,
  views: true,
  createdAt: true,
  uploadedByOrganization: {
    select: { id: true, name: true, slug: true, logoUrl: true },
  },
  workedByOrganizations: {
    select: { id: true, name: true, slug: true, logoUrl: true },
  },
};

export const getJoint = async (slug: string) => {
  const joint = await prisma.mangaJoint.findFirst({
    where: { slug, deletedAt: null },
    include: {
      manga: {
        include: {
          demography: { select: { name: true, slug: true } },
          bookType: { select: { name: true, code: true } },
          authors: { select: { name: true, slug: true } },
        },
      },
      members: { where: { status: 'ACCEPTED' }, select: MEMBER_SELECT },
      chapters: {
        where: { deletedAt: null },
        select: CHAPTER_SELECT,
        orderBy: { number: 'desc' },
      },
    },
  });

  if (!joint) throw new Error('Joint no encontrado.');
  return joint;
};

export const getJointForAdmin = async (slug: string) => {
  // Admin view includes INVITED and EXPELLED members too
  const joint = await prisma.mangaJoint.findFirst({
    where: { slug, deletedAt: null },
    include: {
      manga: {
        include: {
          demography: { select: { name: true, slug: true } },
          bookType: { select: { name: true, code: true } },
          authors: { select: { name: true, slug: true } },
        },
      },
      members: { select: MEMBER_SELECT },
      chapters: {
        where: { deletedAt: null },
        select: CHAPTER_SELECT,
        orderBy: { number: 'desc' },
      },
    },
  });

  if (!joint) throw new Error('Joint no encontrado.');
  return joint;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/controllers/joint/get.ts
git commit -m "feat(joint): add getJoint controller"
```

---

## Task 6: Controller — Edit Joint

**Files:**
- Create: `src/controllers/joint/edit.ts`

- [ ] **Step 1: Create `src/controllers/joint/edit.ts`**

```typescript
import { prisma } from '../../models/prisma';
import { requireJointMember, canEdit } from '../../util/joint-auth';
import type { EditJointRequest } from '../../types/joint/edit';

export const editJoint = async (
  slug: string,
  organizationId: number,
  params: EditJointRequest
) => {
  const { joint, member } = await requireJointMember(slug, organizationId);

  if (!canEdit(member)) {
    throw new Error('No tienes permisos para editar este joint.');
  }

  const r2PublicUrl = Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com';
  const updateData: any = {
    title: params.title,
    shortDescription: params.shortDescription,
    description: params.description,
    status: params.status,
    workType: params.workType,
  };

  if (params.image !== undefined) {
    updateData.imageUrl = params.image === null
      ? null
      : params.image.startsWith('http') ? params.image : `${r2PublicUrl}/${params.image}`;
  }

  if (params.banner !== undefined) {
    updateData.bannerUrl = params.banner === null
      ? null
      : params.banner.startsWith('http') ? params.banner : `${r2PublicUrl}/${params.banner}`;
  }

  // Remove undefined keys so Prisma doesn't overwrite with undefined
  Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

  await prisma.mangaJoint.update({
    where: { id: joint.id },
    data: updateData,
  });

  if (params.genreIds !== undefined) {
    await prisma.mangaJoint.update({
      where: { id: joint.id },
      data: {
        // Note: genres relation needs to be added to MangaJoint if using Prisma implicit m2m
        // For now genres are omitted from the joint (handled in a later task if needed)
      },
    });
  }

  return prisma.mangaJoint.findFirst({
    where: { id: joint.id },
    include: {
      members: {
        where: { status: 'ACCEPTED' },
        include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } } },
      },
    },
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/controllers/joint/edit.ts
git commit -m "feat(joint): add editJoint controller"
```

---

## Task 7: Controllers — Delete, List, and Invitation Management

**Files:**
- Create: `src/controllers/joint/delete.ts`
- Create: `src/controllers/joint/list.ts`
- Create: `src/controllers/joint/invite.ts`
- Create: `src/controllers/joint/respond.ts`
- Create: `src/controllers/joint/expel.ts`
- Create: `src/controllers/joint/transfer.ts`
- Create: `src/controllers/joint/member-permissions.ts`

- [ ] **Step 1: Create `src/controllers/joint/delete.ts`**

```typescript
import { prisma } from '../../models/prisma';
import { requireJointMember } from '../../util/joint-auth';

export const deleteJoint = async (slug: string, organizationId: number) => {
  const { joint, member } = await requireJointMember(slug, organizationId);

  if (member.role !== 'LEADER') {
    throw new Error('Solo el líder puede disolver el joint.');
  }

  const now = new Date();

  // Soft-delete all joint chapters
  await prisma.chapter.updateMany({
    where: { jointId: joint.id, deletedAt: null },
    data: { deletedAt: now },
  });

  // Soft-delete the joint
  await prisma.mangaJoint.update({
    where: { id: joint.id },
    data: { deletedAt: now },
  });

  return { success: true };
};
```

- [ ] **Step 2: Create `src/controllers/joint/list.ts`**

```typescript
import { prisma } from '../../models/prisma';

export const listJointsForOrg = async (organizationId: number) => {
  const members = await prisma.jointMember.findMany({
    where: {
      organizationId,
      status: { in: ['INVITED', 'ACCEPTED'] },
      joint: { deletedAt: null },
    },
    include: {
      joint: {
        include: {
          manga: { select: { title: true, slug: true } },
          members: {
            where: { status: 'ACCEPTED' },
            include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } } },
          },
          _count: { select: { chapters: { where: { deletedAt: null } } } },
        },
      },
    },
    orderBy: { invitedAt: 'desc' },
  });

  return members;
};
```

- [ ] **Step 3: Create `src/controllers/joint/invite.ts`**

```typescript
import { prisma } from '../../models/prisma';
import { requireJointMember, canInvite } from '../../util/joint-auth';
import type { InviteToJointRequest } from '../../types/joint/invite';

export const inviteToJoint = async (
  slug: string,
  callerOrgId: number,
  params: InviteToJointRequest
) => {
  const { joint, member } = await requireJointMember(slug, callerOrgId);

  if (!canInvite(member)) {
    throw new Error('No tienes permisos para invitar a este joint.');
  }

  const targetOrg = await prisma.organization.findFirst({
    where: { slug: params.organizationSlug, isDeleted: false },
  });
  if (!targetOrg) throw new Error('Organización no encontrada.');

  // Check not already an active or pending member
  const existing = await prisma.jointMember.findUnique({
    where: { jointId_organizationId: { jointId: joint.id, organizationId: targetOrg.id } },
  });

  if (existing) {
    if (existing.status === 'ACCEPTED') throw new Error('Esta organización ya es miembro del joint.');
    if (existing.status === 'INVITED') throw new Error('Esta organización ya tiene una invitación pendiente.');
    // REJECTED or EXPELLED: re-invite by updating
    return prisma.jointMember.update({
      where: { id: existing.id },
      data: { status: 'INVITED', role: params.role, invitedAt: new Date(), respondedAt: null },
      include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } } },
    });
  }

  return prisma.jointMember.create({
    data: {
      jointId: joint.id,
      organizationId: targetOrg.id,
      role: params.role,
      status: 'INVITED',
    },
    include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } } },
  });
};
```

- [ ] **Step 4: Create `src/controllers/joint/respond.ts`**

```typescript
import { prisma } from '../../models/prisma';
import type { RespondToJointRequest } from '../../types/joint/respond';

export const respondToJointInvite = async (
  slug: string,
  organizationId: number,
  params: RespondToJointRequest
) => {
  const joint = await prisma.mangaJoint.findFirst({
    where: { slug, deletedAt: null },
  });
  if (!joint) throw new Error('Joint no encontrado.');

  const member = await prisma.jointMember.findUnique({
    where: { jointId_organizationId: { jointId: joint.id, organizationId } },
  });

  if (!member) throw new Error('No tienes una invitación pendiente para este joint.');
  if (member.status !== 'INVITED') throw new Error('Esta invitación ya fue respondida.');

  return prisma.jointMember.update({
    where: { id: member.id },
    data: {
      status: params.accept ? 'ACCEPTED' : 'REJECTED',
      respondedAt: new Date(),
    },
    include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } } },
  });
};
```

- [ ] **Step 5: Create `src/controllers/joint/expel.ts`**

```typescript
import { prisma } from '../../models/prisma';
import { requireJointMember, canExpel } from '../../util/joint-auth';

export const expelFromJoint = async (
  slug: string,
  callerOrgId: number,
  targetOrgSlug: string
) => {
  const { joint, member } = await requireJointMember(slug, callerOrgId);

  if (!canExpel(member)) {
    throw new Error('No tienes permisos para expulsar miembros de este joint.');
  }

  const targetOrg = await prisma.organization.findFirst({
    where: { slug: targetOrgSlug, isDeleted: false },
  });
  if (!targetOrg) throw new Error('Organización no encontrada.');

  if (targetOrg.id === callerOrgId && member.role !== 'LEADER') {
    throw new Error('No puedes expulsarte a ti mismo.');
  }

  const targetMember = await prisma.jointMember.findUnique({
    where: { jointId_organizationId: { jointId: joint.id, organizationId: targetOrg.id } },
  });

  if (!targetMember || targetMember.status !== 'ACCEPTED') {
    throw new Error('La organización no es miembro activo del joint.');
  }

  if (targetMember.role === 'LEADER') {
    throw new Error('No puedes expulsar al líder. Primero transfiere el liderazgo.');
  }

  return prisma.jointMember.update({
    where: { id: targetMember.id },
    data: { status: 'EXPELLED' },
  });
};
```

- [ ] **Step 6: Create `src/controllers/joint/transfer.ts`**

```typescript
import { prisma } from '../../models/prisma';
import { requireJointMember } from '../../util/joint-auth';
import type { TransferJointRequest } from '../../types/joint/transfer';

export const transferJointLeadership = async (
  slug: string,
  callerOrgId: number,
  params: TransferJointRequest
) => {
  const { joint, member } = await requireJointMember(slug, callerOrgId);

  if (member.role !== 'LEADER') {
    throw new Error('Solo el líder puede transferir el liderazgo.');
  }

  const targetOrg = await prisma.organization.findFirst({
    where: { slug: params.organizationSlug, isDeleted: false },
  });
  if (!targetOrg) throw new Error('Organización no encontrada.');
  if (targetOrg.id === callerOrgId) throw new Error('Ya eres el líder.');

  const targetMember = await prisma.jointMember.findUnique({
    where: { jointId_organizationId: { jointId: joint.id, organizationId: targetOrg.id } },
  });

  if (!targetMember || targetMember.status !== 'ACCEPTED') {
    throw new Error('La organización no es miembro activo del joint.');
  }

  // Transfer: caller → UPLOADER, target → LEADER
  await prisma.$transaction([
    prisma.jointMember.update({
      where: { id: member.id },
      data: { role: 'UPLOADER', canEditJoint: false, canInvite: false, canExpel: false },
    }),
    prisma.jointMember.update({
      where: { id: targetMember.id },
      data: { role: 'LEADER' },
    }),
  ]);

  return { success: true };
};
```

- [ ] **Step 7: Create `src/controllers/joint/member-permissions.ts`**

```typescript
import { prisma } from '../../models/prisma';
import { requireJointMember } from '../../util/joint-auth';
import type { UpdateJointMemberPermissionsRequest } from '../../types/joint/permissions';

export const updateJointMemberPermissions = async (
  slug: string,
  callerOrgId: number,
  targetOrgSlug: string,
  params: UpdateJointMemberPermissionsRequest
) => {
  const { joint, member } = await requireJointMember(slug, callerOrgId);

  if (member.role !== 'LEADER') {
    throw new Error('Solo el líder puede modificar permisos de los miembros.');
  }

  const targetOrg = await prisma.organization.findFirst({
    where: { slug: targetOrgSlug, isDeleted: false },
  });
  if (!targetOrg) throw new Error('Organización no encontrada.');
  if (targetOrg.id === callerOrgId) throw new Error('No puedes modificar tus propios permisos.');

  const targetMember = await prisma.jointMember.findUnique({
    where: { jointId_organizationId: { jointId: joint.id, organizationId: targetOrg.id } },
  });

  if (!targetMember || targetMember.status !== 'ACCEPTED') {
    throw new Error('La organización no es miembro activo del joint.');
  }

  if (targetMember.role === 'LEADER') {
    throw new Error('No puedes modificar permisos del líder.');
  }

  const updateData: any = {};
  if (params.canEditJoint !== undefined) updateData.canEditJoint = params.canEditJoint;
  if (params.canInvite !== undefined) updateData.canInvite = params.canInvite;
  if (params.canExpel !== undefined) updateData.canExpel = params.canExpel;
  if (params.role !== undefined && params.role !== 'LEADER') updateData.role = params.role;

  return prisma.jointMember.update({
    where: { id: targetMember.id },
    data: updateData,
    include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } } },
  });
};
```

- [ ] **Step 8: Commit**

```bash
git add src/controllers/joint/
git commit -m "feat(joint): add joint management controllers (delete, list, invite, respond, expel, transfer, permissions)"
```

---

## Task 8: Controllers — Joint Chapters

**Files:**
- Create: `src/controllers/joint/chapter/create.ts`
- Create: `src/controllers/joint/chapter/get.ts`
- Create: `src/controllers/joint/chapter/edit.ts`
- Create: `src/controllers/joint/chapter/delete.ts`

- [ ] **Step 1: Create `src/controllers/joint/chapter/create.ts`**

```typescript
import { prisma } from '../../../models/prisma';
import { requireJointMember, canUpload } from '../../../util/joint-auth';
import type { CreateJointChapterRequest } from '../../../types/joint/chapter/create';

export const createJointChapter = async (
  slug: string,
  organizationId: number,
  params: CreateJointChapterRequest
) => {
  const { joint, member } = await requireJointMember(slug, organizationId);

  if (!canUpload(member)) {
    throw new Error('No tienes permisos para subir capítulos a este joint.');
  }

  // Check chapter number doesn't already exist
  const existing = await prisma.chapter.findFirst({
    where: { jointId: joint.id, number: params.number, deletedAt: null },
  });
  if (existing) throw new Error(`El capítulo ${params.number} ya existe en este joint.`);

  const r2PublicUrl = Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com';
  let imageUrl: string | null = null;
  if (params.image && typeof params.image === 'string') {
    imageUrl = params.image.startsWith('http') ? params.image : `${r2PublicUrl}/${params.image}`;
  }

  // Validate workedByOrganizationIds are all ACCEPTED members
  const acceptedMemberIds = joint.members
    .filter((m: any) => m.status === 'ACCEPTED')
    .map((m: any) => m.organizationId);

  const workedByIds = (params.workedByOrganizationIds || []).filter(id =>
    acceptedMemberIds.includes(id)
  );

  const chapter = await prisma.chapter.create({
    data: {
      jointId: joint.id,
      mangaCustomId: null,
      uploadedByOrganizationId: organizationId,
      number: params.number,
      title: params.title || '',
      imageUrl,
      releasedAt: params.isUnreleased ? null : (params.releasedAt ? new Date(params.releasedAt as any) : new Date()),
      isUnreleased: params.isUnreleased ?? false,
      workedByOrganizations: {
        connect: workedByIds.map(id => ({ id })),
      },
    },
  });

  // Create pages
  if (params.pages && params.pages.length > 0) {
    await Promise.all(
      params.pages.map(async (page, index) => {
        const pageUrl = page.startsWith('http') ? page : `${r2PublicUrl}/${page}`;
        await prisma.page.create({
          data: {
            imageUrl: pageUrl,
            number: index + 1,
            chapterId: chapter.id,
            imageHeight: 100,
            imageWidth: 100,
            imageType: 'any',
            // @ts-ignore
            isSinglePage: params.singlePages?.includes(index) ?? false,
          },
        });
      })
    );
  }

  // Update joint lastChapterAt
  await prisma.mangaJoint.update({
    where: { id: joint.id },
    data: { lastChapterAt: new Date() },
  });

  return prisma.chapter.findFirst({
    where: { id: chapter.id },
    include: {
      pages: { orderBy: { number: 'asc' } },
      uploadedByOrganization: { select: { id: true, name: true, slug: true, logoUrl: true } },
      workedByOrganizations: { select: { id: true, name: true, slug: true, logoUrl: true } },
    },
  });
};
```

- [ ] **Step 2: Create `src/controllers/joint/chapter/get.ts`**

```typescript
import { prisma } from '../../../models/prisma';

export const getJointChapter = async (slug: string, chapterNumber: number) => {
  const joint = await prisma.mangaJoint.findFirst({
    where: { slug, deletedAt: null },
  });
  if (!joint) throw new Error('Joint no encontrado.');

  const chapter = await prisma.chapter.findFirst({
    where: { jointId: joint.id, number: chapterNumber, deletedAt: null },
    include: {
      pages: { orderBy: { number: 'asc' } },
      uploadedByOrganization: { select: { id: true, name: true, slug: true, logoUrl: true } },
      workedByOrganizations: { select: { id: true, name: true, slug: true, logoUrl: true } },
    },
  });
  if (!chapter) throw new Error('Capítulo no encontrado.');

  // Adjacent chapters for reader navigation
  const [prev, next] = await Promise.all([
    prisma.chapter.findFirst({
      where: { jointId: joint.id, number: { lt: chapterNumber }, deletedAt: null },
      orderBy: { number: 'desc' },
      select: { number: true },
    }),
    prisma.chapter.findFirst({
      where: { jointId: joint.id, number: { gt: chapterNumber }, deletedAt: null },
      orderBy: { number: 'asc' },
      select: { number: true },
    }),
  ]);

  return { chapter, prevChapter: prev, nextChapter: next, joint };
};
```

- [ ] **Step 3: Create `src/controllers/joint/chapter/edit.ts`**

```typescript
import { prisma } from '../../../models/prisma';
import { requireJointMember, canEdit } from '../../../util/joint-auth';
import type { EditJointChapterRequest } from '../../../types/joint/chapter/edit';

export const editJointChapter = async (
  slug: string,
  chapterNumber: number,
  organizationId: number,
  params: EditJointChapterRequest
) => {
  const { joint, member } = await requireJointMember(slug, organizationId);

  const chapter = await prisma.chapter.findFirst({
    where: { jointId: joint.id, number: chapterNumber, deletedAt: null },
  });
  if (!chapter) throw new Error('Capítulo no encontrado.');

  // Permission: uploader of the chapter OR leader/canEditJoint
  const isUploader = chapter.uploadedByOrganizationId === organizationId;
  const hasEditPerm = canEdit(member);
  if (!isUploader && !hasEditPerm) {
    throw new Error('No tienes permisos para editar este capítulo.');
  }

  const r2PublicUrl = Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com';
  const updateData: any = {};

  if (params.title !== undefined) updateData.title = params.title ?? '';
  if (params.releasedAt !== undefined) updateData.releasedAt = params.releasedAt ? new Date(params.releasedAt as any) : null;
  if (params.isUnreleased !== undefined) updateData.isUnreleased = params.isUnreleased;
  if (params.image !== undefined) {
    updateData.imageUrl = params.image === null
      ? null
      : params.image.startsWith('http') ? params.image : `${r2PublicUrl}/${params.image}`;
  }

  await prisma.chapter.update({ where: { id: chapter.id }, data: updateData });

  if (params.workedByOrganizationIds !== undefined) {
    const acceptedMemberIds = await prisma.jointMember.findMany({
      where: { jointId: joint.id, status: 'ACCEPTED' },
      select: { organizationId: true },
    }).then(ms => ms.map(m => m.organizationId));

    const validIds = params.workedByOrganizationIds.filter(id => acceptedMemberIds.includes(id));

    await prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        workedByOrganizations: { set: validIds.map(id => ({ id })) },
      },
    });
  }

  return prisma.chapter.findFirst({
    where: { id: chapter.id },
    include: {
      pages: { orderBy: { number: 'asc' } },
      uploadedByOrganization: { select: { id: true, name: true, slug: true, logoUrl: true } },
      workedByOrganizations: { select: { id: true, name: true, slug: true, logoUrl: true } },
    },
  });
};
```

- [ ] **Step 4: Create `src/controllers/joint/chapter/delete.ts`**

```typescript
import { prisma } from '../../../models/prisma';
import { requireJointMember, canEdit } from '../../../util/joint-auth';

export const deleteJointChapter = async (
  slug: string,
  chapterNumber: number,
  organizationId: number
) => {
  const { joint, member } = await requireJointMember(slug, organizationId);

  const chapter = await prisma.chapter.findFirst({
    where: { jointId: joint.id, number: chapterNumber, deletedAt: null },
  });
  if (!chapter) throw new Error('Capítulo no encontrado.');

  const isUploader = chapter.uploadedByOrganizationId === organizationId;
  const hasEditPerm = canEdit(member);
  if (!isUploader && !hasEditPerm) {
    throw new Error('No tienes permisos para eliminar este capítulo.');
  }

  await prisma.chapter.update({
    where: { id: chapter.id },
    data: { deletedAt: new Date() },
  });

  return { success: true };
};
```

- [ ] **Step 5: Commit**

```bash
git add src/controllers/joint/chapter/
git commit -m "feat(joint): add joint chapter controllers (create, get, edit, delete)"
```

---

## Task 9: Routes — All joint endpoints

**Files:**
- Create: `src/routes/joint/index.ts`
- Modify: `src/routes/router.ts`

- [ ] **Step 1: Create `src/routes/joint/index.ts`**

```typescript
import { Elysia, t } from 'elysia';
import { loggedUserOnly } from '../../plugins/auth';
import { useOrganizationOptional } from '../../plugins/organization';
import { CreateJointRequest } from '../../types/joint/create';
import { EditJointRequest } from '../../types/joint/edit';
import { InviteToJointRequest } from '../../types/joint/invite';
import { RespondToJointRequest } from '../../types/joint/respond';
import { TransferJointRequest } from '../../types/joint/transfer';
import { UpdateJointMemberPermissionsRequest } from '../../types/joint/permissions';
import { CreateJointChapterRequest } from '../../types/joint/chapter/create';
import { EditJointChapterRequest } from '../../types/joint/chapter/edit';
import { createJoint } from '../../controllers/joint/create';
import { getJoint, getJointForAdmin } from '../../controllers/joint/get';
import { editJoint } from '../../controllers/joint/edit';
import { deleteJoint } from '../../controllers/joint/delete';
import { listJointsForOrg } from '../../controllers/joint/list';
import { inviteToJoint } from '../../controllers/joint/invite';
import { respondToJointInvite } from '../../controllers/joint/respond';
import { expelFromJoint } from '../../controllers/joint/expel';
import { transferJointLeadership } from '../../controllers/joint/transfer';
import { updateJointMemberPermissions } from '../../controllers/joint/member-permissions';
import { createJointChapter } from '../../controllers/joint/chapter/create';
import { getJointChapter } from '../../controllers/joint/chapter/get';
import { editJointChapter } from '../../controllers/joint/chapter/edit';
import { deleteJointChapter } from '../../controllers/joint/chapter/delete';

export const router = () => new Elysia()
  // ─── PUBLIC ROUTES ──────────────────────────────────────────────────────────
  .get('/api/joint/:slug', async ({ params: { slug } }) => {
    const data = await getJoint(slug);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  .get('/api/joint/:slug/chapter/:number', async ({ params: { slug, number } }) => {
    const data = await getJointChapter(slug, parseFloat(number));
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // ─── AUTHENTICATED ROUTES ────────────────────────────────────────────────────
  .use(loggedUserOnly())
  .use(useOrganizationOptional())

  // List joints for caller's org
  .get('/api/joint', async ({ organizationId }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await listJointsForOrg(organizationId);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Get joint for admin (includes all member statuses)
  .get('/api/joint/:slug/admin', async ({ params: { slug }, organizationId }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await getJointForAdmin(slug);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Create joint
  .post('/api/joint', async ({ organizationId, user, body }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const permissions = user.permissions.find((p: any) => p.organizationId === organizationId);
    if (!permissions?.canEditMangaCustom) throw new Error('No tienes permisos para crear joints.');
    const data = await createJoint(organizationId, body);
    return { status: true, data };
  }, { body: CreateJointRequest, response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Edit joint info
  .patch('/api/joint/:slug', async ({ params: { slug }, organizationId, body }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await editJoint(slug, organizationId, body);
    return { status: true, data };
  }, { body: EditJointRequest, response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Dissolve joint
  .delete('/api/joint/:slug', async ({ params: { slug }, organizationId }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await deleteJoint(slug, organizationId);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Invite org to joint
  .post('/api/joint/:slug/invite', async ({ params: { slug }, organizationId, body }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await inviteToJoint(slug, organizationId, body);
    return { status: true, data };
  }, { body: InviteToJointRequest, response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Respond to invitation
  .patch('/api/joint/:slug/respond', async ({ params: { slug }, organizationId, body }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await respondToJointInvite(slug, organizationId, body);
    return { status: true, data };
  }, { body: RespondToJointRequest, response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Expel member
  .delete('/api/joint/:slug/member/:orgSlug', async ({ params: { slug, orgSlug }, organizationId }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await expelFromJoint(slug, organizationId, orgSlug);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Transfer leadership
  .patch('/api/joint/:slug/transfer', async ({ params: { slug }, organizationId, body }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await transferJointLeadership(slug, organizationId, body);
    return { status: true, data };
  }, { body: TransferJointRequest, response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Update member permissions
  .patch('/api/joint/:slug/member/:orgSlug/permissions', async ({ params: { slug, orgSlug }, organizationId, body }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await updateJointMemberPermissions(slug, organizationId, orgSlug, body);
    return { status: true, data };
  }, { body: UpdateJointMemberPermissionsRequest, response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // ─── JOINT CHAPTER ROUTES ────────────────────────────────────────────────────

  // Create joint chapter
  .post('/api/joint/:slug/chapter', async ({ params: { slug }, organizationId, body }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await createJointChapter(slug, organizationId, body);
    return { status: true, data };
  }, {
    body: CreateJointChapterRequest,
    response: t.Object({ status: t.Boolean(), data: t.Any() }),
    transform({ body }) {
      body.number = parseFloat(body.number.toString());
      if (body.releasedAt && body.releasedAt !== null) body.releasedAt = new Date(body.releasedAt as any);
      if (body.isUnreleased !== undefined && body.isUnreleased !== null) {
        body.isUnreleased = body.isUnreleased.toString() === 'true';
      }
      if (body.workedByOrganizationIds && Array.isArray(body.workedByOrganizationIds)) {
        body.workedByOrganizationIds = body.workedByOrganizationIds.map(id => parseInt(id.toString()));
      }
    },
  })

  // Edit joint chapter
  .patch('/api/joint/:slug/chapter/:number', async ({ params: { slug, number }, organizationId, body }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await editJointChapter(slug, parseFloat(number), organizationId, body);
    return { status: true, data };
  }, {
    body: EditJointChapterRequest,
    response: t.Object({ status: t.Boolean(), data: t.Any() }),
    transform({ body }) {
      if (body.releasedAt && body.releasedAt !== null) body.releasedAt = new Date(body.releasedAt as any);
      if (body.isUnreleased !== undefined && body.isUnreleased !== null) {
        body.isUnreleased = body.isUnreleased.toString() === 'true';
      }
      if (body.workedByOrganizationIds && Array.isArray(body.workedByOrganizationIds)) {
        body.workedByOrganizationIds = body.workedByOrganizationIds.map(id => parseInt(id.toString()));
      }
    },
  })

  // Delete joint chapter
  .delete('/api/joint/:slug/chapter/:number', async ({ params: { slug, number }, organizationId }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await deleteJointChapter(slug, parseFloat(number), organizationId);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) });
```

- [ ] **Step 2: Register joint routes in `src/routes/router.ts`**

Find the import block in `router.ts` and add:
```typescript
import { router as jointRouter } from './joint/index';
```

Then in the router chain, add:
```typescript
.use(jointRouter())
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/joint/ src/routes/router.ts
git commit -m "feat(joint): register all joint routes"
```

---

## Task 10: API — Return jointSlug in manga-custom get

When a manga belongs to an active joint, the response should include `jointSlug` so the frontend knows to redirect.

**Files:**
- Modify: `src/controllers/manga-custom/get.ts`

- [ ] **Step 1: Read current `src/controllers/manga-custom/get.ts`** to understand return structure.

- [ ] **Step 2: Add joint lookup after fetching manga**

Inside `getMangaCustomBySlug` (or equivalent), after fetching `mangaCustom`, add:

```typescript
// Check if this manga belongs to an active joint
const activeJoint = await prisma.mangaJoint.findFirst({
  where: { mangaId: mangaCustom.manga.id, deletedAt: null },
  select: { slug: true },
});

return {
  ...mangaCustom,
  jointSlug: activeJoint?.slug || null,
};
```

- [ ] **Step 3: Commit**

```bash
git add src/controllers/manga-custom/get.ts
git commit -m "feat(joint): return jointSlug in manga-custom get response"
```

---

## Task 11: Frontend — Add 'joint' to reserved routes

**Files:**
- Modify: `src/middleware/index.ts`
- Modify: `src/util/callApi.ts`

- [ ] **Step 1: Add 'joint' to reservedRoutes in `src/middleware/index.ts`**

Find the `reservedRoutes` array and add `'joint'`:

```typescript
const reservedRoutes = ['logout', '404', '500', 'forgot-password', 'login', 'register', 'search', 'scans', 'subscriptions', 'organizations', 'profile', 'settings', 'superadmin', 'joint'];
```

- [ ] **Step 2: Add 'joint' to reservedRoutes in `src/util/callApi.ts`**

```typescript
const reservedRoutes = ['admin', 'login', 'register', 'logout', '404', '500', 'forgot', 'search', 'scans', 'subscriptions', 'organizations', 'manga', 'profile', 'joint'];
```

- [ ] **Step 3: Commit**

```bash
cd C:\Users\luisc\Desktop\Projects\lectormoe-frontend
git add src/middleware/index.ts src/util/callApi.ts
git commit -m "feat(joint): add 'joint' to reserved routes"
```

---

## Task 12: Frontend — Redirect from org manga pages to joint

When a manga belongs to a joint, any org-specific URL should redirect to `/joint/manga/{slug}`.

**Files:**
- Modify: `src/pages/[slug]/manga/[mangaSlug].astro`
- Modify: `src/pages/red/[slug]/manga/[mangaSlug].astro`
- Modify: `src/pages/[slug]/manga/[mangaSlug]/chapters/[number].astro` (if exists)
- Modify: `src/pages/red/[slug]/manga/[mangaSlug]/chapters/[number].astro` (if exists)

- [ ] **Step 1: Read `src/pages/[slug]/manga/[mangaSlug].astro`** to see current data fetching pattern.

- [ ] **Step 2: Add redirect logic in `[slug]/manga/[mangaSlug].astro`**

After the existing API call that fetches manga data, add:

```astro
---
// ... existing code that fetches mangaData ...

// If manga belongs to a joint, redirect to joint page
if (mangaData?.jointSlug) {
  return Astro.redirect(`/joint/manga/${mangaData.jointSlug}`, 301);
}
---
```

- [ ] **Step 3: Same in `red/[slug]/manga/[mangaSlug].astro`**

```astro
if (mangaData?.jointSlug) {
  return Astro.redirect(`/joint/manga/${mangaData.jointSlug}`, 301);
}
```

- [ ] **Step 4: Same in chapter reader pages** — redirect chapter URLs to `/joint/manga/{slug}/chapters/{number}`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/
git commit -m "feat(joint): redirect org manga/chapter pages to /joint if manga belongs to joint"
```

---

## Task 13: Frontend — Public joint manga page

**Files:**
- Create: `src/pages/joint/manga/[slug].astro`
- Create: `src/components/landing/JointMangaDetailPage.tsx`

- [ ] **Step 1: Create `src/pages/joint/manga/[slug].astro`**

```astro
---
import LandingLayout from '../../../layouts/LandingLayout.astro';
import JointMangaDetailPage from '../../../components/landing/JointMangaDetailPage';

const { slug } = Astro.params;
const { callAPI, user, logged } = Astro.locals;

let joint = null;
try {
  joint = await callAPI(`/api/joint/${slug}`);
} catch (e) {
  return Astro.redirect('/404');
}

if (!joint) return Astro.redirect('/404');

const title = joint.title || joint.manga?.title || 'Joint';
const description = joint.shortDescription || joint.description || '';
const image = joint.imageUrl || joint.manga?.imageUrl || '';
---

<LandingLayout title={title} description={description} image={image}>
  <JointMangaDetailPage
    client:load
    joint={joint}
    user={user}
    logged={logged}
  />
</LandingLayout>
```

- [ ] **Step 2: Create `src/components/landing/JointMangaDetailPage.tsx`**

This component is similar to `MangaDetailPage.tsx` but adapted for joints. Key differences:
- Navbar area shows logos of all active members (clickable → their org page)
- Below "AÑADIR A FAVORITOS" shows all participating org logos
- Chapters list shows `workedByOrganizations` logos
- No subscription/unreleased restrictions

```typescript
import React, { useState } from 'react';
import { callAPI } from '@/util/callApi';
import { Users } from 'lucide-react';

interface JointMangaDetailPageProps {
  joint: any;
  user?: any;
  logged?: boolean;
}

const JointMangaDetailPage: React.FC<JointMangaDetailPageProps> = ({ joint, user, logged }) => {
  const [addedToFavorites, setAddedToFavorites] = useState(false);

  const activeMembers = joint.members?.filter((m: any) => m.status === 'ACCEPTED') || [];
  const chapters = joint.chapters || [];

  const handleAddToFavorites = async () => {
    // Favorites for joints use a special identifier: joint:{slug}
    // This may require a backend change to support joint favorites
    // For now, show a toast indicating it's not yet supported
    alert('Favoritos para joints próximamente');
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Banner */}
      <div className="relative h-64 md:h-80 overflow-hidden">
        <img
          src={joint.bannerUrl || joint.imageUrl || 'https://via.placeholder.com/1200x400'}
          alt={joint.title}
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-32 relative z-10">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Cover */}
          <div className="flex-shrink-0">
            <img
              src={joint.imageUrl || 'https://via.placeholder.com/300x420'}
              alt={joint.title}
              className="w-48 h-72 object-cover rounded-2xl shadow-2xl"
            />
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4 pt-32 md:pt-0">
            {/* Joint badge */}
            <div className="flex items-center gap-2">
              <span className="bg-purple-500/20 text-purple-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Users size={12} />
                Joint
              </span>
            </div>

            <h1 className="text-3xl font-black text-white">{joint.title}</h1>
            <p className="text-zinc-400 text-sm leading-relaxed">{joint.shortDescription || joint.description}</p>

            {/* Participating scans logos */}
            <div className="space-y-2">
              <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Scans participantes</p>
              <div className="flex flex-wrap gap-3">
                {activeMembers.map((m: any) => (
                  <a
                    key={m.organization.id}
                    href={`/${m.organization.slug}`}
                    className="flex items-center gap-2 bg-zinc-800/50 hover:bg-zinc-700/50 rounded-xl px-3 py-2 transition-colors"
                  >
                    {m.organization.logoUrl ? (
                      <img src={m.organization.logoUrl} alt={m.organization.name} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-400">
                        {m.organization.name[0]}
                      </div>
                    )}
                    <span className="text-sm font-medium text-zinc-300">{m.organization.name}</span>
                    {m.role === 'LEADER' && (
                      <span className="text-xs text-yellow-400">★</span>
                    )}
                  </a>
                ))}
              </div>
            </div>

            {/* Add to favorites */}
            <button
              onClick={handleAddToFavorites}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-6 rounded-2xl transition-colors text-sm"
            >
              AÑADIR A FAVORITOS
            </button>
          </div>
        </div>

        {/* Chapters list */}
        <div className="mt-12 space-y-4">
          <h2 className="text-xl font-black text-white uppercase tracking-wider">Capítulos</h2>
          {chapters.length === 0 ? (
            <p className="text-zinc-500">No hay capítulos aún.</p>
          ) : (
            <div className="space-y-2">
              {chapters.map((ch: any) => (
                <a
                  key={ch.id}
                  href={`/joint/manga/${joint.slug}/chapters/${ch.number}`}
                  className="flex items-center justify-between bg-zinc-900 hover:bg-zinc-800 rounded-2xl px-5 py-4 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-white font-bold">Cap. {ch.number}</span>
                    {ch.title && <span className="text-zinc-400 text-sm">{ch.title}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Worked-by org logos */}
                    {(ch.workedByOrganizations || []).map((org: any) => (
                      <img
                        key={org.id}
                        src={org.logoUrl || ''}
                        alt={org.name}
                        title={org.name}
                        className="w-6 h-6 rounded-full object-cover"
                        onError={(e: any) => { e.target.style.display = 'none'; }}
                      />
                    ))}
                    <span className="text-zinc-500 text-xs">
                      {ch.releasedAt ? new Date(ch.releasedAt).toLocaleDateString('es') : 'Sin fecha'}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JointMangaDetailPage;
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/joint/ src/components/landing/JointMangaDetailPage.tsx
git commit -m "feat(joint): add public joint manga detail page"
```

---

## Task 14: Frontend — Joint chapter reader page

**Files:**
- Create: `src/pages/joint/manga/[slug]/chapters/[number].astro`

- [ ] **Step 1: Read an existing chapter reader page** (e.g., `src/pages/[slug]/manga/[mangaSlug]/chapters/[number].astro`) to understand how the Reader component is used.

- [ ] **Step 2: Create `src/pages/joint/manga/[slug]/chapters/[number].astro`**

Pattern: call `/api/joint/{slug}/chapter/{number}`, then pass data to the Reader component the same way org chapter pages do. Key fields the Reader needs: `pages`, `chapter.number`, `prevChapter`, `nextChapter`, `manga.title`.

```astro
---
import Layout from '../../../../../layouts/Layout.astro';
import Reader from '../../../../../components/Reader';

const { slug, number } = Astro.params;
const { callAPI, user, logged } = Astro.locals;

let chapterData = null;
try {
  // Note: this API call has no x-organization header since /joint is a reserved route
  // The API /api/joint/:slug/chapter/:number is public and doesn't need org context
  chapterData = await callAPI(`/api/joint/${slug}/chapter/${number}`);
} catch (e) {
  return Astro.redirect('/404');
}

if (!chapterData) return Astro.redirect('/404');

const { chapter, prevChapter, nextChapter, joint } = chapterData;
const prevUrl = prevChapter ? `/joint/manga/${slug}/chapters/${prevChapter.number}` : null;
const nextUrl = nextChapter ? `/joint/manga/${slug}/chapters/${nextChapter.number}` : null;
const mangaUrl = `/joint/manga/${slug}`;
---

<Layout title={`${joint.title} - Cap. ${chapter.number}`}>
  <Reader
    client:load
    pages={chapter.pages}
    chapterNumber={chapter.number}
    chapterTitle={chapter.title}
    prevChapterUrl={prevUrl}
    nextChapterUrl={nextUrl}
    mangaUrl={mangaUrl}
    mangaTitle={joint.title}
    user={user}
    logged={logged}
  />
</Layout>
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/joint/
git commit -m "feat(joint): add joint chapter reader page"
```

---

## Task 15: Frontend — Admin sidebar + Joints list page

**Files:**
- Modify: `src/components/admin/AdminSidebar.tsx`
- Modify: `src/components/admin/AdminNavbar.tsx`
- Create: `src/pages/[slug]/admin/joints.astro`
- Create: `src/pages/red/[slug]/admin/joints.astro`
- Create: `src/components/admin/AdminJointGrid.tsx`

- [ ] **Step 1: Add Joints link to AdminSidebar.tsx**

Find where other sidebar items are defined (e.g., the genres link). Add after it:

```typescript
{
  label: 'Joints',
  href: `/${organizationSlug}/admin/joints`,
  icon: <Users size={18} />,
}
```

Import `Users` from `lucide-react` if not already imported.

- [ ] **Step 2: Same in AdminNavbar.tsx**

- [ ] **Step 3: Create `src/pages/[slug]/admin/joints.astro`**

```astro
---
import AdminLayout from '../../../../layouts/AdminLayout.astro';
import AdminJointGrid from '../../../../components/admin/AdminJointGrid';

const { slug } = Astro.params;
const { organization, user, token, logged } = Astro.locals;

if (!logged) return Astro.redirect(`/${slug}/login`);
---

<AdminLayout title="Joints" organization={organization} user={user}>
  <AdminJointGrid
    client:load
    organization={organization}
    user={user}
    token={token}
  />
</AdminLayout>
```

- [ ] **Step 4: Create `src/pages/red/[slug]/admin/joints.astro`** — same as above.

- [ ] **Step 5: Create `src/components/admin/AdminJointGrid.tsx`**

```typescript
import React, { useEffect, useState } from 'react';
import { callAPI } from '@/util/callApi';
import { Users, Plus, Clock, CheckCircle } from 'lucide-react';

interface AdminJointGridProps {
  organization: any;
  user?: any;
  token?: string;
}

const AdminJointGrid: React.FC<AdminJointGridProps> = ({ organization }) => {
  const [joints, setJoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [mangaSlug, setMangaSlug] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await callAPI('/api/joint');
      if (Array.isArray(result)) setJoints(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!mangaSlug.trim()) return;
    setCreating(true);
    try {
      await callAPI('/api/joint', {
        method: 'POST',
        body: JSON.stringify({ mangaSlug: mangaSlug.trim() }),
      });
      setMangaSlug('');
      setShowCreateForm(false);
      load();
    } catch (e: any) {
      alert(e?.message || 'Error al crear el joint');
    } finally {
      setCreating(false);
    }
  };

  const handleRespond = async (jointSlug: string, accept: boolean) => {
    try {
      await callAPI(`/api/joint/${jointSlug}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ accept }),
      });
      load();
    } catch (e: any) {
      alert(e?.message || 'Error al responder la invitación');
    }
  };

  if (loading) return <div className="text-zinc-400">Cargando joints...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Users size={24} /> Joints
        </h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2 px-4 rounded-xl text-sm transition-colors"
        >
          <Plus size={16} /> Crear Joint
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-4">
          <h3 className="text-white font-bold">Crear nuevo joint</h3>
          <p className="text-zinc-400 text-sm">Ingresa el slug del manga base para crear un joint.</p>
          <input
            type="text"
            value={mangaSlug}
            onChange={e => setMangaSlug(e.target.value)}
            placeholder="ej: blue-lock"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500"
          />
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2 px-4 rounded-xl text-sm disabled:opacity-50"
            >
              {creating ? 'Creando...' : 'Crear'}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-4 rounded-xl text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {joints.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <Users size={48} className="mx-auto mb-4 opacity-20" />
          <p className="font-bold">No tienes joints activos</p>
          <p className="text-sm mt-1">Crea uno o espera ser invitado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {joints.map((item: any) => {
            const joint = item.joint;
            const myStatus = item.status;
            const myRole = item.role;

            return (
              <div key={joint.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="aspect-[16/9] relative overflow-hidden bg-zinc-800">
                  <img
                    src={joint.imageUrl || 'https://via.placeholder.com/320x180'}
                    alt={joint.title}
                    className="w-full h-full object-cover opacity-70"
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    {myStatus === 'INVITED' && (
                      <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <Clock size={10} /> Invitación pendiente
                      </span>
                    )}
                    {myStatus === 'ACCEPTED' && (
                      <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded-full">
                        {myRole === 'LEADER' ? '★ Líder' : myRole === 'UPLOADER' ? 'Uploader' : 'Viewer'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="text-white font-bold">{joint.title}</h3>
                    <p className="text-zinc-500 text-xs">/joint/manga/{joint.slug}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(joint.members || []).map((m: any) => (
                      <div key={m.organization.id} title={m.organization.name} className="w-6 h-6 rounded-full overflow-hidden bg-zinc-700">
                        {m.organization.logoUrl && <img src={m.organization.logoUrl} alt="" className="w-full h-full object-cover" />}
                      </div>
                    ))}
                  </div>
                  {myStatus === 'INVITED' ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRespond(joint.slug, true)}
                        className="flex-1 bg-green-500 hover:bg-green-400 text-black font-bold py-2 rounded-xl text-xs"
                      >
                        Aceptar
                      </button>
                      <button
                        onClick={() => handleRespond(joint.slug, false)}
                        className="flex-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 font-bold py-2 rounded-xl text-xs"
                      >
                        Rechazar
                      </button>
                    </div>
                  ) : (
                    <a
                      href={`/${organization.slug}/admin/joints/${joint.slug}`}
                      className="block w-full text-center bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 rounded-xl text-xs transition-colors"
                    >
                      Gestionar
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminJointGrid;
```

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AdminJointGrid.tsx src/components/admin/AdminSidebar.tsx src/components/admin/AdminNavbar.tsx src/pages/
git commit -m "feat(joint): add admin joints list page with create/invite response"
```

---

## Task 16: Frontend — Admin joint detail page

**Files:**
- Create: `src/pages/[slug]/admin/joints/[jointSlug].astro`
- Create: `src/pages/red/[slug]/admin/joints/[jointSlug].astro`
- Create: `src/components/admin/AdminJointDetail.tsx`

- [ ] **Step 1: Create `src/pages/[slug]/admin/joints/[jointSlug].astro`**

```astro
---
import AdminLayout from '../../../../../layouts/AdminLayout.astro';
import AdminJointDetail from '../../../../../components/admin/AdminJointDetail';

const { slug, jointSlug } = Astro.params;
const { organization, user, token, logged, callAPI } = Astro.locals;

if (!logged) return Astro.redirect(`/${slug}/login`);

let joint = null;
try {
  joint = await callAPI(`/api/joint/${jointSlug}/admin`);
} catch (e) {
  return Astro.redirect(`/${slug}/admin/joints`);
}
---

<AdminLayout title={`Joint: ${joint?.title}`} organization={organization} user={user}>
  <AdminJointDetail
    client:load
    joint={joint}
    organization={organization}
    user={user}
  />
</AdminLayout>
```

- [ ] **Step 2: Same for `src/pages/red/[slug]/admin/joints/[jointSlug].astro`**

- [ ] **Step 3: Create `src/components/admin/AdminJointDetail.tsx`**

This component has multiple sections depending on the caller's role:

```typescript
import React, { useState, useEffect } from 'react';
import { callAPI } from '@/util/callApi';
import { Users, Plus, Trash2, ArrowRight, Shield, Upload } from 'lucide-react';
import { toast } from 'react-toastify';

interface AdminJointDetailProps {
  joint: any;
  organization: any;
  user?: any;
}

const AdminJointDetail: React.FC<AdminJointDetailProps> = ({ joint: initialJoint, organization }) => {
  const [joint, setJoint] = useState(initialJoint);
  const [activeTab, setActiveTab] = useState<'info' | 'members' | 'chapters'>('info');
  const [inviteSlug, setInviteSlug] = useState('');
  const [inviteRole, setInviteRole] = useState<'UPLOADER' | 'VIEWER'>('UPLOADER');
  const [inviting, setInviting] = useState(false);

  const myMember = joint.members?.find((m: any) => m.organization.id === organization.id);
  const isLeader = myMember?.role === 'LEADER';
  const canEditJoint = isLeader || myMember?.canEditJoint;
  const canUpload = isLeader || myMember?.role === 'UPLOADER';

  const reload = async () => {
    try {
      const data = await callAPI(`/api/joint/${joint.slug}/admin`);
      if (data) setJoint(data);
    } catch (e) {}
  };

  const handleInvite = async () => {
    if (!inviteSlug.trim()) return;
    setInviting(true);
    try {
      await callAPI(`/api/joint/${joint.slug}/invite`, {
        method: 'POST',
        body: JSON.stringify({ organizationSlug: inviteSlug.trim(), role: inviteRole }),
      });
      toast.success('Invitación enviada');
      setInviteSlug('');
      reload();
    } catch (e: any) {
      toast.error(e?.message || 'Error al invitar');
    } finally {
      setInviting(false);
    }
  };

  const handleExpel = async (orgSlug: string) => {
    if (!confirm('¿Expulsar a este scan del joint?')) return;
    try {
      await callAPI(`/api/joint/${joint.slug}/member/${orgSlug}`, { method: 'DELETE' });
      toast.success('Miembro expulsado');
      reload();
    } catch (e: any) {
      toast.error(e?.message || 'Error al expulsar');
    }
  };

  const handleTransfer = async (orgSlug: string) => {
    if (!confirm(`¿Transferir el liderazgo a ${orgSlug}? Tú pasarás a ser UPLOADER.`)) return;
    try {
      await callAPI(`/api/joint/${joint.slug}/transfer`, {
        method: 'PATCH',
        body: JSON.stringify({ organizationSlug: orgSlug }),
      });
      toast.success('Liderazgo transferido');
      reload();
    } catch (e: any) {
      toast.error(e?.message || 'Error al transferir');
    }
  };

  const handleDissolve = async () => {
    if (!confirm('¿Disolver el joint? Esto eliminará todos los capítulos del joint.')) return;
    try {
      await callAPI(`/api/joint/${joint.slug}`, { method: 'DELETE' });
      toast.success('Joint disuelto');
      window.location.href = `/${organization.slug}/admin/joints`;
    } catch (e: any) {
      toast.error(e?.message || 'Error al disolver');
    }
  };

  const handleDeleteChapter = async (number: number) => {
    if (!confirm(`¿Eliminar el capítulo ${number}?`)) return;
    try {
      await callAPI(`/api/joint/${joint.slug}/chapter/${number}`, { method: 'DELETE' });
      toast.success('Capítulo eliminado');
      reload();
    } catch (e: any) {
      toast.error(e?.message || 'Error al eliminar');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <a href={`/${organization.slug}/admin/joints`} className="text-zinc-500 hover:text-white text-sm">Joints</a>
            <span className="text-zinc-600">/</span>
            <span className="text-white text-sm font-bold">{joint.title}</span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Users size={24} /> {joint.title}
          </h1>
          <a href={`/joint/manga/${joint.slug}`} className="text-cyan-500 text-xs hover:underline">
            Ver página pública →
          </a>
        </div>
        {isLeader && (
          <button
            onClick={handleDissolve}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold py-2 px-4 rounded-xl text-sm flex items-center gap-2"
          >
            <Trash2 size={14} /> Disolver joint
          </button>
        )}
      </div>

      {/* My role badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-zinc-500 uppercase">Tu rol:</span>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
          isLeader ? 'bg-yellow-500/20 text-yellow-400' :
          myMember?.role === 'UPLOADER' ? 'bg-blue-500/20 text-blue-400' :
          'bg-zinc-700 text-zinc-400'
        }`}>
          {isLeader ? '★ Líder' : myMember?.role === 'UPLOADER' ? 'Uploader' : 'Viewer'}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        {(['info', 'members', 'chapters'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-bold capitalize transition-colors ${
              activeTab === tab
                ? 'text-white border-b-2 border-cyan-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab === 'info' ? 'Información' : tab === 'members' ? 'Miembros' : 'Capítulos'}
          </button>
        ))}
      </div>

      {/* Info Tab */}
      {activeTab === 'info' && (
        <div className="bg-zinc-900 rounded-2xl p-6 space-y-4">
          <p className="text-zinc-400 text-sm">
            {canEditJoint
              ? 'Puedes editar la información del joint.'
              : 'Solo el líder puede editar la información.'}
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-zinc-500 text-xs uppercase font-bold mb-1">Título</p>
              <p className="text-white">{joint.title}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs uppercase font-bold mb-1">Estado</p>
              <p className="text-white capitalize">{joint.status}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs uppercase font-bold mb-1">Manga base</p>
              <p className="text-white">{joint.manga?.title}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs uppercase font-bold mb-1">Slug</p>
              <p className="text-zinc-400 font-mono text-xs">{joint.slug}</p>
            </div>
          </div>
          {canEditJoint && (
            <a
              href={`/${organization.slug}/admin/joints/${joint.slug}/edit`}
              className="inline-block bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2 px-4 rounded-xl text-sm"
            >
              Editar información
            </a>
          )}
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {/* Invite form (leader or canInvite) */}
          {(isLeader || myMember?.canInvite) && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Plus size={16} /> Invitar scan
              </h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={inviteSlug}
                  onChange={e => setInviteSlug(e.target.value)}
                  placeholder="Slug del scan (ej: senshimanga)"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-cyan-500"
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as 'UPLOADER' | 'VIEWER')}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm outline-none"
                >
                  <option value="UPLOADER">Uploader</option>
                  <option value="VIEWER">Viewer</option>
                </select>
                <button
                  onClick={handleInvite}
                  disabled={inviting}
                  className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2 px-4 rounded-xl text-sm disabled:opacity-50"
                >
                  {inviting ? '...' : 'Invitar'}
                </button>
              </div>
            </div>
          )}

          {/* Members list */}
          <div className="space-y-2">
            {joint.members?.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  {m.organization.logoUrl && (
                    <img src={m.organization.logoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                  )}
                  <div>
                    <p className="text-white font-bold text-sm">{m.organization.name}</p>
                    <p className="text-zinc-500 text-xs">{m.organization.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    m.role === 'LEADER' ? 'bg-yellow-500/20 text-yellow-400' :
                    m.role === 'UPLOADER' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-zinc-700 text-zinc-400'
                  }`}>
                    {m.role}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    m.status === 'ACCEPTED' ? 'bg-green-500/10 text-green-400' :
                    m.status === 'INVITED' ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>
                    {m.status}
                  </span>
                  {isLeader && m.organization.id !== organization.id && m.role !== 'LEADER' && m.status === 'ACCEPTED' && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleTransfer(m.organization.slug)}
                        title="Transferir liderazgo"
                        className="text-yellow-400 hover:text-yellow-300 p-1"
                      >
                        <ArrowRight size={14} />
                      </button>
                      <button
                        onClick={() => handleExpel(m.organization.slug)}
                        title="Expulsar"
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chapters Tab */}
      {activeTab === 'chapters' && (
        <div className="space-y-4">
          {canUpload && (
            <a
              href={`/${organization.slug}/admin/joints/${joint.slug}/chapter/create`}
              className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2 px-4 rounded-xl text-sm"
            >
              <Upload size={14} /> Subir capítulo
            </a>
          )}
          <div className="space-y-2">
            {joint.chapters?.length === 0 ? (
              <p className="text-zinc-500">No hay capítulos aún.</p>
            ) : (
              joint.chapters?.map((ch: any) => {
                const isMine = ch.uploadedByOrganization?.id === organization.id;
                const canDelete = isMine || canEditJoint;
                return (
                  <div key={ch.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-white font-bold text-sm">Cap. {ch.number}</span>
                      {ch.title && <span className="text-zinc-400 text-sm">{ch.title}</span>}
                      <div className="flex gap-1">
                        {ch.workedByOrganizations?.map((org: any) => (
                          <img key={org.id} src={org.logoUrl || ''} alt={org.name} title={org.name}
                            className="w-5 h-5 rounded-full object-cover bg-zinc-700"
                            onError={(e: any) => { e.target.style.display = 'none'; }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 text-xs">
                        {ch.releasedAt ? new Date(ch.releasedAt).toLocaleDateString('es') : '—'}
                      </span>
                      {isMine && (
                        <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">Tuyo</span>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteChapter(ch.number)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminJointDetail;
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AdminJointDetail.tsx src/pages/
git commit -m "feat(joint): add admin joint detail page with members and chapters management"
```

---

## Edge Cases Summary

These are handled in the controllers and should be verified manually:

| Case | Handled In |
|------|-----------|
| Manga already has an active joint | `createJoint` — throws error |
| Slug collision | `generateJointSlug` — appends -b, -c, -d, -e, -f |
| Inviting same org twice | `inviteToJoint` — checks existing, re-invites if REJECTED/EXPELLED |
| Expelling leader | `expelFromJoint` — throws error, must transfer first |
| Leader tries to transfer to non-member | `transferJointLeadership` — throws error |
| Chapter number already exists in joint | `createJointChapter` — throws error |
| Non-uploader tries to upload | `createJointChapter` — checks role |
| Editing chapter you didn't upload | `editJointChapter` — must have canEditJoint |
| Dissolve joint soft-deletes all chapters | `deleteJoint` — updateMany |
| Expelling a member doesn't delete their chapters | By design — chapters keep `uploadedByOrganizationId` |
| workedByOrganizationIds must be valid members | `createJointChapter` / `editJointChapter` — filter against acceptedMemberIds |
| Leader transfer resets extra permissions | `transferJointLeadership` — sets canEditJoint/canInvite/canExpel to false |

---

## Commit Checklist

- [ ] Task 1: Schema migration
- [ ] Task 2: Type definitions
- [ ] Task 3: joint-auth helper
- [ ] Task 4: createJoint controller
- [ ] Task 5: getJoint controller
- [ ] Task 6: editJoint controller
- [ ] Task 7: delete/list/invite/respond/expel/transfer/permissions controllers
- [ ] Task 8: chapter controllers
- [ ] Task 9: joint routes + router registration
- [ ] Task 10: manga-custom get returns jointSlug
- [ ] Task 11: 'joint' added to reserved routes
- [ ] Task 12: redirect from org pages to joint
- [ ] Task 13: public joint manga page
- [ ] Task 14: joint chapter reader
- [ ] Task 15: admin joints list
- [ ] Task 16: admin joint detail
