import { uploadFile as uploadFileToR2 } from "../services/files";

export async function uploadFile(
    fileBuffer: ArrayBuffer | Buffer,
    filename: string,
    organizationSlug?: string,
    organizationId?: number,
    contentFolder?: string
): Promise<string> {
    return await uploadFileToR2(fileBuffer, filename, organizationSlug, organizationId, contentFolder);
}
