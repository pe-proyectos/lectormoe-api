// Limpia banners que quedaron apuntando a la URL base de R2 sin ningun archivo
// (`https://r2.capibaratraductor.com/`). Se producian cuando el formulario
// enviaba banner:"" y el backend lo concatenaba igual; el navegador los pinta
// como imagen rota, y como las tarjetas prefieren el banner sobre la portada,
// la obra aparecia sin imagen aunque su portada estuviera perfecta.
//
// Poner el banner a NULL es no destructivo: la tarjeta cae a la portada.
// Uso:  bun src/scripts/fix-broken-banner-urls.ts [--apply]
import { prisma } from '../models/prisma'

const aplicar = process.argv.includes('--apply')
const ROTA = /^https?:\/\/[^/]+\/?$/

const candidatas = await prisma.mangaCustom.findMany({
  where: { deletedAt: null, bannerUrl: { not: null } },
  select: { id: true, title: true, bannerUrl: true, imageUrl: true, organization: { select: { slug: true } } },
})

const rotas = candidatas.filter((m) => ROTA.test(String(m.bannerUrl)))
const sinPortada = rotas.filter((m) => !m.imageUrl)

for (const m of rotas.slice(0, 15)) {
  console.log(`  ${m.organization.slug.padEnd(24)} | ${String(m.title).slice(0, 44)}`)
}
if (rotas.length > 15) console.log(`  ... y ${rotas.length - 15} mas`)

console.log(`\nbanners rotos: ${rotas.length}`)
console.log(`de esos, sin portada de respaldo: ${sinPortada.length}`)

if (aplicar && rotas.length > 0) {
  await prisma.mangaCustom.updateMany({
    where: { id: { in: rotas.map((m) => m.id) } },
    data: { bannerUrl: null },
  })
  console.log('Aplicado: banners puestos a NULL, las tarjetas usaran la portada.')
} else {
  console.log(aplicar ? 'Nada que hacer.' : 'DRY-RUN. Vuelve a correrlo con --apply para escribir.')
}

await prisma.$disconnect()
process.exit(0)
