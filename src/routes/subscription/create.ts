import { Elysia, t } from 'elysia';

import { CreateSubscriptionRequest } from '../../types/subscription/create';
import { createSubscription } from '../../controllers/subscription/create';
import { loggedOptional } from '../../plugins/auth';

export const router = () => new Elysia()
    // ANTES usaba loggedUserOnly(), que exige que el usuario tenga PERMISOS de
    // staff en el scan. Un LECTOR que se suscribe no los tiene -> al volver de
    // PayPal (pago ya cobrado) recibia "No autorizado, usuario no tiene permisos
    // para esta organizacion" y la suscripcion NUNCA se creaba (pagaban y no
    // recibian nada -> disputas). Ahora basta con estar logueado; el scan se
    // resuelve del header x-organization.
    .use(loggedOptional())
    .post(
        '/api/subscription',
        async ({ organizationId, user, body }) => {
            if (!user) {
                throw new Error("Debes iniciar sesion para suscribirte.");
            }
            if (!organizationId) {
                throw new Error("No se pudo identificar el scan.");
            }
            const subscription = await createSubscription(organizationId, user.id, body);

            if (!subscription) {
                throw new Error("No se pudo crear la suscripción.");
            }

            return {
                status: true,
                data: subscription,
            };
        },
        {
            body: CreateSubscriptionRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
