import jwt from '@elysiajs/jwt';
import { Elysia } from 'elysia';
import { HttpError } from 'elysia-http-error';

import { checkMemberToken, checkToken } from '../controllers/auth/check';
import { checkOrganization } from '../controllers/organization/check';

export const loggedOptional = () => new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: Bun.env.JWT_SECRET as string,
        })
    )
    .derive({ as: 'global' }, async ({ jwt, request: { headers } }) => {
        const token = headers.get('Authorization')?.split('Bearer ')[1];
        const organizationDomain = headers.get('organization-domain');
        if (!organizationDomain) {
            throw HttpError.Unauthorized('No autorizado, dominio de organización no encontrado.');
        }
        if (!token) {
            return { logged: false };
        }
        const tokenPayload = await jwt.verify(token);
        if (!tokenPayload) {
            return { logged: false };
        }
        const [organization, user] = await Promise.all([checkOrganization(organizationDomain), checkToken(token)]);
        if (!organization) {
            return { logged: false };
        }
        if (!user) {
            return { logged: false };
        }
        return { logged: true, organizationId: organization.id, token, user };
    });

export const loggedUserOnly = () => new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: Bun.env.JWT_SECRET as string,
        })
    )
    .derive({ as: 'global' }, async ({ jwt, request: { headers } }) => {
        const organizationDomain = headers.get('organization-domain');
        if (!organizationDomain) {
            throw HttpError.Unauthorized('No autorizado, dominio de organización no encontrado.');
        }
        const token = headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) {
            throw HttpError.Unauthorized('No autorizado, token no encontrado.');
        }
        const tokenPayload = await jwt.verify(token);
        if (!tokenPayload) {
            throw HttpError.Unauthorized('No autorizado, token incorrecto.');
        }
        const [organization, user] = await Promise.all([checkOrganization(organizationDomain), checkToken(token)]);
        if (!organization) {
            throw HttpError.Unauthorized('No autorizado, organización no encontrada.');
        }
        if (!user) {
            throw HttpError.Unauthorized('No autorizado, usuario no encontrado.');
        }
        return { logged: true, token, organizationId: organization.id, user };
    });

export const loggedMemberOnly = () => new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: Bun.env.JWT_SECRET as string,
        })
    )
    .derive({ as: 'global' }, async ({ jwt, request: { headers } }) => {
        const organizationDomain = headers.get('organization-domain');
        if (!organizationDomain) {
            throw HttpError.Unauthorized('No autorizado, dominio de organización no encontrado.');
        }
        const token = headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) {
            throw HttpError.Unauthorized('No autorizado, token no encontrado.');
        }
        const tokenPayload = await jwt.verify(token);
        if (!tokenPayload) {
            throw HttpError.Unauthorized('No autorizado, token incorrecto.');
        }
        const organization = await checkOrganization(organizationDomain);
        if (!organization) {
            throw HttpError.Unauthorized('No autorizado, organización no encontrada.');
        }
        const member = await checkMemberToken(token, organization.id);
        if (!member) {
            throw HttpError.Unauthorized('No autorizado, no es miembro de la organización.');
        }
        return { logged: true, token, organizationId: organization.id, user: member.user, member };
    });
