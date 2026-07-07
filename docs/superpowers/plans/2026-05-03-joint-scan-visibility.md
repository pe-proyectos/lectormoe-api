# Joint Chapters Visible in All Member Scans — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** When a chapter is uploaded to a joint, it automatically appears in the "latest updates", featured, and scan-level manga lists of ALL ACCEPTED member organizations — as if it were their own chapter. Also, the individual manga page on each scan should show joint chapters in the chapter list.

**Architecture:**
1. When a joint chapter is created, update `lastChapterAt` on every ACCEPTED member org's `MangaCustom` for that manga. This makes the manga float to the top of "últimas actualizaciones" in all member scans.
2. The manga card chapter previews (top-2) already use `mergeJointChaptersIntoMangaCustoms` in `list.ts` — this is already correct.
3. The full chapter list for a manga on a scan page needs to include joint chapters. Find and update that endpoint.

**Tech Stack:** Prisma, Elysia (API only — this is a backend change)

---

### Task 1: Update lastChapterAt on member scans when joint chapter is created

**Files:**
- Read first: `lectormoe-api/src/routes/joint/index.ts` — find the joint chapter create route
- Modify: whichever controller handles joint chapter creation

- [ ] **Step 1: Read the joint chapter creation route/controller**

Read `lectormoe-api/src/routes/joint/index.ts`. Find the route that creates a joint chapter (likely `POST /api/joint/:slug/chapters` or similar). Find the controller it calls.

- [ ] **Step 2: After creating a joint chapter, update lastChapterAt on all ACCEPTED members' MangaCustom**

In the joint chapter create controller, after the chapter is created and `joint.lastChapterAt` is updated, add:

```ts
// Update lastChapterAt on all ACCEPTED member orgs' MangaCustom for this manga
// so the manga appears in their "latest updates" lists
const acceptedMembers = await prisma.mangaJointMember.findMany({
  where: { jointId: joint.id, status: 'ACCEPTED' },
  select: { organizationId: true },
});

if (acceptedMembers.length > 0) {
  const orgIds = acceptedMembers.map((m) => m.organizationId);
  const chapterDate = chapter.releasedAt ?? chapter.createdAt ?? new Date();

  await prisma.mangaCustom.updateMany({
    where: {
      mangaId: joint.mangaId,
      organizationId: { in: orgIds },
      deletedAt: null,
    },
    data: { lastChapterAt: chapterDate },
  });
}
```

- [ ] **Step 3: Commit**
```bash
git add lectormoe-api/src/
git commit -m "feat(joint): update lastChapterAt on member scans when joint chapter created"
```

---

### Task 2: Include joint chapters in the manga's chapter list on a scan page

When a user visits `/senshimanga/manga/some-manga`, the chapter list should include chapters uploaded to any active joint for that manga (where senshimanga is an ACCEPTED member).

**Files:**
- Read first: `lectormoe-api/src/routes/chapter/get.ts` — this handles chapter listing for a manga
- Modify: the controller called by the chapter get route

- [ ] **Step 1: Read `src/routes/chapter/get.ts`** to find how the chapter list is fetched

Look for the endpoint that returns all chapters for a manga (`GET /api/manga-custom/:mangaSlug/chapters` or similar). Find the controller.

- [ ] **Step 2: After fetching per-org chapters, merge in joint chapters**

In the chapter list controller, after fetching the org's chapters for the manga, add logic to also fetch joint chapters:

```ts
// Find any active joint where this org is an ACCEPTED member for the same manga
const joint = await prisma.mangaJoint.findFirst({
  where: {
    mangaId: mangaCustom.mangaId,
    deletedAt: null,
    members: {
      some: { organizationId: mangaCustom.organizationId, status: 'ACCEPTED' },
    },
  },
  select: { id: true },
});

let jointChapters: any[] = [];
if (joint) {
  jointChapters = await prisma.chapter.findMany({
    where: {
      jointId: joint.id,
      deletedAt: null,
      ...(hideUnreleased ? {
        isUnreleased: false,
        OR: [{ releasedAt: null }, { releasedAt: { lte: new Date() } }],
      } : {}),
    },
    select: {
      id: true, number: true, title: true, releasedAt: true,
      isUnreleased: true, imageUrl: true, views: true, createdAt: true,
    },
    orderBy: { number: 'desc' },
  });
}

// Merge: deduplicate by chapter number, keep most recent releasedAt
if (jointChapters.length > 0) {
  const merged = new Map<number, any>();
  for (const c of [...chapters, ...jointChapters]) {
    const prev = merged.get(c.number);
    if (!prev) { merged.set(c.number, c); continue; }
    const prevTs = prev.releasedAt ? new Date(prev.releasedAt).getTime() : 0;
    const cTs = c.releasedAt ? new Date(c.releasedAt).getTime() : 0;
    if (cTs > prevTs) merged.set(c.number, c);
  }
  chapters = [...merged.values()].sort((a, b) => b.number - a.number);
}
```

- [ ] **Step 3: Commit**
```bash
git add lectormoe-api/src/
git commit -m "feat(chapters): include joint chapters in scan manga chapter list"
```

---

### Task 3: Ensure joint lastChapterAt updates when a member uploads a solo chapter

Currently when a solo chapter is uploaded by a member org, the joint's `lastChapterAt` may not update. But more importantly, the reverse: when a joint chapter is uploaded, we now update member `MangaCustom.lastChapterAt` (Task 1). Verify also that the joint's own `lastChapterAt` is already being updated — if not, add it.

**Files:**
- Read: `lectormoe-api/src/controllers/chapter/create.ts` — the existing create chapter controller

- [ ] **Step 1: Read create.ts** and check if it updates the joint's `lastChapterAt` when a chapter with `jointId` is created.

Look for `MangaJoint.update` or `lastChapterAt` after chapter creation. If it's NOT there, add:

```ts
// If this is a joint chapter, update joint.lastChapterAt
if (chapter.jointId) {
  await prisma.mangaJoint.update({
    where: { id: chapter.jointId },
    data: { lastChapterAt: chapter.releasedAt ?? new Date() },
  });
}
```

- [ ] **Step 2: Commit if changes were needed**
```bash
git add lectormoe-api/src/
git commit -m "feat(joint): update joint.lastChapterAt when chapter is created"
```
