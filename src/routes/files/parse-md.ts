import { Elysia, t } from "elysia";
import { loggedUserOnlyGlobal } from "../../plugins/auth";
import { sanitizeMarkdownInput } from "../../services/markdown-pipeline";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIMES = new Set(["text/markdown", "text/plain", "application/octet-stream", ""]);

export const router = () =>
  new Elysia()
    .use(loggedUserOnlyGlobal())
    .post(
      "/api/files/parse-md",
      async ({ body }) => {
        const file = body.file as File | undefined;
        if (!file) throw new Error("Falta el archivo.");
        if (file.size > MAX_BYTES) throw new Error("Archivo .md demasiado grande (máx 2MB).");
        const mime = file.type || "";
        if (!ALLOWED_MIMES.has(mime) && !file.name?.toLowerCase().endsWith(".md")) {
          throw new Error("Tipo MIME inválido para .md.");
        }
        const text = await file.text();
        const markdown = sanitizeMarkdownInput(text);
        return { status: true, data: { markdown, chars: markdown.length } };
      },
      {
        body: t.Object({
          file: t.Any(),
        }),
        response: t.Object({
          status: t.Boolean(),
          data: t.Object({
            markdown: t.String(),
            chars: t.Number(),
          }),
        }),
      }
    );
