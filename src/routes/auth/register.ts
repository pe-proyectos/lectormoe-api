import jwt from '@elysiajs/jwt';
import { Elysia, t } from 'elysia';
import { HttpError } from 'elysia-http-error';

import { register } from '../../controllers/auth/register';


export const router = () => new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: Bun.env.JWT_SECRET as string,
        })
    )
    .post(
        '/api/auth/register',
        async ({ body: { email, username, password } }) => {
            const registered = await register(email, username, password);

            if (!registered) {
                throw HttpError.BadRequest('No se pudo registrar el usuario.');
            }

            return {
                status: registered,
                message: registered ? 'Usuario registrado correctamente.' : 'No se pudo registrar el usuario.',
            };
        },
        {
            body: t.Object({
                email: t.String({
                    format: 'email',
                    default: '',
                    error: 'El email no es válido.',
                }),
                username: t.String({
                    minLength: 3,
                    maxLength: 20,
                    pattern: '^[a-zA-Z0-9_]*$',
                    default: '',
                    error: 'El nombre de usuario debe tener entre 3 y 20 caracteres alfanuméricos.',
                }),
                password: t.String({
                    minLength: 4,
                    maxLength: 30,
                    error: 'La contraseña debe tener entre 4 y 30 caracteres.',
                }),
            }),
            response:  t.Object({
                status: t.Boolean(),
                message: t.String(),
            }),
        }
    );
