# Hide Unreleased Chapters — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** Let scan admins hide chapters scheduled for a future date (isUnreleased=true OR releasedAt > now) from public chapter lists and "latest updates" cards — for scans that don't use the subscription system.

**Architecture:** Add `hideUnreleasedChapters Boolean @default(false)` to `MangaCustom`. Filter unreleased chapters at query time in: (1) the manga chapter list endpoint, (2) the top-2 chapter preview in manga cards. Toggle exposed in admin manga edit UI.

**Tech Stack:** Prisma, Elysia (API); React/Tailwind (frontend admin)

---

### Task 1: Schema migration

**Files:**
- Modify: `lectormoe-api/prisma/schema.prisma` — `MangaCustom` model (~line 268)

- [ ] **Step 1: Add field to MangaCustom**

In the `MangaCustom` model, add after `nextChapterAtMessage`:
```prisma
hideUnreleasedChapters         Boolean            @default(false)
```

- [ ] **Step 2: Generate and run migration**
```bash
cd lectormoe-api
bunx prisma migrate dev --name add_hide_unreleased_chapters
```

Expected: migration file created, DB updated.

- [ ] **Step 3: Commit**
```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add hideUnreleasedChapters to MangaCustom"
```

---

### Task 2: Filter unreleased chapters in chapter list endpoint

**Files:**
- Read first: `lectormoe-api/src/routes/chapter/get.ts`
- Modify: `lectormoe-api/src/controllers/chapter/` (find the list/get controller)

The chapter list route returns chapters for a manga. When `mangaCustom.hideUnreleasedChapters === true`, filter out chapters where `isUnreleased === true` OR `releasedAt > now()` for unauthenticated / non-subscriber requests.

- [ ] **Step 1: Read the chapter get/list controller** to find how chapters are queried

Read `lectormoe-api/src/routes/chapter/get.ts` and the controller it calls.

- [ ] **Step 2: Add the filter**

In the chapter list query, after fetching `mangaCustom`, add:
```ts
const hideUnreleased = mangaCustom.hideUnreleasedChapters === true;
// In the where clause for chapters:
...(hideUnreleased ? {
  AND: [
    { isUnreleased: false },
    {
      OR: [
        { releasedAt: null },
        { releasedAt: { lte: new Date() } },
      ]
    }
  ]
} : {})
```

Apply this filter when the requesting user is NOT a subscriber with access (if the endpoint already has subscription logic, keep it; just add the hideUnreleased filter on top for non-subscriber users).

- [ ] **Step 3: Commit**
```bash
git add lectormoe-api/src/
git commit -m "feat(chapters): filter unreleased chapters when hideUnreleasedChapters=true"
```

---

### Task 3: Filter unreleased in manga card chapter previews

**Files:**
- Modify: `lectormoe-api/src/controllers/manga-custom/list.ts:158-170` and `328-336`

The `listMangaCustom` controller includes `chapters: { where: { deletedAt: null }, take: 2 }` in two places. When `hideUnreleasedChapters` is true, the top-2 preview should also exclude future-released chapters.

- [ ] **Step 1: Update both chapter preview queries in list.ts**

In both `chapters` include blocks (popular path ~line 158 and main path ~line 323), change:
```ts
chapters: {
  where: { deletedAt: null },
  ...
}
```
to:
```ts
chapters: {
  where: {
    deletedAt: null,
    // When hideUnreleasedChapters is true on the parent, exclude future releases.
    // We can't filter by parent field in a nested include's where clause in Prisma,
    // so we always exclude isUnreleased=true chapters that are in the future.
    // (Scans that DO use unreleased will still show them via lastChapterAt ordering)
    OR: [
      { isUnreleased: false },
      { releasedAt: { lte: new Date() } },
    ]
  },
  ...
}
```

Wait — this would affect ALL manga cards, even those where hideUnreleasedChapters=false. The correct approach is to post-process: after fetching, if `mc.hideUnreleasedChapters` is true, filter `mc.chapters` in JS.

Replace with a JS post-processing step after `mergeJointChaptersIntoMangaCustoms`:
```ts
// Filter unreleased chapter previews for mangas that opt out of showing them
const now = new Date();
for (const mc of mangasCustoms) {
  if (mc.hideUnreleasedChapters) {
    mc.chapters = mc.chapters.filter(
      (c: any) => !c.isUnreleased && (!c.releasedAt || new Date(c.releasedAt) <= now)
    );
  }
}
```

Also add `isUnreleased: true` to the chapter select fields so the filter works:
```ts
select: {
  id: true,
  number: true,
  title: true,
  releasedAt: true,
  isUnreleased: true,  // add this
  views: true,
},
```

- [ ] **Step 2: Commit**
```bash
git add lectormoe-api/src/controllers/manga-custom/list.ts
git commit -m "feat(manga-list): hide unreleased chapter previews in cards when opt-in"
```

---

### Task 4: Admin toggle in manga edit UI

**Files:**
- Read first: `lectormoe-frontend/src/components/admin/AdminMangaEdit.tsx`
- Modify: `lectormoe-frontend/src/components/admin/AdminMangaEdit.tsx`

- [ ] **Step 1: Read AdminMangaEdit.tsx** to understand the form structure and how fields like `requireLogin` or `isSimulRelease` are rendered (they'll be boolean toggles — follow the same pattern).

- [ ] **Step 2: Add the field to the form state and submit payload**

In the form initial state, add:
```ts
hideUnreleasedChapters: mangaCustom?.hideUnreleasedChapters ?? false,
```

In the submit/PATCH payload, include:
```ts
hideUnreleasedChapters: formData.hideUnreleasedChapters,
```

- [ ] **Step 3: Add the toggle UI**

After the `isSimulRelease` toggle (or wherever `requireLogin` is shown), add:
```tsx
<div className="flex items-center justify-between py-3 border-b border-zinc-800">
  <div>
    <p className="text-sm font-medium text-white">Ocultar capítulos programados</p>
    <p className="text-xs text-zinc-400 mt-0.5">Los capítulos con fecha futura no aparecen en listas públicas ni en últimas actualizaciones</p>
  </div>
  <label className="relative inline-flex items-center cursor-pointer">
    <input
      type="checkbox"
      className="sr-only peer"
      checked={formData.hideUnreleasedChapters}
      onChange={(e) => setFormData(prev => ({ ...prev, hideUnreleasedChapters: e.target.checked }))}
    />
    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
  </label>
</div>
```

- [ ] **Step 4: Ensure the API edit controller accepts and persists the field**

Read `lectormoe-api/src/controllers/manga-custom/edit.ts`. In `updateData`, add:
```ts
hideUnreleasedChapters: params.hideUnreleasedChapters,
```

Also add it to the type in `lectormoe-api/src/types/manga-custom/edit.ts`:
```ts
hideUnreleasedChapters?: boolean;
```

- [ ] **Step 5: Commit**
```bash
git add lectormoe-frontend/src/components/admin/AdminMangaEdit.tsx
git add lectormoe-api/src/controllers/manga-custom/edit.ts lectormoe-api/src/types/manga-custom/edit.ts
git commit -m "feat(admin): hide-unreleased-chapters toggle in manga edit"
```
