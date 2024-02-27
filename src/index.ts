import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { logger } from '@grotto/logysia';

import { router } from "./routes/router";

export const app = new Elysia()
	.use(cors())
	.use(logger({ logIP: true }))
	.onError(({ code, error }) => {
		if (code === 'VALIDATION') {
			try {
				const validation = JSON.parse(error.message);
				return {
					status: false,
					data: {
						error: code,
						message: `[${validation.at}] ${validation?.message}`,
					}
				};
			} catch (err) {
				return {
					status: false,
					data: {
						error: error?.code || code,
						message: error?.message,
					}
				};
			}
		}
		if (code !== 'NOT_FOUND') {
			console.trace(error);
			console.error('not found')
		}
		return {
			status: false,
			data: {
				error: code,
				message: error?.message,
			}
		};
	})
	.use(router())
	.listen(parseInt(process.env.PORT as string));

console.info(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
