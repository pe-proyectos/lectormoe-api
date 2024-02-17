import rawData from "../../mangas.json" with { type: "json" };

const data = [];

for (const manga of rawData as any[]) {
	if (
		manga.chapters.filter((c: any) => !!c.pages).length == manga.chapters.length
	) {
		if (manga.chapters.length > 10) {
			data.push(manga);
		}
	}
}

console.log(data.map((c) => c.chapters.length));

Bun.write("pages_mangas.json", JSON.stringify(data, null, 2));
