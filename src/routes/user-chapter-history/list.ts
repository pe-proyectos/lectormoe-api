import { Elysia, t } from 'elysia';

import { loggedUserOnly } from '../../plugins/auth';
import { UserChapterHistoryListQuery } from '../../types/user-chapter-history/list';
import { listUserChapterHistory } from '../../controllers/user-chapter-history/list';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .get(
        '/api/user-chapter-history',
        async ({ organizationId, user, query }) => {
            const { data, maxPage, total } = await listUserChapterHistory(organizationId, user.id, query);
            
            return { status: true, data: {
                data,
                maxPage,
                total,
            } };
        },
        {
            query: UserChapterHistoryListQuery,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ query }) {
                if (query.include_finished) {
                    query.include_finished = query?.include_finished?.toString() === 'true'
                }
            },
        }
    );
