import { Elysia } from "elysia";
import { readdir } from "fs/promises";

export const router = () => async (app: Elysia) => {
	const folders = await readdir("./src/routes");
	for (const folder of folders) {
		if (folder.includes(".")) continue;
		const files = await readdir(`./src/routes/${folder}`);
		for (const file of files) {
			const { router } = await import(`./${folder}/${file}`);
			if (!router) continue;
			app.group("", (app) => app.use(router()));
		}
	}
	console.log(
		`Loaded routes: \n${app.routes
			.filter((route) => route.method !== "OPTIONS")
			.map((route) => `\t- ${route.method}: ${route.path}`)
			.join("\n")}`,
	);
	return app;
};
