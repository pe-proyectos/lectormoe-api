import { listMangaCustom } from '../controllers/manga-custom/list'
import { prisma } from '../models/prisma'

for (const term of ['blue lock', 'accion', 'one punch']) {
  const res = await listMangaCustom(null, {
    search: term,
    nsfw: 'false',
    limit: '8'
  } as any)
  console.log(`\n=== "${term}" (${res.total}) ===`)
  for (const m of res.data.slice(0, 8)) console.log(`  ${m.title}`)
}

await prisma.$disconnect()
process.exit(0)
