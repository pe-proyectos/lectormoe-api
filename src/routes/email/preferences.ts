import { Elysia, t } from 'elysia';
import { logged } from '../../plugins/auth';
import { getOrCreateEmailPreference, updateEmailPreference } from '../../services/email-preferences';

export const router = () =>
  new Elysia()
    .use(logged())
    // Get current user's email preferences
    .get(
      '/api/email/preferences',
      async ({ user, set }) => {
        if (!user) {
          set.status = 401;
          return { status: false, error: 'No autenticado.' };
        }

        const prefs = await getOrCreateEmailPreference(user.id);
        return { status: true, data: prefs };
      }
    )
    // Update email preferences (partial)
    .patch(
      '/api/email/preferences',
      async ({ user, body, set }) => {
        if (!user) {
          set.status = 401;
          return { status: false, error: 'No autenticado.' };
        }

        const updated = await updateEmailPreference(user.id, body as Record<string, boolean>);
        return { status: true, data: updated };
      },
      {
        body: t.Record(t.String(), t.Boolean()),
      }
    );
