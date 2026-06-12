import { Elysia, t } from 'elysia';
import { logged } from '../../plugins/auth';
import { getFrequentReads } from '../../controllers/organization/frequent-reads';

export const router = () => new Elysia()
    .use(logged())
    .get(
        '/api/organization/frequent-reads',
        async ({ user }) => {
            const data = await getFrequentReads(user.id);
            return { status: true, data };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Array(t.Object({
                    id: t.String(),
                    name: t.String(),
                    slug: t.String(),
                    logo: t.Union([t.String(), t.Null()]),
                    url: t.String(),
                    followerCount: t.Number(),
                    isNSFW: t.Boolean(),
                })),
            }),
        }
    );
