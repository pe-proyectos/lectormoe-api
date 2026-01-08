import jwt from '@elysiajs/jwt';
import { Elysia } from 'elysia';

import { checkToken } from '../controllers/auth/check';
import { checkOrganizationBySlug } from '../controllers/organization/check';
import { prisma } from '../models/prisma';

export const loggedOptional = () => new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: Bun.env.JWT_SECRET as string,
        })
    )
    .derive({ as: 'global' }, async ({ jwt, request: { headers } }) => {
        const authHeader = headers.get('Authorization');
        const token = authHeader?.split('Bearer ')[1];
        const organizationIdentifier = headers.get('x-organization');
        
        if (!token) {
            return { logged: false, user: null };
        }
        const tokenPayload = await jwt.verify(token);
        if (!tokenPayload) {
            return { logged: false, user: null };
        }
        
        let organizationId: number | null = null;
        let organization = null;
        
        if (organizationIdentifier) {
            // Si el organizationIdentifier es localhost o parece ser un hostname de desarrollo,
            // no intentar buscar organización (es válido para endpoints globales)
            const isLocalhost = organizationIdentifier === 'localhost' || 
                               organizationIdentifier === '127.0.0.1' ||
                               organizationIdentifier.startsWith('localhost:');
            
            if (!isLocalhost) {
                organization = await checkOrganizationBySlug(organizationIdentifier);
                    
                if (organization) {
                    organizationId = organization.id;
                }
            }
        }
        
        // Si el JWT es válido pero el token no existe en la BD, crear el token automáticamente
        let user = await checkToken(organizationId, token);
        if (!user && tokenPayload && typeof tokenPayload === 'object' && 'userId' in tokenPayload) {
            // El JWT es válido pero el token no existe en la BD, crear el token
            const { createToken } = await import('../controllers/auth/token');
            try {
                await createToken(token, tokenPayload.userId as number);
                // Intentar obtener el usuario nuevamente
                user = await checkToken(organizationId, token);
            } catch (error) {
                // Si falla la creación del token, continuar sin usuario
                console.error('Error creating token:', error);
            }
        }
        
        if (!user) {
            return { logged: false, user: null };
        }
        
        return { 
            logged: true, 
            organizationId: organizationId, 
            token, 
            user,
        };
    });

export const logged = () => new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: Bun.env.JWT_SECRET as string,
        })
    )
    .derive({ as: 'global' }, async ({ jwt, request: { headers } }) => {
        const token = headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) {
            throw new Error('No autorizado, token no encontrado.');
        }
        const tokenPayload = await jwt.verify(token);
        if (!tokenPayload) {
            throw new Error('No autorizado, token incorrecto.');
        }
        
        if (typeof tokenPayload !== 'object' || !('userId' in tokenPayload)) {
            throw new Error('No autorizado, token inválido.');
        }
        
        const user = await prisma.user.findUnique({
            where: {
                id: tokenPayload.userId as number,
            },
            include: {
                permissions: true,
            },
        });
        
        if (!user) {
            throw new Error('No autorizado, usuario no encontrado.');
        }
        
        return { 
            logged: true, 
            token, 
            user,
        };
    });

export const loggedUserOnly = () => new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: Bun.env.JWT_SECRET as string,
        })
    )
    .derive({ as: 'global' }, async ({ jwt, request: { headers } }) => {
        const organizationIdentifier = headers.get('x-organization');
        if (!organizationIdentifier) {
            throw new Error('No autorizado, dominio de organización no encontrado.');
        }
        const token = headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) {
            throw new Error('No autorizado, token no encontrado.');
        }
        const tokenPayload = await jwt.verify(token);
        if (!tokenPayload) {
            throw new Error('No autorizado, token incorrecto.');
        }
        
        // Si contiene un punto, es un domain; si no, es un slug
        const isDomain = organizationIdentifier.includes('.');
        const organization = await checkOrganizationBySlug(organizationIdentifier);
            
        if (!organization) {
            throw new Error('No autorizado, organización no encontrada.');
        }
        const user = await checkToken(organization.id, token);
        if (!user) {
            throw new Error('No autorizado, usuario no encontrado.');
        }
        
        // Obtener permisos del usuario para esta organización
        const organizationPermissions = user.permissions.find((permission: any) => permission.organizationId === organization.id);
        if (!organizationPermissions) {
            throw new Error('No autorizado, usuario no tiene permisos para esta organización.');
        }
        
        return { 
            logged: true, 
            token, 
            organizationId: organization.id, 
            user,
        };
    });
