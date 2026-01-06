import { Elysia, t } from "elysia";
import { logged } from "../../plugins/auth";
import { useOrganizationOptional } from "../../plugins/organization";
import { generatePresignedUploadUrl, getContentType } from "../../services/files";

export const router = () =>
  new Elysia()
    .use(logged())
    .use(useOrganizationOptional())
    .post(
      "/api/files/presigned-url",
      async ({ body: { filename, contentType, expiresIn, contentFolder }, request: { headers }, organizationId }) => {
        if (!filename) {
          throw new Error("Filename is required.");
        }

        // Validate filename doesn't contain path traversal
        if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
          throw new Error("Invalid filename.");
        }

        // If contentType is not provided, try to infer it from filename
        const finalContentType = contentType || getContentType(filename);

        // Get organization domain from headers
        const organizationDomain = headers.get('x-organization') || undefined;

        try {
          const { uploadUrl, fileKey } = await generatePresignedUploadUrl(
            filename,
            finalContentType,
            expiresIn || 3600,
            organizationDomain,
            organizationId,
            contentFolder
          );

          return {
            status: true,
            data: {
              uploadUrl,
              fileKey,
            },
          };
        } catch (error) {
          console.error("Error generating presigned URL:", error);
          throw new Error("Failed to generate upload URL.");
        }
      },
      {
        body: t.Object({
          filename: t.String(),
          contentType: t.Optional(t.String()),
          expiresIn: t.Optional(t.Number()),
          contentFolder: t.Optional(t.String()),
        }),
      }
    );

