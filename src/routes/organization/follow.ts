import { Elysia, t } from 'elysia';
import { logged } from '../../plugins/auth';
import { toggleFollowOrganization, checkIfUserFollows } from '../../controllers/organization/follow';
import { checkOrganizationBySlug } from '../../controllers/organization/check';
import { checkAndUnlockAchievements } from '../../controllers/user/achievements';
import { prisma } from '../../models/prisma';

export const router = () => new Elysia()
    .use(logged())
    .get(
        '/api/organization/:slug/follow/status',
        async ({ params, user }) => {
            const { slug } = params;
            
            const organization = await checkOrganizationBySlug(slug);
            if (!organization) {
                throw new Error('Organización no encontrada.');
            }

            const isFollowing = await checkIfUserFollows(user.id, organization.id);
            
            return {
                status: true,
                data: {
                    isFollowing,
                },
            };
        },
        {
            params: t.Object({
                slug: t.String(),
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Object({
                    isFollowing: t.Boolean(),
                }),
            }),
        }
    )
    .post(
        '/api/organization/:slug/follow',
        async ({ params, user }) => {
            const { slug } = params;
            
            const organization = await checkOrganizationBySlug(slug);
            if (!organization) {
                throw new Error('Organización no encontrada.');
            }

            const result = await toggleFollowOrganization(user.id, organization.id);

            // Get updated follower count
            const followerCount = await prisma.organizationFollower.count({
                where: {
                    organizationId: organization.id,
                },
            });

            // Check achievements on follow (fire-and-forget)
            if (result.followed) {
                checkAndUnlockAchievements(user.id, { action: 'follow' }).catch(() => {});
            }

            return {
                status: true,
                data: {
                    followed: result.followed,
                    followerCount,
                },
            };
        },
        {
            params: t.Object({
                slug: t.String(),
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Object({
                    followed: t.Boolean(),
                    followerCount: t.Number(),
                }),
            }),
        }
    )
    .delete(
        '/api/organization/:slug/follow',
        async ({ params, user }) => {
            const { slug } = params;
            
            const organization = await checkOrganizationBySlug(slug);
            if (!organization) {
                throw new Error('Organización no encontrada.');
            }

            const result = await toggleFollowOrganization(user.id, organization.id);
            
            // Get updated follower count
            const followerCount = await prisma.organizationFollower.count({
                where: {
                    organizationId: organization.id,
                },
            });

            return {
                status: true,
                data: {
                    followed: result.followed,
                    followerCount,
                },
            };
        },
        {
            params: t.Object({
                slug: t.String(),
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Object({
                    followed: t.Boolean(),
                    followerCount: t.Number(),
                }),
            }),
        }
    );

