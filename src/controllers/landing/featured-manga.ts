import { prisma, Prisma } from "../../models/prisma";
import { createHilos } from "../../lib/hilos-sdk";

// Generate a consistent color based on organization name
const getBadgeColor = (orgName: string): string => {
	// Simple hash function to generate consistent colors
	let hash = 0;
	for (let i = 0; i < orgName.length; i++) {
		hash = orgName.charCodeAt(i) + ((hash << 5) - hash);
	}
	
	// Predefined color palette
	const colors = [
		'bg-purple-600',
		'bg-blue-600',
		'bg-red-600',
		'bg-green-600',
		'bg-yellow-600',
		'bg-pink-600',
		'bg-indigo-600',
		'bg-orange-600',
	];
	
	return colors[Math.abs(hash) % colors.length];
};

// BookType.code values that classify a Manga row as a "writing" (text-based)
// instead of a comic/manga.
const WRITING_BOOK_TYPE_CODES = ["novel", "light-novel", "book", "short-story"];

type ContentKind = "manga" | "writing" | "all";

const buildContentKindFilter = (contentKind?: ContentKind): object[] => {
	if (contentKind === "writing") {
		return [{ manga: { bookType: { code: { in: WRITING_BOOK_TYPE_CODES } } } }];
	}
	if (contentKind === "manga") {
		return [{ manga: { bookType: { code: { notIn: WRITING_BOOK_TYPE_CODES } } } }];
	}
	return [];
};

// Obras con mas comentarios en La Charca en los ultimos 7 dias, de mayor a
// menor. Los comentarios de un capitulo viven en el muro `manga:<mangaCustomId>`.
let comentadosCache: { at: number; ids: number[] } | null = null;
async function masComentadosSemana(): Promise<number[]> {
	if (comentadosCache && Date.now() - comentadosCache.at < 10 * 60 * 1000) return comentadosCache.ids;
	const secretKey = process.env.HILOS_SECRET_KEY;
	if (!secretKey) return [];
	try {
		const hilos = createHilos({ baseUrl: process.env.HILOS_BASE || "https://hilos.rest", secretKey });
		const rows: Array<{ externalId: string; count: number }> =
			(await hilos.request("GET", "/socials/most-commented?days=7&limit=200")) || [];
		const ids = rows
			.map((r) => r.externalId.match(/^manga:(\d+)$/))
			.filter((m): m is RegExpMatchArray => !!m)
			.map((m) => Number(m[1]));
		comentadosCache = { at: Date.now(), ids };
		return ids;
	} catch (e) {
		console.error("[featured-manga] hilos most-commented:", e);
		return comentadosCache?.ids ?? [];
	}
}

