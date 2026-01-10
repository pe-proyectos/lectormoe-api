import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

import { logger } from "./plugins/logger";
import { errorHandler } from "./plugins/error";
import { router } from "./routes/router";

export const app = new Elysia()
  .use(cors())
  .use(logger({ logIP: true }))
  .use(errorHandler())
  .use(router());

export type App = typeof app;
