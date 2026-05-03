import { Elysia, t } from 'elysia';
import { logged } from '../../plugins/auth';
import { savePageBookmark } from '../../controllers/user-page-bookmark/save';
import { listPageBookmarks } from '../../controllers/user-page-bookmark/list';
import { deletePageBookmark } from '../../controllers/user-page-bookmark/delete';
import { reorderPageBookmarks } from '../../controllers/user-page-bookmark/reorder';

export const router = () =>
  new Elysia()
    .use(logged())
    .post(
      '/api/bookmarks',
      async ({ body, user }) => {
        const result = await savePageBookmark(user.id, body.chapterId, body.pageNumber, body.note);
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
    .get('/api/bookmarks', async ({ user }) => {
      const data = await listPageBookmarks(user.id);
      return { status: true, data };
    })
    .delete(
      '/api/bookmarks/:id',
      async ({ params, user }) => {
        await deletePageBookmark(user.id, parseInt(params.id));
        return { status: true };
      },
      { params: t.Object({ id: t.String() }) }
    )
    .patch(
      '/api/bookmarks/reorder',
      async ({ body, user }) => {
        await reorderPageBookmarks(user.id, body.ids);
        return { status: true };
      },
      { body: t.Object({ ids: t.Array(t.Number()) }) }
    );
