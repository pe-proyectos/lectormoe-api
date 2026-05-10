import { Elysia, t } from 'elysia';
import { prisma } from '../../models/prisma';

export const router = () => new Elysia()
    .get(
        '/api/author/:slug',
        async ({ params, set }) => {
            const author = await prisma.author.findUnique({
                where: { slug: params.slug },
                select: { id: true, name: true, slug: true, shortDescription: true, imageUrl: true },
            });
            if (!author) {
                set.status = 404;
                return { status: false, error: 'Autor no encontrado' };
            }
            return { status: true, data: author };
        },
        {
            params: t.Object({ slug: t.String() }),
        }
    );
