import { Elysia, t } from 'elysia';
import { processUnsubscribe } from '../../services/email-preferences';

export const router = () =>
  new Elysia()
    // One-click unsubscribe (no auth, token-based)
    .get(
      '/api/email/unsubscribe',
      async ({ query, set }) => {
        const { token, category } = query;

        if (!token) {
          set.status = 400;
          return {
            status: false,
            message: 'Token requerido.',
          };
        }

        const result = await processUnsubscribe(token, category || undefined);

        if (!result.success) {
          set.status = 400;
          return {
            status: false,
            message: 'Token no valido.',
          };
        }

        return {
          status: true,
          message: category
            ? `Has cancelado las notificaciones de tipo "${category}".`
            : 'Has cancelado todas las notificaciones por email.',
          username: result.username,
        };
      },
      {
        query: t.Object({
          token: t.String(),
          category: t.Optional(t.String()),
        }),
      }
    );
