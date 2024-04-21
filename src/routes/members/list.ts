import { Elysia, t } from 'elysia';

import { listMember } from '../../controllers/member/list';
import { MemberListQuery } from '../../types/member/list';
import { loggedMemberOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedMemberOnly())
    .get(
        '/api/member',
        async ({ organizationId, member, query }) => {
            if (!member.canSeeAdminPanel) {
                throw new Error("No tiene permisos para ver los miembros.");
            }

            const { data, maxPage, total } = await listMember(organizationId, query);
            
            return { status: true, data: {
                data,
                maxPage,
                total,
            } };
        },
        {
            query: MemberListQuery,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
