# Marcadores por Página (Page Bookmarks) — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** Users can bookmark specific pages (not chapters). Free users: 5 bookmarks max. Subscribed users: unlimited. Bookmarks appear on user profile, are orderable, and clicking them navigates to the exact page in the reader (`?page=N`).

**Architecture:** New `UserPageBookmark` Prisma model. Backend CRUD following the UserList pattern (same limit enforcement, same reorder pattern). Frontend: bookmark toggle button in the reader (per page), bookmark list section on the profile page.

**Tech Stack:** Prisma, Elysia; React/Tailwind

**FREE_BOOKMARK_LIMIT = 5** (matches the spirit of Mi Lista's FREE_LIST_LIMIT=50 but much smaller since these are granular)

---

### Task 1: Schema — add UserPageBookmark model

**Files:**
- Modify: `lectormoe-api/prisma/schema.prisma`

- [ ] **Step 1: Add model and relations**

After the `UserList` model (~line 531), add:
```prisma
model UserPageBookmark {
  id         Int      @id @default(autoincrement())
  userId     Int
  chapterId  Int
  pageNumber Int
  note       String?  @db.VarChar(256)
  order      Int      @default(0)
  createdAt  DateTime @default(now()) @db.Timestamp(6)
  updatedAt  DateTime @updatedAt
  user       User     @relation(fields: [userId], references: [id])
  chapter    Chapter  @relation(fields: [chapterId], references: [id])

  @@unique([userId, chapterId, pageNumber])
  @@index([userId, order])
  @@map("user_page_bookmark")
}
```

Add the relation to the `User` model (find `userList UserList[]` and add below it):
```prisma
pageBookmarks UserPageBookmark[]
```

Add the relation to the `Chapter` model (find `userHistory UserChapterHistory[]` and add):
```prisma
pageBookmarks UserPageBookmark[]
```

- [ ] **Step 2: Run migration**
```bash
cd lectormoe-api
bunx prisma migrate dev --name add_user_page_bookmark
```

- [ ] **Step 3: Commit**
```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add UserPageBookmark model"
```

---

### Task 2: Backend CRUD controllers

**Files:**
- Create: `lectormoe-api/src/controllers/user-page-bookmark/save.ts`
- Create: `lectormoe-api/src/controllers/user-page-bookmark/list.ts`
- Create: `lectormoe-api/src/controllers/user-page-bookmark/delete.ts`
- Create: `lectormoe-api/src/controllers/user-page-bookmark/reorder.ts`

- [ ] **Step 1: Create save.ts (create or toggle bookmark)**

`lectormoe-api/src/controllers/user-page-bookmark/save.ts`:
```ts
import { prisma } from '../../models/prisma';

const FREE_BOOKMARK_LIMIT = 5;

async function enforceLimit(userId: number) {
  const hasSub = await prisma.subscription.findFirst({
    where: { userId, active: true },
    select: { id: true },
  });
  if (!hasSub) {
    const count = await prisma.userPageBookmark.count({ where: { userId } });
    if (count >= FREE_BOOKMARK_LIMIT) {
      throw new Error(`Límite de ${FREE_BOOKMARK_LIMIT} marcadores alcanzado. Suscríbete para marcadores ilimitados.`);
    }
  }
}

export const savePageBookmark = async (userId: number, chapterId: number, pageNumber: number, note?: string) => {
  // Toggle: if already exists, delete it
  const existing = await prisma.userPageBookmark.findUnique({
    where: { userId_chapterId_pageNumber: { userId, chapterId, pageNumber } },
  });

  if (existing) {
    await prisma.userPageBookmark.delete({ where: { id: existing.id } });
    return { action: 'removed', id: existing.id };
  }

  await enforceLimit(userId);

  // Get current max order for this user
  const maxOrder = await prisma.userPageBookmark.aggregate({
    where: { userId },
    _max: { order: true },
  });

  const bookmark = await prisma.userPageBookmark.create({
    data: {
      userId,
      chapterId,
      pageNumber,
      note,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  return { action: 'added', bookmark };
};
```

- [ ] **Step 2: Create list.ts**

`lectormoe-api/src/controllers/user-page-bookmark/list.ts`:
```ts
import { prisma } from '../../models/prisma';

export const listPageBookmarks = async (userId: number) => {
  const bookmarks = await prisma.userPageBookmark.findMany({
    where: { userId },
    orderBy: { order: 'asc' },
    include: {
      chapter: {
        select: {
          id: true,
          number: true,
          title: true,
          imageUrl: true,
          mangaCustomId: true,
          jointId: true,
          mangaCustom: {
            select: {
              id: true,
              title: true,
              imageUrl: true,
              organization: { select: { slug: true } },
              manga: { select: { slug: true } },
            },
          },
          joint: {
            select: {
              id: true,
              slug: true,
              title: true,
              imageUrl: true,
            },
          },
        },
      },
    },
  });

  return bookmarks;
};
```

- [ ] **Step 3: Create delete.ts**

`lectormoe-api/src/controllers/user-page-bookmark/delete.ts`:
```ts
import { prisma } from '../../models/prisma';

export const deletePageBookmark = async (userId: number, bookmarkId: number) => {
  const bookmark = await prisma.userPageBookmark.findFirst({
    where: { id: bookmarkId, userId },
  });
  if (!bookmark) throw new Error('Marcador no encontrado');
  await prisma.userPageBookmark.delete({ where: { id: bookmarkId } });
  return true;
};
```

- [ ] **Step 4: Create reorder.ts (same pattern as user-list/reorder.ts)**

Read `lectormoe-api/src/controllers/user-list/reorder.ts` and follow its pattern for `reorderPageBookmarks`.

`lectormoe-api/src/controllers/user-page-bookmark/reorder.ts`:
```ts
import { prisma } from '../../models/prisma';

export const reorderPageBookmarks = async (userId: number, orderedIds: number[]) => {
  await Promise.all(
    orderedIds.map((id, index) =>
      prisma.userPageBookmark.updateMany({
        where: { id, userId },
        data: { order: index },
      })
    )
  );
  return true;
};
```

- [ ] **Step 5: Commit**
```bash
git add lectormoe-api/src/controllers/user-page-bookmark/
git commit -m "feat(bookmarks): CRUD controllers for page bookmarks"
```

---

### Task 3: Backend routes

**Files:**
- Create: `lectormoe-api/src/routes/user-page-bookmark/index.ts`
- Modify: `lectormoe-api/src/routes/router.ts`

- [ ] **Step 1: Create the routes file**

`lectormoe-api/src/routes/user-page-bookmark/index.ts`:
```ts
import { Elysia, t } from 'elysia';
import { logged } from '../../plugins/auth';
import { savePageBookmark } from '../../controllers/user-page-bookmark/save';
import { listPageBookmarks } from '../../controllers/user-page-bookmark/list';
import { deletePageBookmark } from '../../controllers/user-page-bookmark/delete';
import { reorderPageBookmarks } from '../../controllers/user-page-bookmark/reorder';

export const router = () =>
  new Elysia()
    .use(logged())
    // Toggle bookmark for a page
    .post(
      '/api/bookmarks',
      async ({ body, userId }) => {
        const result = await savePageBookmark(userId, body.chapterId, body.pageNumber, body.note);
        return { status: true, data: result };
      },
      {
        body: t.Object({
          chapterId: t.Number(),
          pageNumber: t.Number(),
          note: t.Optional(t.String()),
        }),
      }
    )
    // List all bookmarks for logged user
    .get('/api/bookmarks', async ({ userId }) => {
      const data = await listPageBookmarks(userId);
      return { status: true, data };
    })
    // Delete a bookmark by id
    .delete(
      '/api/bookmarks/:id',
      async ({ params, userId }) => {
        await deletePageBookmark(userId, parseInt(params.id));
        return { status: true };
      },
      { params: t.Object({ id: t.String() }) }
    )
    // Reorder bookmarks
    .patch(
      '/api/bookmarks/reorder',
      async ({ body, userId }) => {
        await reorderPageBookmarks(userId, body.ids);
        return { status: true };
      },
      { body: t.Object({ ids: t.Array(t.Number()) }) }
    );
```

- [ ] **Step 2: Register in router.ts**
```ts
import { router as userPageBookmarkRouter } from './user-page-bookmark/index';
app.use(userPageBookmarkRouter());
```

- [ ] **Step 3: Commit**
```bash
git add lectormoe-api/src/routes/user-page-bookmark/
git add lectormoe-api/src/routes/router.ts
git commit -m "feat(api): page bookmarks endpoints POST/GET/DELETE/PATCH /api/bookmarks"
```

---

### Task 4: Frontend — Bookmark button in reader

**Files:**
- Modify: `lectormoe-frontend/src/components/Reader.jsx`

The reader needs a bookmark button visible on the current page. In paginated mode it appears fixed/floating near the top-right of the page area. In cascade mode it appears per-page (scrollable).

Strategy: show a `🔖` icon button fixed at the bottom-right of the screen in paginated mode. In cascade mode, show it on each page container as a floating overlay.

For simplicity, implement a single floating button that bookmarks the current page (in both modes).

- [ ] **Step 1: Add bookmark state to Reader**

After the existing state declarations (~line 154), add:
```js
const [bookmarks, setBookmarks] = useState(new Set()); // Set of pageNumbers
const [bookmarkLoading, setBookmarkLoading] = useState(false);
const [bookmarkError, setBookmarkError] = useState(null);
```

- [ ] **Step 2: Load existing bookmarks when chapter loads**

In the useEffect that loads chapter pages (after `setLoading(false)` on success), add:
```js
// Load bookmarks for this chapter
if (logged) {
  callAPI('/api/bookmarks')
    .then((data) => {
      const thisChapterBookmarks = data
        .filter((b) => b.chapter?.id === result[0]?.chapterId || /* need chapterId */
          b.chapter?.number === parseFloat(chapterNumber) && (
            b.chapter?.mangaCustom?.manga?.slug === mangaSlug ||
            b.chapter?.joint?.slug === jointSlug
          ))
        .map((b) => b.pageNumber);
      setBookmarks(new Set(thisChapterBookmarks));
    })
    .catch(() => {});
}
```

Actually, the bookmarks API returns chapter details. We need the chapterId to filter. Since we know the chapterNumber and mangaSlug, filter by chapter.number === chapterNumber and appropriate slug.

Better: after loading pages, we have `chapterData.chapter.id` — use that. But the chapter object comes from a different API call. Check if `chapter` prop has an id.

If `chapter.id` is available in the component props/data, filter bookmarks by `b.chapter.id === chapter.id`.

- [ ] **Step 3: Add toggle handler**

```js
const handleToggleBookmark = useCallback(async () => {
  if (!logged || bookmarkLoading || !chapter) return;
  setBookmarkLoading(true);
  setBookmarkError(null);
  try {
    const result = await callAPI('/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ chapterId: chapter.id, pageNumber: currentPage }),
    });
    if (result.action === 'added') {
      setBookmarks((prev) => new Set([...prev, currentPage]));
    } else {
      setBookmarks((prev) => {
        const next = new Set(prev);
        next.delete(currentPage);
        return next;
      });
    }
  } catch (err) {
    setBookmarkError(err?.message || 'Error al guardar marcador');
    setTimeout(() => setBookmarkError(null), 3000);
  } finally {
    setBookmarkLoading(false);
  }
}, [logged, bookmarkLoading, chapter, currentPage]);
```

- [ ] **Step 4: Add the bookmark button UI in the reader header**

In the reader header area (around line 925-950 where the AdjustmentsHorizontalIcon button lives), add a bookmark button next to the settings icon:

```jsx
{logged && chapter && (
  <button
    onClick={handleToggleBookmark}
    disabled={bookmarkLoading}
    title={bookmarks.has(currentPage) ? 'Quitar marcador' : 'Marcar esta página'}
    className={`relative p-1 rounded-lg transition-all ${
      bookmarks.has(currentPage)
        ? 'text-yellow-400 hover:text-yellow-300'
        : 'text-zinc-400 hover:text-white'
    } ${bookmarkLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    <svg className="h-6 w-6 sm:h-7 sm:w-7" fill={bookmarks.has(currentPage) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  </button>
)}
{bookmarkError && (
  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-red-400 bg-zinc-900 px-2 py-1 rounded z-50">
    {bookmarkError}
  </span>
)}
```

- [ ] **Step 5: Show page number indicator when bookmarked (cascade mode)**

In cascade mode, add a small bookmark icon overlay on each page when it's bookmarked. In `getPageContainerClassName` or as a wrapper in `SinglePageContainer`, overlay the icon when `bookmarks.has(page.number)`.

This requires passing `bookmarks` through to `SinglePageContainer`. Add a `isBookmarked` boolean prop and render the indicator:
```jsx
{isBookmarked && (
  <div className="absolute top-2 right-2 z-10 text-yellow-400 opacity-80">
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  </div>
)}
```

The `SinglePageContainer` container div needs `relative` class for the `absolute` positioning to work. Add it if not present.

- [ ] **Step 6: Commit**
```bash
git add lectormoe-frontend/src/components/Reader.jsx
git commit -m "feat(reader): page bookmark toggle button with filled/empty state"
```

---

### Task 5: Frontend — Bookmarks section on profile page

**Files:**
- Read first: `lectormoe-frontend/src/components/landing/ProfilePageNew.tsx` (1700 lines — read the structure around the UserList and Favorites sections to follow the same collapsible pattern)
- Modify: `lectormoe-frontend/src/components/landing/ProfilePageNew.tsx`

- [ ] **Step 1: Read ProfilePageNew.tsx** — find where Mi Lista and Favorites sections are (search for `openUserList` or `openFavorites`). Note the collapsible section pattern.

- [ ] **Step 2: Add bookmarks state**

After the existing `openUserList` state, add:
```tsx
const [openBookmarks, setOpenBookmarks] = useState(false);
const [bookmarks, setBookmarks] = useState<any[]>([]);
const [bookmarksLoading, setBookmarksLoading] = useState(false);
```

Load bookmarks when the section is opened (only if viewing own profile):
```tsx
useEffect(() => {
  if (!openBookmarks || !isOwnProfile) return;
  setBookmarksLoading(true);
  callAPI('/api/bookmarks')
    .then((data) => { setBookmarks(data || []); setBookmarksLoading(false); })
    .catch(() => setBookmarksLoading(false));
}, [openBookmarks, isOwnProfile]);
```

- [ ] **Step 3: Add the bookmarks section UI**

After the Mi Lista section, add a new collapsible:
```tsx
{isOwnProfile && (
  <div className="border border-zinc-800 rounded-xl overflow-hidden">
    <button
      onClick={() => setOpenBookmarks((v) => !v)}
      className="w-full flex items-center justify-between px-5 py-4 bg-zinc-900 hover:bg-zinc-800/80 transition-colors"
    >
      <div className="flex items-center gap-3">
        <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        <span className="font-bold text-white">Marcadores</span>
        <span className="text-xs text-zinc-500">({bookmarks.length})</span>
      </div>
      <svg className={`h-5 w-5 text-zinc-400 transition-transform ${openBookmarks ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    {openBookmarks && (
      <div className="p-4 bg-zinc-950">
        {bookmarksLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-400" />
          </div>
        ) : bookmarks.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-8">No tienes marcadores aún. Márcalos mientras lees usando el ícono 🔖 en el lector.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {bookmarks.map((bk) => {
              const mc = bk.chapter?.mangaCustom;
              const joint = bk.chapter?.joint;
              const title = mc?.title || joint?.title || 'Manga';
              const cover = mc?.imageUrl || joint?.imageUrl;
              const orgSlug = mc?.organization?.slug;
              const mangaSlug = mc?.manga?.slug;
              const chapterNum = bk.chapter?.number;
              const pageNum = bk.pageNumber;

              const url = joint
                ? `/joint/manga/${joint.slug}/chapters/${chapterNum}?page=${pageNum}`
                : `/${orgSlug}/manga/${mangaSlug}/chapters/${chapterNum}?page=${pageNum}`;

              return (
                <a
                  key={bk.id}
                  href={url}
                  className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-yellow-500/40 rounded-lg px-3 py-2.5 transition-all group"
                >
                  {cover && (
                    <img src={cover} alt={title} className="w-9 h-12 object-cover rounded flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-semibold truncate">{title}</p>
                    <p className="text-zinc-400 text-xs mt-0.5">Cap. {chapterNum} · Página {pageNum}</p>
                  </div>
                  <svg className="h-4 w-4 text-zinc-600 group-hover:text-yellow-400 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              );
            })}
          </div>
        )}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Commit**
```bash
git add lectormoe-frontend/src/components/landing/ProfilePageNew.tsx
git commit -m "feat(profile): page bookmarks section with clickable entries"
```
