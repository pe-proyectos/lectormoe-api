import { uploadFile as uploadFileToR2 } from "../services/files";

export async function uploadFile(
    fileBuffer: ArrayBuffer | Buffer, 
    filename: string,
    organizationDomain?: string,
    organizationId?: number,
    contentFolder?: string
): Promise<string> {
    return await uploadFileToR2(fileBuffer, filename, organizationDomain, organizationId, contentFolder);
}
