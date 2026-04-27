import { type MangaCustomListQuery, OrderEnum } from "../../types/manga-custom/list";
import { prisma, Prisma } from "../../models/prisma";

export const listMangaCustom = async (organizationId: number | null, filters: MangaCustomListQuery) => {
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	const order: any = {};
	
	// Handle search parameter
	const searchConditions = filters.search ? {
		OR: [
			{ title: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
			{ shortDescription: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
			{ description: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
		]
	} : {};
	
	if (filters.order === OrderEnum.FEATURED) {
		order.orderBy = {
			views: Prisma.SortOrder.desc,
		};
	} else if (filters.order === OrderEnum.LATEST) {
		order.orderBy = {
			lastChapterAt: {
				sort: Prisma.SortOrder.desc,
				nulls: Prisma.NullsOrder.last,
			}
		};
	} else if (filters.order === OrderEnum.POPULAR) {
		// Optimized popular query: Get manga IDs with view counts first, then fetch only needed mangas
		const whereCondition = {
			...(organizationId ? {
				mangaCustom: {
					organization: {
						id: organizationId,
					},
					deletedAt: null,
				}
			} : {
				mangaCustom: {
					deletedAt: null,
				}
			}),
			createdAt: {
				gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
			}
		};

		// Get aggregated view counts per manga
		const viewCounts = await prisma.viewsHistory.groupBy({
			by: ['mangaCustomId'],
			where: whereCondition,
			_count: {
				ip: true,
			},
			orderBy: {
				_count: {
					ip: Prisma.SortOrder.desc,
				}
			},
			take: 100, // Limit to top 100 to avoid loading all data
		});

		// Apply pagination to the view counts
		const skip = filters?.page ? (Number.parseInt(filters?.page || "1") - 1) * Number.parseInt(filters?.limit || "10") : 0;
		const take = Number.parseInt(filters?.limit || "10");
		const paginatedIds = viewCounts.slice(skip, skip + take).map(v => v.mangaCustomId).filter(v => v !== null);

		// Parse IDs filter if provided
		const idsFilter = filters.ids 
			? {
				id: {
					in: filters.ids.split(',').map(id => Number.parseInt(id.trim(), 10)).filter(id => !Number.isNaN(id))
				}
			}
			: {};

		// Build nsfw filter for popular path
		const popularNsfwFilter = filters.nsfw === 'true'
			? (organizationId
				? {}  // En página de org /red/: sin filtro adicional
				: { OR: [{ isNSFW: true }, { organization: { isNSFW: true } }] })
			: filters.nsfw === 'false'
			? (organizationId
				? { isNSFW: false }
				: { isNSFW: false, organization: { isNSFW: false } })
			: {};

		// Hide deactivated orgs (isPublic=false or isDeleted=true) from global
		// listings. Org-specific paths skip this — middleware already gates.
		const popularOrgVisibility = !organizationId
			? [{ organization: { isPublic: true, isDeleted: false } }]
			: [];

		// Fetch only the paginated mangas with their relations
		const popularMangasCustoms = await prisma.mangaCustom.findMany({
			where: {
				id: {
					in: paginatedIds,
				},
				deletedAt: null,
				...popularNsfwFilter,
				...(popularOrgVisibility.length > 0 ? { AND: popularOrgVisibility } : {}),
				...(filters.search ? searchConditions : {}),
				...(filters.title ? {
					title: {
						contains: filters.title,
						mode: Prisma.QueryMode.insensitive
					}
				} : {}),
				...(filters.shortDescription ? {
					shortDescription: {
						contains: filters.shortDescription,
						mode: Prisma.QueryMode.insensitive
					}
				} : {}),
				...(filters.description ? {
					description: {
						contains: filters.description,
						mode: Prisma.QueryMode.insensitive
					}
				} : {}),
				...(filters.status ? {
					status: filters.status,
				} : {}),
				...(filters.genre ? {
					genres: {
						some: {
							name: {
								equals: filters.genre,
								mode: Prisma.QueryMode.insensitive,
							}
						}
					}
				} : {}),
				...idsFilter,
			},
			include: {
				manga: {
					include: {
						demography: {
							select: {
								name: true,
								slug: true,
							},
						},
					},
				},
				organization: {
					select: {
						id: true,
						name: true,
						slug: true,
						title: true,
						isNSFW: true,
					},
				},
				chapters: {
					where: { deletedAt: null },
					select: {
						id: true,
						number: true,
						title: true,
						releasedAt: true,
					},
					orderBy: {
						number: Prisma.SortOrder.desc,
					},
					take: 2,
				},
				genres: {
					select: {
						id: true,
						slug: true,
						name: true,
					}
				},
				subscriptionPlansCanReadUnreleased: {
					select: {
						id: true,
						name: true,
					}
				},
				subscriptionPlansCanReadReleased: {
					select: {
						id: true,
						name: true,
					}
				},
			},
		});

		// Sort by view count order
		const viewCountMap = new Map(viewCounts.map(v => [v.mangaCustomId, v._count.ip]));
		const sortedMangas = popularMangasCustoms.sort((a, b) => 
			(viewCountMap.get(b.id) || 0) - (viewCountMap.get(a.id) || 0)
		);

		return {
			data: sortedMangas,
			maxPage: Math.ceil(viewCounts.length / Number.parseInt(filters?.limit || "10")),
			total: viewCounts.length,
		};
	}


	// Parse IDs filter if provided
	const idsFilter = filters.ids 
		? {
			id: {
				in: filters.ids.split(',').map(id => Number.parseInt(id.trim(), 10)).filter(id => !Number.isNaN(id))
			}
		}
		: {};

	// nsfw=false: excluir mangas NSFW
	// nsfw=true + org específica: mostrar todo (la ruta /red/ ya valida adultos, no filtrar más)
	// nsfw=true + sin org (global): mostrar mangas NSFW o de orgs NSFW
	const nsfwFilter = filters.nsfw === 'true'
		? (organizationId
			? {}  // En página de org /red/: sin filtro adicional, mostrar todo
			: { OR: [{ isNSFW: true }, { organization: { isNSFW: true } }] })
		: filters.nsfw === 'false'
		? (organizationId
			? { isNSFW: false }
			: { isNSFW: false, organization: { isNSFW: false } })
		: {};

	// Build soft-delete filter
	const deletedFilter = filters.showDeleted === 'true'
		? { deletedAt: { not: null } }
		: { deletedAt: null };

	// Hide deactivated orgs (isPublic=false or isDeleted=true) from global
	// listings. Org-specific paths skip this — middleware already gates.
	const orgVisibilityAnds = !organizationId
		? [{ organization: { isPublic: true, isDeleted: false } }]
		: [];

	// Build common where clause
	const whereClause = {
		...deletedFilter,
		...(filters.type ? {
			manga: {
				bookType: {
					code: filters.type
				}
			}
		} : filters.contentKind === 'writing' ? {
			manga: { bookType: { code: { in: ['novel', 'light-novel', 'book', 'short-story'] } } }
		} : filters.contentKind === 'manga' ? {
			manga: { bookType: { code: { notIn: ['novel', 'light-novel', 'book', 'short-story'] } } }
		} : {}),
		...(organizationId ? {
			organization: {
				id: organizationId,
			},
		} : {}),
		...nsfwFilter,
		...(orgVisibilityAnds.length > 0 ? { AND: orgVisibilityAnds } : {}),
		...(filters.search ? searchConditions : {}),
		...(filters.title ? {
			title: {
				contains: filters.title,
				mode: Prisma.QueryMode.insensitive
			}
		} : {}),
		...(filters.shortDescription ? {
			shortDescription: {
				contains: filters.shortDescription,
				mode: Prisma.QueryMode.insensitive
			}
		} : {}),
		...(filters.description ? {
			description: {
				contains: filters.description,
				mode: Prisma.QueryMode.insensitive
			}
		} : {}),
		...(filters.status ? {
			status: filters.status,
		} : {}),
		...(filters.genre ? {
			genres: {
				some: {
					name: {
						equals: filters.genre,
						mode: Prisma.QueryMode.insensitive,
					}
				}
			}
		} : {}),
		...idsFilter,
	};

	// Use Promise.all to run queries in parallel
	const [mangasCustoms, total] = await Promise.all([
		prisma.mangaCustom.findMany({
			where: whereClause,
			include: {
				manga: {
					include: {
						demography: {
							select: {
								name: true,
								slug: true,
							},
						},
					},
				},
				organization: {
					select: {
						id: true,
						name: true,
						slug: true,
						title: true,
						isNSFW: true,
					},
				},
				chapters: {
					where: { deletedAt: null },
					select: {
						id: true,
						number: true,
						title: true,
						releasedAt: true,
						views: true,
					},
					orderBy: {
						number: Prisma.SortOrder.desc,
					},
					take: 2,
				},
				genres: {
					select: {
						id: true,
						slug: true,
						name: true,
					}
				},
				subscriptionPlansCanReadUnreleased: {
					select: {
						id: true,
						name: true,
					}
				},
			},
			...(order || {}),
			skip: filters?.page ? (Number.parseInt(filters?.page || "1") - 1) * Number.parseInt(filters?.limit || "10") : 0,
			take: Number.parseInt(filters?.limit || "10"),
		}),
		prisma.mangaCustom.count({
			where: whereClause,
		})
	]);

	return {
		data: mangasCustoms,
		maxPage: Math.ceil(total / Number.parseInt(filters?.limit || "10")),
		total,
	};
};
