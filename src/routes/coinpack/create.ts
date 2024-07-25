import { Elysia, t } from 'elysia';

import { CreateCoinPackRequest } from '../../types/coinpack/create';
import { createCoinPack } from '../../controllers/coinpack/create';
import { loggedMemberOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedMemberOnly())
    .post(
        '/api/coinpack',
        async ({ organizationId, member, body }) => {
            if (!member.canCreateCoinPack) {
                throw new Error("No tiene permisos para crear paquetes de monedas.");
            }

            const coinPack = await createCoinPack(organizationId, body);

            if (!coinPack) {
                throw new Error("No se pudo crear el paquete de monedas.");
            }

            return {
                status: true,
                data: coinPack,
            };
        },
        {
            body: CreateCoinPackRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ body }) {
                body.priceWithoutDiscount = Number.parseFloat(body.priceWithoutDiscount.toString());
                body.price = Number.parseFloat(body.price.toString());
                body.coins = Number.parseInt(body.coins.toString());
                body.active = body.active.toString() === "true";
            },
        }
    );
