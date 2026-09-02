import { Elysia, t } from "elysia";
import { loggedUserOnlyGlobal } from "../../plugins/auth";
import { parseEpub } from "../../services/epub-pipeline";

const MAX_BYTES = 50 * 1024 * 1024; // 50MB
const EPUB_MIME = "application/epub+zip";

// PK\x03\x04 — un EPUB es un zip; bytes 0-3 son la firma del header local.
const isZipMagic = (bytes: Uint8Array): boolean =>
  bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

export const router = () =>
  new Elysia()
    .use(loggedUserOnlyGlobal())
    .post(
      "/api/files/parse-epub",
      async ({ body, request }) => {
        const file = body.file as File | undefined;
        if (!file) throw new Error("Falta el archivo.");
        if (file.size > MAX_BYTES) throw new Error("Archivo .epub demasiado grande (máx 50MB).");
        if (file.type && file.type !== EPUB_MIME && !file.name?.toLowerCase().endsWith(".epub")) {
          throw new Error("Tipo MIME inválido para .epub.");
        }
        const arrayBuf = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        if (!isZipMagic(bytes)) throw new Error("El archivo no parece un .epub válido.");
        const organizationSlug = request.headers.get("x-organization") || undefined;
        const result = await parseEpub(Buffer.from(bytes), { organizationSlug });
        return {
          status: true,
          data: {
            bookTitle: result.bookTitle,
            images: result.images,
            warnings: result.warnings,
            chapters: result.chapters,
          },
        };
      },
      {
        body: t.Object({
          file: t.Any(),
        }),
        response: t.Object({
          status: t.Boolean(),
          data: t.Object({
            bookTitle: t.Union([t.String(), t.Null()]),
            images: t.Number(),
            warnings: t.Array(t.String()),
            chapters: t.Array(
              t.Object({
                number: t.Number(),
                title: t.String(),
                volumeNumber: t.Union([t.Number(), t.Null()]),
                bodyMarkdown: t.String(),
              })
            ),
          }),
        }),
      }
    );