// Recomendaciones del dia: obras al azar sin mirar lecturas ni popularidad.
// El azar sale de la fecha (hora de Lima), asi que la seleccion cambia a las
// 00:00 y es la misma para todos durante el dia.
function hashDia(dia: string, id: number): number {
	let h = 2166136261;
	for (const c of `${dia}:${id}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	return h >>> 0;
}

async function recomendadasDelDia(where: object, limit: number): Promise<number[]> {
	const dia = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
	const todas = await prisma.mangaCustom.findMany({ where, select: { id: true } });
	return todas
		.map((m) => ({ id: m.id, h: hashDia(dia, m.id) }))
		.sort((a, b) => a.h - b.h)
		.slice(0, limit)
		.map((m) => m.id);
}

export type FeaturedSort = "views" | "comments" | "daily";

export const getFeaturedManga = async (limit: number = 8, nsfw?: boolean, contentKind: ContentKind = "all", sort: FeaturedSort = "views") => {
	// nsfw=false: excluir mangas con isNSFW=true o que pertenezcan a una org NSFW
	// nsfw=true:  solo mangas marcados isNSFW=true o de una org NSFW
	// Clasificación por MANGA: /red solo +18, azul solo no-+18.
	const nsfwCondition: object[] = nsfw === true
		? [{ isNSFW: true }]
		: nsfw === false
		? [{ isNSFW: false }]
		: [];

	const contentKindCondition = buildContentKindFilter(contentKind);

	const whereBase = {
		deletedAt: null,
		isPublic: true,
		AND: [
			...nsfwCondition,
			...contentKindCondition,
			// Solo con portada (gt "" descarta null y vacio).
			{ OR: [{ imageUrl: { gt: "" } }, { manga: { imageUrl: { gt: "" } } }] },
			{ organization: { isPublic: true, isDeleted: false } },
		],
	};
	const comentados =
		sort === "comments" ? await masComentadosSemana()
		: sort === "daily" ? await recomendadasDelDia(whereBase, limit)
		: [];
	const rango = new Map(comentados.map((id, i) => [id, i]));

	const buscar = (soloIds: number[] | null, take: number) => prisma.mangaCustom.findMany({
		where: { ...(soloIds ? { id: { in: soloIds } } : {}), ...whereBase },
		include: {
			manga: {
				select: {
					id: true,
					title: true,
					slug: true,
					imageUrl: true,
				},
			},
			organization: {
				select: {
					id: true,
					name: true,
					domain: true,
					slug: true,
					isNSFW: true,
				},
			},
			chapters: {
				// releasedAt not null: el schema de la ruta exige Date y un solo null
				// tumba el endpoint completo con 422 (mismo bug que popular-today).
				where: { publishAt: null, deletedAt: null, releasedAt: { not: null } },
				select: {
					id: true,
					number: true,
					title: true,
					releasedAt: true,
					views: true,
				},
			},
		},
		orderBy: {
			views: Prisma.SortOrder.desc,
		},
		take,
	});

	// Por comentarios: primero las mas comentadas de la semana; si no llegan al
	// limite (semana floja), se completa con las mas vistas.
	let mangasCustoms = comentados.length ? await buscar(comentados, comentados.length) : [];
	mangasCustoms.sort((a, b) => (rango.get(a.id) ?? 0) - (rango.get(b.id) ?? 0));
	if (mangasCustoms.length < limit) {
		const ya = new Set(mangasCustoms.map((m) => m.id));
		const extra = (await buscar(null, limit * 3)).filter((m) => !ya.has(m.id));
		mangasCustoms = [...mangasCustoms, ...extra];
	}

	// Calculate total views (manga views + chapter views) and filter
	const mangasWithViews = mangasCustoms
		.map((mangaCustom) => {
			const chapterViews = mangaCustom.chapters.reduce(
				(acc, chapter) => acc + chapter.views,
				0
			);
			const totalViews = mangaCustom.views + chapterViews;
			
			return {
				mangaCustom,
				totalViews,
			};
		})
		.filter((item) => {
			// Filter out mangas without valid cover URLs
			// Prefer MangaCustom.imageUrl, fallback to Manga.imageUrl
			const coverUrl = item.mangaCustom.imageUrl || item.mangaCustom.manga.imageUrl;
			return coverUrl && coverUrl.trim() !== '';
		})
		.sort((a, b) => {
			const ra = rango.get(a.mangaCustom.id), rb = rango.get(b.mangaCustom.id);
			if (ra !== undefined || rb !== undefined) return (ra ?? Infinity) - (rb ?? Infinity);
			return b.totalViews - a.totalViews;
		})
		.slice(0, limit);

	// Transform to the format expected by the frontend
	return mangasWithViews.map(({ mangaCustom }) => {
		const organization = mangaCustom.organization;
		const manga = mangaCustom.manga;
		
		// Prefer MangaCustom.imageUrl, fallback to Manga.imageUrl
		const coverUrl = mangaCustom.imageUrl || manga.imageUrl || '';
		
		// Get last 2 chapters ordered by number (descending)
		const lastChapters = mangaCustom.chapters
			.sort((a, b) => b.number - a.number)
			.slice(0, 2)
			.map((chapter) => ({
				id: chapter.id,
				number: chapter.number,
				title: chapter.title,
				releasedAt: chapter.releasedAt,
				chapterUrl: `/${organization.slug}/manga/${manga.slug}/chapters/${chapter.number}`,
			}));
		
		return {
			id: mangaCustom.id.toString(),
			title: mangaCustom.title || manga.title,
			cover: coverUrl,
			scanName: organization.name,
			scanSlug: organization.slug,
			scanUrl: `/${organization.slug}`,
			mangaSlug: manga.slug,
			mangaUrl: `/${organization.slug}/manga/${manga.slug}`,
			badgeColor: getBadgeColor(organization.name),
			chapters: lastChapters,
			organizationId: organization.id,
			isNSFW: mangaCustom.isNSFW || organization.isNSFW,
		};
	});
};

