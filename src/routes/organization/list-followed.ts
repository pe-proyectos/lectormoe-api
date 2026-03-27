import { Elysia, t } from 'elysia';
import { logged } from '../../plugins/auth';
import { listFollowedOrganizations } from '../../controllers/organization/list-followed';

export const router = () => new Elysia()
    .use(logged())
    .get(
        '/api/organization/followed',
        async ({ user }) => {
            const organizations = await listFollowedOrganizations(user.id);
            
            return {
                status: true,
                data: organizations,
            };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Array(t.Object({
                    id: t.Number(),
                    name: t.String(),
                    slug: t.String(),
                    logoUrl: t.Union([t.String(), t.Null()]),
                    subscription: t.Union([
                        t.Object({
                            rank: t.String(),
                            price: t.Number(),
                            currency: t.String(),
                            interval: t.String(),
                            status: t.Union([t.Literal('active'), t.Literal('paused')]),
                        }),
                        t.Null(),
                    ]),
                    followerCount: t.Number(),
                })),
            }),
        }
    );

