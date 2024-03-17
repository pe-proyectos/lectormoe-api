import jwt from '@elysiajs/jwt';
import { Elysia } from 'elysia';
import { HttpError } from 'elysia-http-error';

import { checkToken } from '../controllers/auth/check';


export const authMiddleware = (opts: { loggedOnly: boolean }) => new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: Bun.env.JWT_SECRET as string,
        })
    )
    .derive({ as: 'global' }, async ({ jwt, request: { headers } }) => {
        const token = headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) {
            if (!opts.loggedOnly) return { logged: false };
            throw HttpError.Unauthorized('No autorizado, token no encontrado.');
        }
        const tokenPayload = await jwt.verify(token);
        if (!tokenPayload) {
            if (!opts.loggedOnly) return { logged: false };
            throw HttpError.Unauthorized('No autorizado, token incorrecto.');
        }
        const user = await checkToken(token);
        if (!user) {
            if (!opts.loggedOnly) return { logged: false };
            throw HttpError.Unauthorized('No autorizado, token incorrecto.');
        }
        return { logged: true, token, user };
    });
