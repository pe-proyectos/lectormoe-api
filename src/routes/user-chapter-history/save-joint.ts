import { Elysia, t } from 'elysia';
import { saveJointUserChapterHistory } from '../../controllers/user-chapter-history/save-joint';
import { checkAndUnlockAchievements } from '../../controllers/user/achievements';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
  .use(loggedUserOnly())
  .post(
    '/api/user-chapter-history/joint/:slug/chapter/:chapterNumber/pages/:pageNumber',
    async ({ user, params: { slug, chapterNumber, pageNumber } }) => {
      const saved = await saveJointUserChapterHistory(user.id, slug, chapterNumber, pageNumber);

      if (!saved) {
        return { status: false, error: 'NOT_FOUND', message: 'No se encontró el recurso.' };
      }

      const hour = new Date().getUTCHours();
      checkAndUnlockAchievements(user.id, { action: 'read', hour }).catch(() => {});

      return { status: true, data: true };
    },
    {
      params: t.Object({
        slug: t.String(),
        chapterNumber: t.Number(),
        pageNumber: t.Number(),
      }),
      response: t.Object({ status: t.Boolean(), data: t.Any() }),
      transform({ params }) {
        params.chapterNumber = Number.parseFloat(params.chapterNumber.toString());
        params.pageNumber = Number.parseFloat(params.pageNumber.toString());
      },
    }
  );
