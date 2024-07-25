import { Elysia, t } from 'elysia';

import { editCoinPack } from '../../controllers/coinpack/edit';
import { loggedMemberOnly } from '../../plugins/auth';
import { EditCoinPackRequest } from '../../types/coinpack/edit';

export const router = () => new Elysia()
    .use(loggedMemberOnly())
    .patch(
        '/api/coinpack/:coinPackId',
        async ({ organizationId, member, body, params: { coinPackId } }) => {
            if (!member.canEditCoinPack) {
                throw new Error("No tiene permisos para editar paquetes de monedas.");
            }

            const coinPack = await editCoinPack(organizationId, parseInt(coinPackId), body);

            if (!coinPack) {
                throw new Error("No se pudo editar el paquete de monedas.");
            }

            return {
                status: true,
                data: coinPack,
            };
        },
        {
            body: EditCoinPackRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ body }) {
                if (body.priceWithoutDiscount) {
                    body.priceWithoutDiscount = Number.parseFloat(body.priceWithoutDiscount.toString());
                }
                if (body.price) {
                    body.price = Number.parseFloat(body.price.toString());
                }
                if (body.coins) {
                    body.coins = Number.parseInt(body.coins.toString());
                }
                if (body.active !== undefined) {
                    body.active = body.active.toString() === "true";
                }
            },
        }
    );
