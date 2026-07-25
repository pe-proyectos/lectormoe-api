import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { loggedUserOnlyGlobal } from '../../plugins/auth'
import { assertRateLimit } from '../../util/rate-limit'

// Normaliza y valida que el correo sea una cuenta de Gmail. Google Play exige
// que el verificador use la cuenta de Google con la que ingresa en su Android;
// pedimos Gmail para simplificar y validar en cliente y servidor.
const GMAIL_RE = /^[a-z0-9._%+-]+@gmail\.com$/i

// Programa de verificadores (closed testing) de Google Play.
export const router = () =>
  new Elysia()
    .use(loggedUserOnlyGlobal())
    // Estado propio de inscripción (o null si no se ha registrado).
    .get('/api/beta/me', async ({ user }) => {
      if (!user) throw new Error('Debes iniciar sesión.')
      const record = await prisma.betaTester.findUnique({
        where: { userId: user.id },
        select: { id: true, name: true, gmail: true, status: true, createdAt: true }
      })
      return { status: true, data: record }
    })
    // Alta o actualización de la propia inscripción.
    .post(
      '/api/beta/signup',
      async ({ user, body }) => {
        if (!user) throw new Error('Debes iniciar sesión.')
        assertRateLimit(`beta-signup:${user.id}`, 5, 60_000, 'Espera un momento e intenta de nuevo.')

        const name = body.name.trim()
        const gmail = body.gmail.trim().toLowerCase()
        if (name.length < 2) throw new Error('Ingresa tu nombre.')
        if (!GMAIL_RE.test(gmail)) {
          throw new Error('El correo debe ser una cuenta de Gmail (@gmail.com).')
        }

        const record = await prisma.betaTester.upsert({
          where: { userId: user.id },
          create: { userId: user.id, name, gmail },
          // No reabrimos un estado ya resuelto por el staff: si estaba added
          // o rejected, solo actualizamos los datos, no el status.
          update: { name, gmail },
          select: { id: true, name: true, gmail: true, status: true, createdAt: true }
        })
        return { status: true, data: record }
      },
      {
        body: t.Object({ name: t.String(), gmail: t.String() }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
