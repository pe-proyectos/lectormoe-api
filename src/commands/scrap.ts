import { DOMParser } from "linkedom";
import { parseArgs } from "util";

const { positionals } = parseArgs({
	args: Bun.argv,
	strict: true,
	allowPositionals: true,
});

const [_runtime, _path, manga_name] = positionals;

console.log({ _runtime, _path, manga });

async function scrapPages(
	chapter: any,
	mangaSlug: string,
	chapter_number: string,
	page: number,
) {
	if (!chapter_number) {
		return chapter;
	}
	if (!page) {
		return chapter;
	}
	// console.log(`Scraping chapter: ${mangaSlug} - ${chapter_number} - ${page}`);
	const imageUrl = `https://mangadoor.com/uploads/manga/${mangaSlug}/chapters/${chapter_number}/${page}.jpg`;
	const f = await fetch(imageUrl);
	if (f.status == 404) {
		return chapter;
	}
	if (!chapter.pages) {
		chapter.pages = [];
	}
	chapter.pages.push({
		page,
		imageUrl,
	});
	return await scrapPages(chapter, mangaSlug, chapter_number, page + 1);
}

async function scrapManga(manga: any) {
	try {
		console.log(`Scraping manga: ${manga.url}`);
		const f = await fetch(manga.url);
		const html = await f.text();
		const parser = new DOMParser();
		const document = parser.parseFromString(html, "text/html");
		const title = document.querySelector(".widget-title").innerText;
		const description = document.querySelector(".well p")?.innerText || "";
		const categories =
			[...document.querySelectorAll("dt")]
				.find((elem) => elem.innerText.startsWith("Categor"))
				?.nextElementSibling.innerText.split(",")
				.map((category: string) => category.trim()) ?? [];
		const author =
			[...document.querySelectorAll("dt")]
				.find((elem) => elem.innerText.startsWith("Autor"))
				?.nextElementSibling.innerText.trim() ?? "";
		const status =
			[...document.querySelectorAll("dt")]
				.find((elem) => elem.innerText.startsWith("Estado"))
				?.nextElementSibling.innerText.trim() ?? "";
		const chapters = [...document.querySelectorAll(".chapter-title-rtl")].map(
			(elem) => ({
				url: elem.querySelector("a").href,
				title: elem.querySelector("em").innerText,
				date: elem.nextElementSibling
					?.querySelector(".date-chapter-title-rtl")
					.innerText.trim(),
				download_url: elem.nextElementSibling?.querySelector("a").href,
			}),
		);

		const chaptersDetails = await Promise.all(
			chapters.map((chapter) =>
				scrapPages(
					chapter,
					manga.url.split("/").pop(),
					chapter.url.split("/").pop(),
					1,
				),
			),
		);

		console.log({
			...manga,
			title,
			description,
			author,
			status,
			categories,
			chapters: chaptersDetails.length,
		});

		return {
			...manga,
			success: true,
			title,
			description,
			author,
			status,
			categories,
			chapters: chaptersDetails,
		};
	} catch (error) {
		console.error(error);
		console.log(manga);
		console.log(`Error scraping manga: ${manga.url}`);
		return {
			...manga,
			success: false,
			error: JSON.stringify(error),
		};
	}
}

async function scrapList(data: any, page: number) {
	const f = await fetch(`https://mangadoor.com/type/manga/${page}`);
	const html = await f.text();
	const parser = new DOMParser();
	const document = parser.parseFromString(html, "text/html");
	const mangas = [...document.querySelectorAll(".element")].map((elem) => {
		return {
			title: elem.querySelector(".thumbnail-title h4").getAttribute("title"),
			url: elem.querySelector("a").href,
			book_type: elem.querySelector(".book-type").innerText.toLowerCase(),
			demography: elem
				.querySelector(".demography")
				.classList.value.replace("demography", "")
				.trim()
				.toLowerCase(),
			imageUrl: elem
				.querySelector("style")
				.innerText.split("url('")
				.pop()
				.split("'")
				.shift(),
		};
	});
	const nextPage = parseInt(
		[...document.querySelectorAll(".page-link")].pop().href.split("/").pop(),
	);

	const mangaDetails = await Promise.all(
		mangas.map((manga) => scrapManga(manga)),
	);
	data.push(...mangaDetails);

	console.log(`Page ${page} nextPage ${nextPage} - ${data.length} mangas`);

	if (page >= nextPage || isNaN(nextPage)) {
		return data;
	}
	Bun.write("mangas.json", JSON.stringify(data, null, 2));
	return await scrapList(data, nextPage);
}

let result = await scrapList([], 1);

console.log(`Total: ${result.length} mangas`);

const types = [...new Set(result.map((r: any) => r.book_type))];
console.log(`Types: ${types.join(", ")}`);
const demographies = [...new Set(result.map((r: any) => r.demography))];
console.log(`Demographies: ${demographies.join(", ")}`);

Bun.write("mangas.json", JSON.stringify(result, null, 2));
