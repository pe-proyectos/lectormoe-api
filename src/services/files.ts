import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "../models/prisma";

// Initialize S3 client for Cloudflare R2
// IMPORTANT: Presigned URLs MUST use the original R2 endpoint, not custom domain
// Custom domains don't work with presigned URLs because the signature is tied to the endpoint
// Public URLs use FILE_DOWNLOAD_ENDPOINT if configured, otherwise R2 public endpoint: https://pub-{ACCOUNT_ID}.r2.dev
const r2Endpoint = `https://${Bun.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// S3 client for API operations (uploads, downloads, presigned URLs)
// Always use the original R2 endpoint for S3 API operations
const s3Client = new S3Client({
    region: "auto",
    endpoint: r2Endpoint,
    credentials: {
        accessKeyId: Bun.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: Bun.env.R2_SECRET_ACCESS_KEY || "",
    },
    forcePathStyle: false, // Use virtual-hosted-style (bucket.domain.com)
});

const bucket = Bun.env.R2_BUCKET_NAME || "";

if (!bucket) {
    console.warn("R2_BUCKET_NAME environment variable is not set");
}

/**
 * Extract tenant name from organization domain
 * @param domain - The organization domain (e.g., "senshimanga.capibaratraductor.com")
 * @returns The tenant name or null if it's the base domain
 */
function getTenantNameFromDomain(domain: string): string | null {
    const baseDomain = Bun.env.PUBLIC_BASE_DOMAIN || "capibaratraductor.com";
    const normalizedDomain = domain.startsWith("www.") ? domain.substring(4) : domain;
    const normalizedBaseDomain = baseDomain.startsWith("www.") ? baseDomain.substring(4) : baseDomain;
    
    // If it's the base domain, return null (no tenant)
    if (normalizedDomain === normalizedBaseDomain) {
        return null;
    }
    
    // Extract subdomain (tenant name)
    if (normalizedDomain.endsWith(`.${normalizedBaseDomain}`)) {
        const tenantName = normalizedDomain.replace(`.${normalizedBaseDomain}`, '');
        // Sanitize tenant name for use in file paths
        return tenantName.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
    }
    
    return null;
}

/**
 * Get organization domain from organizationId
 * @param organizationId - The organization ID
 * @returns The organization domain or null
 */
async function getOrganizationDomain(organizationId?: number): Promise<string | null> {
    if (!organizationId) {
        return null;
    }
    
    try {
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { domain: true }
        });
        return organization?.domain || null;
    } catch (error) {
        console.error('Error getting organization domain:', error);
        return null;
    }
}

/**
 * Generate a presigned URL for direct upload to R2
 * @param filename - The filename to use for the upload
 * @param contentType - The content type of the file
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @param organizationDomain - Optional organization domain to organize files by tenant
 * @param organizationId - Optional organization ID (will fetch domain if domain not provided)
 * @param contentFolder - Optional folder name for content type (e.g., 'profile_pictures', 'chapters', 'mangas')
 * @returns Object with uploadUrl and fileKey
 */
export async function generatePresignedUploadUrl(
    filename: string,
    contentType: string,
    expiresIn: number = 3600,
    organizationDomain?: string,
    organizationId?: number,
    contentFolder?: string
): Promise<{ uploadUrl: string; fileKey: string }> {
    if (!bucket) {
        throw new Error("R2_BUCKET_NAME environment variable is not set");
    }

    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000000) + 1;
    const extension = filename.split('.').pop();
    
    // Sanitize content folder name
    const sanitizedContentFolder = contentFolder ? contentFolder.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase() : 'general';
    
    // Some content types are global and should never be tenant-specific
    // User profiles and comments are global across all organizations
    const globalContentFolders = ['profile_pictures', 'avatars', 'comments'];
    const isGlobalContent = globalContentFolders.includes(sanitizedContentFolder);
    
    // Get organization domain if not provided but organizationId is (only for non-global content)
    let finalOrganizationDomain = organizationDomain;
    if (!isGlobalContent && !finalOrganizationDomain && organizationId) {
        finalOrganizationDomain = await getOrganizationDomain(organizationId) || undefined;
    }
    
    // Get tenant name from domain if provided (only for non-global content)
    const tenantName = !isGlobalContent && finalOrganizationDomain ? getTenantNameFromDomain(finalOrganizationDomain) : null;
    
    // Build file key with tenant and content folder structure
    const fileKey = tenantName 
        ? `tenants/${tenantName}/${sanitizedContentFolder}/${timestamp}_${random}.${extension}`
        : `${sanitizedContentFolder}/${timestamp}_${random}.${extension}`;

    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: fileKey,
        ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

    return {
        uploadUrl,
        fileKey,
    };
}

/**
 * Upload file to R2 (for server-side uploads)
 * @param fileBuffer - The file buffer to upload
 * @param filename - The filename
 * @param organizationDomain - Optional organization domain to organize files by tenant
 * @param organizationId - Optional organization ID (will fetch domain if domain not provided)
 * @param contentFolder - Optional folder name for content type (e.g., 'profile_pictures', 'chapters', 'mangas')
 * @returns The file URL
 */
export async function uploadFile(
    fileBuffer: ArrayBuffer | Buffer, 
    filename: string,
    organizationDomain?: string,
    organizationId?: number,
    contentFolder?: string
): Promise<string> {
    if (!bucket) {
        throw new Error("R2_BUCKET_NAME environment variable is not set");
    }

    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000000) + 1;
    const extension = filename.split('.').pop();
    
    // Sanitize content folder name
    const sanitizedContentFolder = contentFolder ? contentFolder.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase() : 'general';
    
    // Some content types are global and should never be tenant-specific
    // User profiles and comments are global across all organizations
    const globalContentFolders = ['profile_pictures', 'avatars', 'comments'];
    const isGlobalContent = globalContentFolders.includes(sanitizedContentFolder);
    
    // Get organization domain if not provided but organizationId is (only for non-global content)
    let finalOrganizationDomain = organizationDomain;
    if (!isGlobalContent && !finalOrganizationDomain && organizationId) {
        finalOrganizationDomain = await getOrganizationDomain(organizationId) || undefined;
    }
    
    // Get tenant name from domain if provided (only for non-global content)
    const tenantName = !isGlobalContent && finalOrganizationDomain ? getTenantNameFromDomain(finalOrganizationDomain) : null;
    
    // Build file key with tenant and content folder structure
    const fileKey = tenantName 
        ? `tenants/${tenantName}/${sanitizedContentFolder}/${timestamp}_${random}.${extension}`
        : `${sanitizedContentFolder}/${timestamp}_${random}.${extension}`;

    try {
        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: fileKey,
            Body: Buffer.from(fileBuffer),
            ContentType: getContentType(filename),
        });

        await s3Client.send(command);
        
        // Return the public URL - use custom domain if configured, otherwise use R2 public endpoint
        const publicEndpoint = Bun.env.FILE_DOWNLOAD_ENDPOINT 
          || `https://pub-${Bun.env.R2_ACCOUNT_ID}.r2.dev`;
        return `${publicEndpoint}/${fileKey}`;
    } catch (error) {
        console.error('Error uploading file to R2:', error);
        throw error;
    }
}

/**
 * Download a file from R2
 * @param fileKey - The key of the file to download
 * @returns The file buffer
 */
export async function downloadFile(fileKey: string): Promise<ArrayBuffer> {
    if (!bucket) {
        throw new Error("R2_BUCKET_NAME environment variable is not set");
    }

    try {
        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: fileKey,
        });

        const response = await s3Client.send(command);
        
        if (!response.Body) {
            throw new Error("File not found in R2");
        }

        // Convert stream to ArrayBuffer
        const chunks: Uint8Array[] = [];
        // @ts-ignore - Body can be a stream
        for await (const chunk of response.Body) {
            chunks.push(chunk);
        }
        
        const buffer = Buffer.concat(chunks);
        return buffer.buffer;
    } catch (error) {
        console.error('Error downloading file from R2:', error);
        throw error;
    }
}

export function getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
        'zip': 'application/zip',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'webp': 'image/webp',
        'gif': 'image/gif',
        'ico': 'image/x-icon',
    };
    return contentTypes[ext || ''] || 'application/octet-stream';
}

