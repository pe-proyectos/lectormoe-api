# Continuar Leyendo (Continue Reading) — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** Show a "Continuar leyendo" section on the homepage for logged-in users — up to 5 mangas from their list where they're not caught up, each with a direct link to the next unread chapter.

**Architecture:** New backend endpoint aggregates UserList + UserChapterHistory to find the next unread chapter per manga. New frontend `ContinueReading.tsx` component renders cards. Inserted in `LandingApp.tsx` between ScansButtonsSection and Popular Today, only when `logged === true`.

**Tech Stack:** Prisma, Elysia (API); React/Tailwind (frontend)

---

### Task 1: Backend endpoint

**Files:**
- Create: `lectormoe-api/src/controllers/user/continue-reading.ts`
- Create: `lectormoe-api/src/routes/user/continue-reading.ts`
- Modify: `lectormoe-api/src/routes/router.ts` — register the new route

- [ ] **Step 1: Create the controller**

`lectormoe-api/src/controllers/user/continue-reading.ts`:
```ts
import { prisma } from '../../models/prisma';

export const getContinueReading = async (userId: number) => {
  // Get user's list entries (both mangaCustom and joint, ordered by most recently active)
  const listEntries = await prisma.userList.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 20, // scan more than 5 to find ones where user isn't caught up
    select: {
      mangaCustomId: true,
      jointId: true,
      mangaCustom: {
        select: {
          id: true,
          title: true,
          imageUrl: true,
          organization: { select: { slug: true } },
          manga: { select: { slug: true } },
          chapters: {
            where: { deletedAt: null, isUnreleased: false, OR: [{ releasedAt: null }, { releasedAt: { lte: new Date() } }] },
            orderBy: { number: 'asc' },
            select: { id: true, number: true },
          },
        },
      },
      joint: {
        select: {
          id: true,
          slug: true,
          title: true,
          imageUrl: true,
          chapters: {
            where: { deletedAt: null, isUnreleased: false, OR: [{ releasedAt: null }, { releasedAt: { lte: new Date() } }] },
            orderBy: { number: 'asc' },
            select: { id: true, number: true },
          },
        },
      },
    },
  });

  // For each entry, find the last read chapter from history
  const results = [];

  for (const entry of listEntries) {
    if (results.length >= 5) break;

    if (entry.mangaCustomId && entry.mangaCustom) {
      const mc = entry.mangaCustom;
      const chapters = mc.chapters;
      if (chapters.length === 0) continue;

      // Find last finished chapter
      const lastHistory = await prisma.userChapterHistory.findFirst({
        where: {
          userId,
          chapterId: { in: chapters.map((c) => c.id) },
          finishedAt: { not: null },
        },
        orderBy: { finishedAt: 'desc' },
        select: { chapterId: true, finishedAt: true, pageNumber: true },
      });

      let nextChapter;
      if (!lastHistory) {
        // Never started — point to first chapter
        nextChapter = chapters[0];
      } else {
        const lastChapter = chapters.find((c) => c.id === lastHistory.chapterId);
        if (!lastChapter) continue;
        // Find the chapter after the last finished one
        nextChapter = chapters.find((c) => c.number > lastChapter.number);
        if (!nextChapter) continue; // caught up
      }

      results.push({
        type: 'mangaCustom',
        mangaCustomId: mc.id,
        title: mc.title,
        imageUrl: mc.imageUrl,
        orgSlug: mc.organization.slug,
        mangaSlug: mc.manga?.slug,
        nextChapterNumber: nextChapter.number,
        nextChapterId: nextChapter.id,
        lastReadAt: lastHistory?.finishedAt ?? null,
      });
    } else if (entry.jointId && entry.joint) {
      const joint = entry.joint;
      const chapters = joint.chapters;
      if (chapters.length === 0) continue;

      const lastHistory = await prisma.userChapterHistory.findFirst({
        where: {
          userId,
          chapterId: { in: chapters.map((c) => c.id) },
          finishedAt: { not: null },
        },
        orderBy: { finishedAt: 'desc' },
        select: { chapterId: true, finishedAt: true },
      });

      let nextChapter;
      if (!lastHistory) {
        nextChapter = chapters[0];
      } else {
        const lastChapter = chapters.find((c) => c.id === lastHistory.chapterId);
        if (!lastChapter) continue;
        nextChapter = chapters.find((c) => c.number > lastChapter.number);
        if (!nextChapter) continue;
      }

      results.push({
        type: 'joint',
        jointId: joint.id,
        jointSlug: joint.slug,
        title: joint.title,
        imageUrl: joint.imageUrl,
        nextChapterNumber: nextChapter.number,
        nextChapterId: nextChapter.id,
        lastReadAt: lastHistory?.finishedAt ?? null,
      });
    }
  }

  return results;
};
```

