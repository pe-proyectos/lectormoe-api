import { promoteChapterToJoint } from './promote';
import { demoteChapterFromJoint } from './demote';

export interface BulkMoveResult {
  moved: number;
  skipped: Array<{ chapterId: number; reason: string }>;
  conflicts: Array<{ chapterId: number; existingChapterId: number }>;
}

// Skip-and-report semantics: each chapter is authorized and moved independently.
// A failure on one row never blocks the rest.
export const bulkMoveJointChapters = async (
  jointSlug: string,
  callerOrgId: number,
  chapterIds: number[],
  direction: 'promote' | 'demote',
  opts: { replaceConflicts?: boolean; actorUserId?: number | null } = {},
): Promise<BulkMoveResult> => {
  const out: BulkMoveResult = { moved: 0, skipped: [], conflicts: [] };

  for (const chapterId of chapterIds) {
    try {
      if (direction === 'promote') {
        await promoteChapterToJoint(jointSlug, callerOrgId, chapterId, opts.actorUserId ?? null);
        out.moved += 1;
      } else {
        const r = await demoteChapterFromJoint(jointSlug, callerOrgId, chapterId, {
          replace: opts.replaceConflicts ?? false,
          actorUserId: opts.actorUserId ?? null,
        });
        if (r.conflict && r.existingChapterId) {
          out.conflicts.push({ chapterId, existingChapterId: r.existingChapterId });
        } else if (r.success) {
          out.moved += 1;
        }
      }
    } catch (e: any) {
      out.skipped.push({ chapterId, reason: e?.message ?? 'Error desconocido' });
    }
  }

  return out;
};
