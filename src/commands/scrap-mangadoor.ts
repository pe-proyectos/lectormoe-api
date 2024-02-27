import { DOMParser } from "linkedom";
import { parseArgs } from "util";
import { prisma } from "../models/prisma";
import slugify from "slugify";

const { positionals } = parseArgs({
	args: Bun.argv,
	strict: true,
	allowPositionals: true,
});

const [_runtime, _path, scrap_manga_slug] = positionals;

console.log({ _runtime, _path, scrap_manga_slug });

async function scrapPages(
	chapter: any,
	manga_slug: string,
	chapter_number: string,
	page: number,
) {
	if (!chapter_number) {
		return chapter;
	}
	if (!page) {
		return chapter;
	}
	console.log(`Scraping page: ${manga_slug} - #${chapter_number} - ${page}`);
	let image_url = `https://mangadoor.com/uploads/manga/${manga_slug}/chapters/${chapter_number}/${page}.jpg`;
	const f = await fetch(image_url);
	if (f.status == 404) {
		image_url = `https://mangadoor.com/uploads/manga/${manga_slug}/chapters/${chapter_number}/${page}.webp`;
		const fWebP = await fetch(image_url);
		if (fWebP.status == 404) {
			image_url = `https://mangadoor.com/uploads/manga/${manga_slug}/chapters/${chapter_number}/${page}.png`;
			const fPNG = await fetch(image_url);
			if (fPNG.status == 404) {
				image_url = `https://mangadoor.com/uploads/manga/${manga_slug}/chapters/${chapter_number}/${page}.jpeg`;
				const fJPEG = await fetch(image_url);
				if (fJPEG.status == 404) {
					return chapter;
				}
			}
		}
	}
	if (!chapter.pages) {
		chapter.pages = [];
	}
	chapter.pages.push({
		page,
		image_url,
	});
	return await scrapPages(chapter, manga_slug, chapter_number, page + 1);
}

console.log(`Scraping manga: ${scrap_manga_slug}`);
const f = await fetch("https://mangadoor.com/manga/" + scrap_manga_slug);
const html = await f.text();
const parser = new DOMParser();
const document = parser.parseFromString(html, "text/html");
const image_url = document.querySelector(".boxed img").getAttribute("data-src");
const title = document.querySelector(".widget-title").innerText;
const description = document.querySelector(".well p")?.innerText || "";
const categories =
	[...document.querySelectorAll("dt")]
		.find((elem) => elem.innerText.startsWith("Categor"))
		?.nextElementSibling.innerText.split(",")
		.map((category: string) => category.trim()) ?? [];
const author_name =
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
			scrap_manga_slug,
			chapter.url.split("/").pop(),
			1,
		),
	),
);

console.log({
	title,
	description,
	author_name,
	status,
	categories,
	image_url,
	chaptersDetails
});

function toSlug(str: string) {
	return slugify(str, {
		remove: /[*+~.()'"!:@]/g,
		lower: true,
		strict: true,
		trim: true,
	});
}

let author = await prisma.author.findFirst({
	where: {
		slug: toSlug(author_name),
	},
});

if (!author) {
	console.log(`Creating author: ${author_name}`);
	author = await prisma.author.create({
		data: {
			name: author_name,
			slug: toSlug(author_name),
			description: "",
			short_description: "",
			image_url: "",
		},
	});
}

let manga = await prisma.manga.findFirst({
	where: {
		slug: toSlug(title),
	},
});

if (!manga) {
	console.log(`Creating manga: ${title}`);
	
	manga = await prisma.manga.create({
		data: {
			title,
			demography_id: 1,
			slug: toSlug(title),
			description,
			short_description: "",
			image_url,
			author_id: author.id,
		},
	});
}

for (const chapter_data of chaptersDetails) {
	console.log({ chapter_data });

	if (!chapter_data) {
		continue;
	}
	if (!chapter_data.pages) {
		continue;
	}
	if (chapter_data.url.split("/").pop().includes("-")) {
		continue;
	}


	let chapter  = await prisma.chapter.findFirst({
		where: {
			slug: toSlug(chapter_data.title),
			manga_id: manga.id,
		},
	});

	if (!chapter) {
		console.log(`Creating chapter: ${chapter_data.title}`);
		chapter = await prisma.chapter.upsert({
			where: {
				slug: toSlug(chapter_data.title),
				manga_id: manga.id,
			},
			create: {
				title: chapter_data.title,
				slug: toSlug(chapter_data.title),
				number: parseFloat(chapter_data.url.split("/").pop()),
				image_url: chapter_data?.pages[0]?.image_url || image_url,
				manga_id: manga.id,
			},
			update: {
				title: chapter_data.title,
				number: parseFloat(chapter_data.url.split("/").pop()),
				image_url: chapter_data?.pages[0]?.image_url || image_url,
			}
		});
	}

	for (const page of chapter_data.pages) {
		let page_ = await prisma.page.findFirst({
			where: {
				chapter_id: chapter.id,
				number: page.page,
			},
		});

		if (!page_) {
			console.log(`Creating page: ${page.page}`);
			page_ = await prisma.page.create({
				data: {
					image_url: page.image_url,
					number: page.page,
					chapter_id: chapter.id,
				},
			});
		}
	}
}

console.log('done.');
