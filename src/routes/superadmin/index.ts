import { Elysia, t } from 'elysia';
import jwt from '@elysiajs/jwt';
import { getSuperadminSecret, superadminAuth } from '../../plugins/superadmin-auth';
import { getGlobalStats, getOrgStats } from '../../controllers/superadmin/stats';
import { listRequests, reviewRequest } from '../../controllers/superadmin/requests';

export const router = () =>
	new Elysia()
		.use(jwt({ name: 'saJwt', secret: getSuperadminSecret() }))
		// ── Login (no auth) ──────────────────────────────────────────────────────
		.post(
			'/api/superadmin/login',
			async ({ saJwt, body }) => {
				const { username, password } = body;
				if (
					username !== Bun.env.SUPERADMIN_USER ||
					password !== Bun.env.SUPERADMIN_PASSWORD
				) {
					throw new Error('Credenciales incorrectas.');
				}
				const token = await saJwt.sign({ superadmin: true });
				return { status: true, token };
			},
			{
				body: t.Object({ username: t.String(), password: t.String() }),
				response: t.Object({ status: t.Boolean(), token: t.String() }),
			}
		)
		// ── Protected routes ─────────────────────────────────────────────────────
		.use(superadminAuth())
		.get('/api/superadmin/stats', async () => {
			const data = await getGlobalStats();
			return { status: true, data };
		})
		.get('/api/superadmin/org-stats', async () => {
			const data = await getOrgStats();
			return { status: true, data };
		})
		.get(
			'/api/superadmin/requests',
			async ({ query }) => {
				const data = await listRequests(query.status as string | undefined);
				return { status: true, data };
			},
			{
				query: t.Object({ status: t.Optional(t.String()) }),
			}
		)
		.patch(
			'/api/superadmin/requests/:id/review',
			async ({ params, body }) => {
				const data = await reviewRequest(
					Number(params.id),
					body.action as 'accept' | 'reject',
					body.notes
				);
				return { status: true, data };
			},
			{
				params: t.Object({ id: t.String() }),
				body: t.Object({
					action: t.String(),
					notes: t.Optional(t.String()),
				}),
			}
		);
