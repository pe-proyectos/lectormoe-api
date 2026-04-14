import { Elysia, t } from 'elysia';
import { createViewHistoryJoint, createViewHistoryJointChapter } from '../../controllers/views/create-joint';
import { getIP } from '../../util/get-ip';

export const router = () => new Elysia()
  .post(
    '/api/views/joint/:slug',
    async ({ request, params: { slug } }) => {
      const ip = request.headers.get('ip') || getIP(request.headers) || '0.0.0.0';
      const view = await createViewHistoryJoint(slug, ip);
      if (!view) {
        return { status: false, error: 'NOT_FOUND', message: 'No se encontró el recurso.' };
      }
      return { status: true, data: true };
    },
    {
      params: t.Object({ slug: t.String() }),
      response: t.Object({ status: t.Boolean(), data: t.Any() }),
    }
  )
  .post(
    '/api/views/joint/:slug/chapter/:chapterNumber',
    async ({ request, params: { slug, chapterNumber } }) => {
      const ip = request.headers.get('ip') || getIP(request.headers) || '0.0.0.0';
      const view = await createViewHistoryJointChapter(slug, chapterNumber, ip);
      if (!view) {
        return { status: false, error: 'NOT_FOUND', message: 'No se encontró el recurso.' };
      }
      return { status: true, data: true };
    },
    {
      params: t.Object({ slug: t.String(), chapterNumber: t.Number() }),
      response: t.Object({ status: t.Boolean(), data: t.Any() }),
      transform({ params }) {
        params.chapterNumber = Number.parseFloat(params.chapterNumber.toString());
      },
    }
  );
