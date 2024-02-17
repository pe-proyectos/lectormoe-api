import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { logger } from '@grotto/logysia';

import { router } from "./routes/router";

export const start = async () => {
	const app = new Elysia()
		.use(cors())
        .use(logger({ logIP: true }))
		.onError(({ code, error }) => {
			if (code === 'VALIDATION') {
				try {
					const validation = JSON.parse(error.message);
					return {
						status: false,
						code,
						error: `[${validation.at}] ${validation?.message}`,
					};
				} catch (err) {
					return {
						status: false,
						code,
						error: error?.message,
					};
				}
			}
			if (code !== 'NOT_FOUND') {
				console.trace(error);
				console.error('not found')
			}
			return {
				status: false,
				code,
				error: error.message,
			};
		})
		.use(router())
		.listen(parseInt(process.env.PORT as string));

	console.info(
		`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
	);

	return app;
};
