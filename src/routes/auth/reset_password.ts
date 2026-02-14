import { Elysia, t } from 'elysia';
import { resetPassword } from '../../controllers/auth/reset_password';
import { rateLimiter, RATE_LIMITS } from '../../util/rate-limiter';
import { getIP } from '../../util/get-ip';

export const router = () =>
  new Elysia().post(
    '/api/auth/reset-password',
    async ({ body, set, request: { headers } }) => {
      const { token, password } = body;

      if (!token || !password) {
        set.status = 400;
        return {
          status: false,
          message: 'Token y contrasena son requeridos.',
        };
      }

      // Rate limit by IP
      const ip = getIP(headers) || 'unknown';
      const rateLimitKey = `reset-password:${ip}`;
      const rateLimit = rateLimiter.checkLimit(
        rateLimitKey,
        RATE_LIMITS.PASSWORD_RESET.maxRequests,
        RATE_LIMITS.PASSWORD_RESET.windowMs
      );

      if (!rateLimit.allowed) {
        set.status = 429;
        const resetInMinutes = Math.ceil(
          (rateLimit.resetAt - Date.now()) / 60000
        );
        return {
          status: false,
          message: `Demasiados intentos. Intenta de nuevo en ${resetInMinutes} minutos.`,
        };
      }

      try {
        await resetPassword(token, password);
        return {
          status: true,
          message:
            'Tu contrasena ha sido restablecida exitosamente. Ya puedes iniciar sesion.',
        };
      } catch (error: any) {
        set.status = 400;
        return {
          status: false,
          message:
            error?.message || 'Error al restablecer la contrasena.',
        };
      }
    },
    {
      body: t.Object({
        token: t.String(),
        password: t.String(),
      }),
      response: t.Object({
        status: t.Boolean(),
        message: t.String(),
      }),
    }
  );
