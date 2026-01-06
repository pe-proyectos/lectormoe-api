import { prisma } from '../models/prisma';

async function updateUsersAlsoRead() {
    try {
        console.log('🚀 Starting update of usersAlsoReadMangaCustomIds...');

        // Get all MangaCustoms
        const mangaCustoms = await prisma.mangaCustom.findMany({
            select: {
                id: true,
                title: true,
            },
        });

        console.log(`Found ${mangaCustoms.length} MangaCustoms to process`);

        let processedCount = 0;
        let errorCount = 0;

        for (const mangaCustom of mangaCustoms) {
            try {
                console.log(`\n📚 Processing MangaCustom ${mangaCustom.id}: ${mangaCustom.title}`);

                // Get all chapters for this MangaCustom
                const chapters = await prisma.chapter.findMany({
                    where: {
                        mangaCustomId: mangaCustom.id,
                    },
                    select: {
                        id: true,
                    },
                });

                if (chapters.length === 0) {
                    console.log(`  ⚠️  No chapters found, skipping...`);
                    continue;
                }

                const chapterIds = chapters.map((c) => c.id);

                // Get top 10 users who have read the most chapters of this MangaCustom
                // Count distinct chapters read per user
                const userReadCounts = await prisma.userChapterHistory.groupBy({
                    by: ['userId'],
                    where: {
                        chapterId: {
                            in: chapterIds,
                        },
                    },
                    _count: {
                        chapterId: true,
                    },
                    orderBy: {
                        _count: {
                            chapterId: 'desc',
                        },
                    },
                    take: 10,
                });

                if (userReadCounts.length === 0) {
                    console.log(`  ⚠️  No users found who read this MangaCustom, skipping...`);
                    // Clear the field if no users
                    await prisma.mangaCustom.update({
                        where: { id: mangaCustom.id },
                        data: { usersAlsoReadMangaCustomIds: null },
                    });
                    continue;
                }

                const topUserIds = userReadCounts.map((u) => u.userId);
                console.log(`  👥 Found ${topUserIds.length} top readers`);

                // For each of these users, get their reading history
                // and find the top 3 other MangaCustoms they read (excluding current one)
                const mangaCustomCounts: Record<number, number> = {};

                for (const userId of topUserIds) {
                    // Get all chapters this user has read
                    const userHistory = await prisma.userChapterHistory.findMany({
                        where: {
                            userId,
                        },
                        select: {
                            chapter: {
                                select: {
                                    mangaCustomId: true,
                                },
                            },
                        },
                    });

                    // Count MangaCustoms read by this user (excluding current one)
                    const userMangaCustomCounts: Record<number, number> = {};
                    for (const history of userHistory) {
                        const mcId = history.chapter.mangaCustomId;
                        if (mcId !== mangaCustom.id) {
                            userMangaCustomCounts[mcId] = (userMangaCustomCounts[mcId] || 0) + 1;
                        }
                    }

                    // Get top 3 MangaCustoms for this user
                    const top3ForUser = Object.entries(userMangaCustomCounts)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 3)
                        .map(([id]) => Number.parseInt(id, 10));

                    // Add to global counts
                    for (const mcId of top3ForUser) {
                        mangaCustomCounts[mcId] = (mangaCustomCounts[mcId] || 0) + 1;
                    }
                }

                // Get top 3 MangaCustoms from all collected
                const top3MangaCustomIds = Object.entries(mangaCustomCounts)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3)
                    .map(([id]) => Number.parseInt(id, 10));

                console.log(`  ✅ Top 3 MangaCustoms: ${top3MangaCustomIds.join(', ')}`);

                // Update the MangaCustom with the top 3 IDs as comma-separated string
                await prisma.mangaCustom.update({
                    where: { id: mangaCustom.id },
                    data: {
                        usersAlsoReadMangaCustomIds: top3MangaCustomIds.length > 0 
                            ? top3MangaCustomIds.join(',') 
                            : null,
                    },
                });

                processedCount++;
            } catch (error) {
                console.error(`  ❌ Error processing MangaCustom ${mangaCustom.id}:`, error);
                errorCount++;
            }
        }

        console.log(`\n✅ Successfully processed ${processedCount} MangaCustoms`);
        if (errorCount > 0) {
            console.log(`⚠️  ${errorCount} errors occurred`);
        }
    } catch (error) {
        console.error('❌ Error updating usersAlsoReadMangaCustomIds:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the command if executed directly
if (import.meta.main) {
    updateUsersAlsoRead();
}

export { updateUsersAlsoRead };

