import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

import { logger } from "./plugins/logger"; // replace with '@grotto/logysia' when it's updated
import { errorHandler } from "./plugins/error";
import { router } from "./routes/router";

export const app = new Elysia()
	.use(cors())
	.use(logger({ logIP: true }))
	.use(errorHandler())
	.use(router())
	.listen(parseInt(process.env.PORT as string));

console.info(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
