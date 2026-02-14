import { Elysia, t } from 'elysia';
import { prisma } from '../../models/prisma';
import { logged } from '../../plugins/auth';
import { sendEmailVerificationEmail } from '../../services/email-notifications';
import { rateLimiter } from '../../util/rate-limiter';

const sendVerificationRouter = () =>
  new Elysia()
    .use(logged())
    .post(
      '/api/auth/send-verification',
      async ({ user, set }) => {
        if (user.emailVerified) {
          return { status: true, message: 'Tu email ya esta verificado.' };
        }

        // Rate limit
        const rateLimitKey = `verify-email:${user.id}`;
        const rateLimit = rateLimiter.checkLimit(rateLimitKey, 3, 60 * 60 * 1000);
        if (!rateLimit.allowed) {
          set.status = 429;
          return { status: false, message: 'Demasiados intentos. Intenta en 1 hora.' };
        }

        // Delete existing verification tokens
        await prisma.emailVerificationToken.deleteMany({
          where: { userId: user.id },
        });

        const token = crypto.randomUUID();
        await prisma.emailVerificationToken.create({
          data: {
            userId: user.id,
            token,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          },
        });

        await sendEmailVerificationEmail(user.id, user.email, user.username, token);

        return { status: true, message: 'Email de verificacion enviado.' };
      },
      {
        response: t.Object({
          status: t.Boolean(),
          message: t.String(),
        }),
      }
    );

const verifyEmailRouter = () =>
  new Elysia()
    .get(
      '/api/auth/verify-email',
      async ({ query, set }) => {
        const { token } = query;

        if (!token) {
          set.status = 400;
          return { status: false, message: 'Token requerido.' };
        }

        const record = await prisma.emailVerificationToken.findUnique({
          where: { token },
          include: { user: { select: { id: true, emailVerified: true } } },
        });

        if (!record) {
          set.status = 400;
          return { status: false, message: 'Token no valido o ya utilizado.' };
        }

        if (record.expiresAt < new Date()) {
          await prisma.emailVerificationToken.delete({ where: { id: record.id } });
          set.status = 400;
          return { status: false, message: 'El enlace ha expirado. Solicita uno nuevo.' };
        }

        await prisma.$transaction([
          prisma.user.update({
            where: { id: record.user.id },
            data: { emailVerified: true },
          }),
          prisma.emailVerificationToken.deleteMany({
            where: { userId: record.user.id },
          }),
        ]);

        return { status: true, message: 'Email verificado exitosamente!' };
      },
      {
        query: t.Object({
          token: t.String(),
        }),
        response: t.Object({
          status: t.Boolean(),
          message: t.String(),
        }),
      }
    );

export const router = () =>
  new Elysia()
    .use(sendVerificationRouter())
    .use(verifyEmailRouter());
