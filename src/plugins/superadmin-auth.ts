import jwt from '@elysiajs/jwt';
import { Elysia } from 'elysia';

const getSuperadminSecret = () =>
	`sa_${Bun.env.SUPERADMIN_USER ?? 'admin'}_${Bun.env.SUPERADMIN_PASSWORD ?? 'changeme'}`;

export const superadminAuth = () =>
	new Elysia()
		.use(jwt({ name: 'saJwt', secret: getSuperadminSecret() }))
		.derive({ as: 'scoped' }, async ({ saJwt, request: { headers } }) => {
			const token = headers.get('Authorization')?.split('Bearer ')[1];
			if (!token) throw new Error('No autorizado.');
			const payload = await saJwt.verify(token);
			if (!payload || (payload as any).superadmin !== true)
				throw new Error('No autorizado.');
			return { isSuperAdmin: true as const };
		});

export { getSuperadminSecret };
