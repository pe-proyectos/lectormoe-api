import { Elysia, t } from "elysia";
import { loggedUserOnlyGlobal } from "../../plugins/auth";
import { docxToMarkdown } from "../../services/markdown-pipeline";

const MAX_BYTES = 10 * 1024 * 1024;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// PK\x03\x04 — every .docx is a zip; bytes 0-3 are the local file header signature.
const isZipMagic = (bytes: Uint8Array): boolean =>
  bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

export const router = () =>
  new Elysia()
    .use(loggedUserOnlyGlobal())
    .post(
      "/api/files/parse-docx",
      async ({ body, request }) => {
        const file = body.file as File | undefined;
        if (!file) throw new Error("Falta el archivo.");
        if (file.size > MAX_BYTES) throw new Error("Archivo .docx demasiado grande (máx 10MB).");
        if (file.type && file.type !== DOCX_MIME) {
          throw new Error("Tipo MIME inválido para .docx.");
        }
        const arrayBuf = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        if (!isZipMagic(bytes)) throw new Error("El archivo no parece un .docx válido.");
        const organizationSlug = request.headers.get("x-organization") || undefined;
        const { markdown, images, warnings } = await docxToMarkdown(Buffer.from(bytes), {
          organizationSlug,
        });
        return { status: true, data: { markdown, chars: markdown.length, images, warnings } };
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
            images: t.Number(),
            warnings: t.Array(t.String()),
          }),
        }),
      }
    );
