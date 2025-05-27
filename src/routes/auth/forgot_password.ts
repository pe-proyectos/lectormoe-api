import { Elysia, t } from 'elysia';

import { forgotPassword } from '../../controllers/auth/forgot_password';
import { useOrganization } from '../../plugins/organization';

export const router = () => new Elysia()
    .use(useOrganization())
    .post(
        '/api/auth/forgot-password',
        async ({ body, organization }) => {
            const { email } = body;
            
            if (!email) {
                throw new Error('El correo electrónico es requerido.');
            }

            await forgotPassword(
                organization.id,
                organization.name, 
                email as string
            );

            return {
                status: true,
                message: 'Se ha enviado un correo electrónico con el código de restablecimiento.'
            };
        },
        {
            body: t.Object({
                email: t.String()
            }),
            response: t.Object({
                status: t.Boolean(),
                message: t.String()
            })
        }
    );
