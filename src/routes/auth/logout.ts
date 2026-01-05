import { Elysia, t } from 'elysia';
import jwt from '@elysiajs/jwt';

import { deleteToken } from '../../controllers/auth/logout';


export const router = () => new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: Bun.env.JWT_SECRET as string,
        })
    )
    .post(
        '/api/auth/logout',
        async ({ jwt, request: { headers } }) => {
            const authHeader = headers.get('Authorization');
            const token = authHeader?.split('Bearer ')[1];
            
            // Si hay un token, intentar eliminarlo (aunque no exista en la BD, no importa)
            if (token) {
                // Verificar que el JWT sea válido antes de intentar eliminarlo
                const tokenPayload = await jwt.verify(token);
                if (tokenPayload) {
                    // Intentar eliminar el token de la BD (puede que no exista, no importa)
                    try {
                        await deleteToken(token);
                    } catch (error) {
                        // Si falla, no importa, el logout es exitoso de todas formas
                    }
                }
            }
            
            return { status: true, message: 'OK' };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                message: t.String(),
            }),
        }
    );
