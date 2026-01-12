import { Elysia, t } from 'elysia';

import { listUser } from '../../controllers/user/list';
import { UserListQuery } from '../../types/user/list';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .get(
        '/api/user',
        async ({ organizationId, user, query }) => {
            const permissions = user.permissions.find((p: any) => p.organizationId === organizationId);
            if (!permissions?.canSeeAdminPanel) {
                throw new Error("No tiene permisos para ver los usuarios.");
            }

            const { data, maxPage, total } = await listUser(organizationId, query);
            
            return { status: true, data: {
                items: data,
                maxPage,
                total,
            } };
        },
        {
            query: UserListQuery,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ query }) {
              if (query.subscriptionPlanIds) {
                query.subscriptionPlanIds = query.subscriptionPlanIds.toString().split(',').map(Number);
              }
              if (query.permissionKeys) {
                query.permissionKeys = query.permissionKeys.toString().split(',').filter(Boolean);
              }
            }
        }
    );