- [ ] **Step 2: Create the route**

`lectormoe-api/src/routes/user/continue-reading.ts`:
```ts
import { Elysia } from 'elysia';
import { logged } from '../../plugins/auth';
import { getContinueReading } from '../../controllers/user/continue-reading';

export const router = () =>
  new Elysia()
    .use(logged())
    .get('/api/user/continue-reading', async ({ userId }) => {
      const data = await getContinueReading(userId);
      return { status: true, data };
    });
```

- [ ] **Step 3: Register the route**

In `lectormoe-api/src/routes/router.ts`, import and register:
```ts
import { router as userContinueReadingRouter } from './user/continue-reading';
// ... in the app.use() section:
app.use(userContinueReadingRouter());
```

- [ ] **Step 4: Verify the endpoint works**
```bash
cd lectormoe-api && bun run dev
# In another terminal, test with a logged-in user token
curl -H "Cookie: token=<token>" http://localhost:3000/api/user/continue-reading
```
Expected: `{ "status": true, "data": [...] }` with up to 5 entries.

- [ ] **Step 5: Commit**
```bash
git add lectormoe-api/src/controllers/user/continue-reading.ts
git add lectormoe-api/src/routes/user/continue-reading.ts
git add lectormoe-api/src/routes/router.ts
git commit -m "feat(api): GET /api/user/continue-reading endpoint"
```

---

### Task 2: Frontend ContinueReading component

**Files:**
- Create: `lectormoe-frontend/src/components/landing/ContinueReading.tsx`
- Modify: `lectormoe-frontend/src/components/landing/LandingApp.tsx:74-112`

- [ ] **Step 1: Create ContinueReading.tsx**

`lectormoe-frontend/src/components/landing/ContinueReading.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { callAPI } from '../../util/callApi';
import { BookOpen } from 'lucide-react';

interface ContinueReadingEntry {
  type: 'mangaCustom' | 'joint';
  title: string;
  imageUrl: string | null;
  nextChapterNumber: number;
  // mangaCustom fields
  orgSlug?: string;
  mangaSlug?: string;
  mangaCustomId?: number;
  // joint fields
  jointSlug?: string;
}

interface ContinueReadingProps {
  nsfwMode?: boolean;
}

const ContinueReading: React.FC<ContinueReadingProps> = ({ nsfwMode }) => {
  const [entries, setEntries] = useState<ContinueReadingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    callAPI('/api/user/continue-reading')
      .then((data: ContinueReadingEntry[]) => {
        setEntries(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || entries.length === 0) return null;

  const getUrl = (entry: ContinueReadingEntry) => {
    if (entry.type === 'joint') {
      return `/joint/manga/${entry.jointSlug}/chapters/${entry.nextChapterNumber}`;
    }
    return `/${entry.orgSlug}/manga/${entry.mangaSlug}/chapters/${entry.nextChapterNumber}`;
  };

  return (
    <section className="max-w-[1600px] mx-auto px-4 md:px-8 pt-8 pb-4">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen size={16} className="text-cyan-400" />
        <span className="text-cyan-400 font-bold uppercase tracking-[0.2em] text-[10px]">
          Lectura Rápida
        </span>
      </div>
      <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none mb-5">
        Continuar leyendo
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        {entries.map((entry, i) => (
          <a
            key={i}
            href={getUrl(entry)}
            className="flex-shrink-0 flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-cyan-500/40 rounded-xl px-3 py-2.5 transition-all group min-w-[220px] max-w-[280px]"
          >
            <img
              src={entry.imageUrl || '/placeholder.png'}
              alt={entry.title}
              className="w-10 h-14 object-cover rounded-lg flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate leading-tight">{entry.title}</p>
              <p className="text-cyan-400 text-xs font-bold mt-1 group-hover:text-cyan-300 transition-colors">
                Cap. {entry.nextChapterNumber} →
              </p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
};

export default ContinueReading;
```

- [ ] **Step 2: Insert into LandingApp.tsx**

In `LandingApp.tsx`, import `ContinueReading` at the top:
```tsx
import ContinueReading from './ContinueReading';
```

Insert the section after `ScansButtonsSection` and before the Popular Today section (~line 99). Only render when `logged === true`:
```tsx
{/* Continue Reading — logged-in users only */}
{logged && !isWritings && (
  <ContinueReading nsfwMode={nsfwMode} />
)}
```

- [ ] **Step 3: Commit**
```bash
git add lectormoe-frontend/src/components/landing/ContinueReading.tsx
git add lectormoe-frontend/src/components/landing/LandingApp.tsx
git commit -m "feat(homepage): Continuar leyendo section for logged-in users"
```
