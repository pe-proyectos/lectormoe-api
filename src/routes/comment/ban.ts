import { Elysia, t } from "elysia";
import { loggedUserOnly } from "../../plugins/auth";
import { useOrganizationOptional } from "../../plugins/organization";
import { banUser, unbanUser, listBans } from "../../controllers/comment/ban-user";
import { BanType } from "../../prisma-generated/enums";

export const router = () =>
	new Elysia()
		.use(useOrganizationOptional())
		.use(loggedUserOnly())
		// Ban a user
		.post(
			"/api/comment/ban",
			async ({ user, organizationId, body }) => {
				if (!organizationId) throw new Error("Se requiere una organización.");
				const permissions = user.permissions.find(
					(p: any) => p.organizationId === organizationId,
				);
				if (!permissions?.canBanUser) {
					throw new Error("No tienes permisos para banear usuarios.");
				}

				const ban = await banUser({
					targetUserId: body.userId,
					organizationId,
					bannedByUserId: user.id,
					type: body.type as BanType,
					reason: body.reason,
					expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
					deleteComments: body.deleteComments,
					onlyLast24h: body.onlyLast24h,
				});

				return { status: true, data: ban };
			},
			{
				body: t.Object({
					userId: t.Number(),
					type: t.Union([
						t.Literal("TEMPORARY"),
						t.Literal("PERMANENT"),
						t.Literal("RESTRICTED"),
					]),
					reason: t.Optional(t.String()),
					expiresAt: t.Optional(t.String()),
					deleteComments: t.Boolean(),
					onlyLast24h: t.Boolean(),
				}),
			},
		)
		// Revoke a ban
		.post(
			"/api/comment/unban/:banId",
			async ({ user, organizationId, params: { banId } }) => {
				if (!organizationId) throw new Error("Se requiere una organización.");
				const permissions = user.permissions.find(
					(p: any) => p.organizationId === organizationId,
				);
				if (!permissions?.canBanUser) {
					throw new Error("No tienes permisos para revocar bans.");
				}

				await unbanUser(Number(banId), organizationId);
				return { status: true, data: true };
			},
			{
				params: t.Object({ banId: t.String() }),
			},
		)
		// List active bans for this org
		.get(
			"/api/comment/bans",
			async ({ user, organizationId }) => {
				if (!organizationId) throw new Error("Se requiere una organización.");
				const permissions = user.permissions.find(
					(p: any) => p.organizationId === organizationId,
				);
				if (!permissions?.canBanUser) {
					throw new Error("No tienes permisos para ver los bans.");
				}

				const bans = await listBans(organizationId);
				return { status: true, data: bans };
			},
		);
