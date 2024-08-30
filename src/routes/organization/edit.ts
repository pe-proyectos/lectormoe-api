import { Elysia, t } from 'elysia';

import { loggedMemberOnly } from '../../plugins/auth';
import { EditOrganizationRequest } from '../../types/organization/edit';
import { editOrganization } from '../../controllers/organization/edit';

export const router = () => new Elysia()
    .use(loggedMemberOnly())
    .patch(
        '/api/organization',
        async ({ organizationId, member, body }) => {
            if (!member.canEditOrganization) {
                throw new Error("No tiene permisos para editar la organización.");
            }

            const organization = await editOrganization(organizationId, body);

            if (!organization) {
                throw new Error("No se pudo editar la organización.");
            }

            return {
                status: true,
                data: organization,
            };
        },
        {
            body: EditOrganizationRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ body }) {
                if (typeof body.enableMangaSection === 'string')
                    body.enableMangaSection = body.enableMangaSection === 'true';
                if (typeof body.enableManhuaSection === 'string')
                    body.enableManhuaSection = body.enableManhuaSection === 'true';
                if (typeof body.enableManhwaSection === 'string')
                    body.enableManhwaSection = body.enableManhwaSection === 'true';
                if (typeof body.enableGoogleAds === 'string')
                    body.enableGoogleAds = body.enableGoogleAds === 'true';
                if (typeof body.enableDisqusIntegration === 'string')
                    body.enableDisqusIntegration = body.enableDisqusIntegration === 'true';
            },
        }
    );
