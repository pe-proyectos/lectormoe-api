import { app } from "./app";

const server = app.listen(Number.parseInt(process.env.PORT as string));

console.info(
	`🦊 Elysia is running at ${server.server?.hostname}:${server.server?.port}`,
);
