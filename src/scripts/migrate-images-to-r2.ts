/**
 * Script to migrate images from simplefile server to Cloudflare R2
 * Processes images in batches of 10
 * 
 * Tables and image fields processed:
 * 1. Organization (organization)
 *    - imageUrl, bannerUrl, logoUrl, faviconUrl
 * 2. User (user)
 *    - imageUrl (profile picture)
 * 3. Author (author)
 *    - imageUrl
 * 4. Manga (manga)
 *    - imageUrl, bannerUrl
 * 5. MangaCustom (manga_custom)
 *    - imageUrl, bannerUrl
 * 6. Chapter (chapter)
 *    - imageUrl (chapter cover)
 * 7. Page (page)
 *    - imageUrl (required field, all pages processed)
 * 8. Comment (comment)
 *    - imageUrl (attached images)
 * 
 * Usage: bun src/scripts/migrate-images-to-r2.ts [simplefile-domain]
 * Example: bun src/scripts/migrate-images-to-r2.ts https://simplefile.example.com
 * 
 * Or set environment variable: SIMPLEFILE_SERVER_DOMAIN=https://simplefile.example.com
 */

import { prisma } from "../models/prisma";
import { uploadFile as uploadFileToR2 } from "../services/files";

/**
 * Extract tenant name from organization domain
 * (Copied from files.ts to avoid circular dependencies)
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

// Parse command line arguments
const args = process.argv.slice(2);
let simplefileDomain = Bun.env.SIMPLEFILE_SERVER_DOMAIN || "";
let startOffset: number | undefined = undefined;
let endOffset: number | undefined = undefined;

// Parse arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--start" && args[i + 1]) {
    startOffset = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === "--end" && args[i + 1]) {
    endOffset = parseInt(args[i + 1], 10);
    i++;
  } else if (!simplefileDomain && !args[i].startsWith("--")) {
    simplefileDomain = args[i];
  }
}

if (!simplefileDomain) {
  console.error("❌ Error: Simplefile server domain is required");
  console.error("Usage: bun src/scripts/migrate-images-to-r2.ts <simplefile-domain> [--start <offset>] [--end <offset>]");
  console.error("Or set SIMPLEFILE_SERVER_DOMAIN environment variable");
  process.exit(1);
}

if (startOffset !== undefined && startOffset < 0) {
  console.error("❌ Error: --start offset must be >= 0");
  process.exit(1);
}

if (endOffset !== undefined && endOffset < 0) {
  console.error("❌ Error: --end offset must be >= 0");
  process.exit(1);
}

if (startOffset !== undefined && endOffset !== undefined && startOffset >= endOffset) {
  console.error("❌ Error: --start must be less than --end");
  process.exit(1);
}

// Normalize domain (remove trailing slash)
const normalizedSimplefileDomain = simplefileDomain.replace(/\/$/, "");

/**
 * Check if URL is from simplefile server
 */
function isSimplefileUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return urlObj.origin === normalizedSimplefileDomain || url.includes(normalizedSimplefileDomain);
  } catch {
    return url.includes(normalizedSimplefileDomain);
  }
}

// Custom R2 domain (hardcoded, no env variable needed)
const R2_CUSTOM_DOMAIN = "https://r2.capibaratraductor.com";

/**
 * Check if URL is from R2 public endpoint (needs to be updated to custom domain)
 */
function isR2PublicEndpointUrl(url: string): boolean {
  const r2PublicPattern = `https://pub-${Bun.env.R2_ACCOUNT_ID}.r2.dev`;
  return url.startsWith(r2PublicPattern);
}

/**
 * Check if URL is already using the custom domain (without /download)
 */
function isCustomDomainUrl(url: string): boolean {
  // Check if it's using custom domain, but also check if it has /download (needs update)
  if (url.startsWith(R2_CUSTOM_DOMAIN)) {
    // If it has /download, it needs to be updated
    if (url.includes('/download/')) {
      return false; // Needs update to remove /download
    }
    return true; // Already correct
  }
  return false;
}

/**
 * Convert R2 public endpoint URL to custom domain URL
 * Removes /download from the path if present
 */
function convertR2UrlToCustomDomain(url: string): string {
  const r2PublicPattern = `https://pub-${Bun.env.R2_ACCOUNT_ID}.r2.dev`;
  if (!url.startsWith(r2PublicPattern)) {
    // If it's already using custom domain but has /download, remove it
    if (url.startsWith(R2_CUSTOM_DOMAIN)) {
      const fileKey = url.replace(R2_CUSTOM_DOMAIN, '').replace(/^\//, '').replace(/^download\//, '');
      return `${R2_CUSTOM_DOMAIN}/${fileKey}`;
    }
    return url; // Not an R2 URL, return as is
  }
  
  // Extract fileKey and remove /download if present
  let fileKey = url.replace(r2PublicPattern, '').replace(/^\//, '').replace(/^download\//, '');
  
  // Use custom domain (without /download)
  return `${R2_CUSTOM_DOMAIN}/${fileKey}`;
}

/**
 * Download image from simplefile server
 */
async function downloadImageFromSimplefile(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`⚠️  Failed to download ${url}: ${response.statusText}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`❌ Error downloading ${url}:`, error);
    return null;
  }
}

/**
 * Get content folder based on table and field name
 */
function getContentFolder(table: string, field: string): string {
  const mapping: Record<string, Record<string, string>> = {
    organization: {
      imageUrl: "organizations",
      bannerUrl: "organizations",
      logoUrl: "organizations",
      faviconUrl: "organizations",
    },
    user: {
      imageUrl: "profile_pictures",
    },
    author: {
      imageUrl: "authors",
    },
    manga: {
      imageUrl: "mangas",
      bannerUrl: "mangas",
    },
    manga_custom: {
      imageUrl: "mangas",
      bannerUrl: "mangas",
    },
    chapter: {
      imageUrl: "chapters",
    },
    page: {
      imageUrl: "chapters",
    },
    comment: {
      imageUrl: "comments",
    },
  };
  return mapping[table]?.[field] || "general";
}

/**
 * Extract filename from URL
 */
function getFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split("/").pop() || "image";
    return filename.includes(".") ? filename : `${filename}.jpg`;
  } catch {
    const filename = url.split("/").pop() || "image";
    return filename.includes(".") ? filename : `${filename}.jpg`;
  }
}

/**
 * Upload file to R2 and return R2 public URL directly
 * Always uses R2 public endpoint, ignoring FILE_DOWNLOAD_ENDPOINT
 */
async function uploadToR2AndGetPublicUrl(
  imageBuffer: Buffer,
  filename: string,
  organizationDomain?: string,
  organizationId?: number,
  contentFolder?: string
): Promise<string> {
  // Upload to R2 and get the URL (which may use FILE_DOWNLOAD_ENDPOINT)
  const uploadedUrl = await uploadFileToR2(
    imageBuffer,
    filename,
    organizationDomain,
    organizationId,
    contentFolder
  );
  
  // Extract fileKey from the URL
  let fileKey = uploadedUrl;
  
  // Try to extract fileKey from various URL formats
  const r2PublicPattern = `https://pub-${Bun.env.R2_ACCOUNT_ID}.r2.dev/`;
  if (uploadedUrl.startsWith(r2PublicPattern)) {
    fileKey = uploadedUrl.replace(r2PublicPattern, '');
  } else {
    // Try to extract from URL path
    try {
      const urlObj = new URL(uploadedUrl);
      fileKey = urlObj.pathname.replace(/^\//, '');
    } catch {
      // If all else fails, try to extract from the URL string
      const parts = uploadedUrl.split('/');
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart.includes('.')) {
        // Try to find the fileKey by looking for the content folder
        const contentFolderMatch = uploadedUrl.match(/\/(tenants\/[^\/]+\/)?([^\/]+\/[^\/]+)$/);
        if (contentFolderMatch) {
          fileKey = contentFolderMatch[0].replace(/^\//, '');
        } else {
          fileKey = lastPart;
        }
      } else {
        fileKey = uploadedUrl;
      }
    }
  }
  
  // Remove /download from fileKey if present (R2 doesn't need it)
  fileKey = fileKey.replace(/^download\//, '');
  
  // Always use custom domain (no env variable needed, no /download)
  return `${R2_CUSTOM_DOMAIN}/${fileKey}`;
}

/**
 * Process Organization images
 */
async function migrateOrganizationImages(batchSize: number = 30) {
  console.log("\n📁 Processing Organization images...");
  
  const fields = ["imageUrl", "bannerUrl", "logoUrl", "faviconUrl"];
  let processed = 0;
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const field of fields) {
    let offset = startOffset !== undefined ? startOffset : 0;
    let hasMore = true;

    while (hasMore) {
      // Stop if we've reached the end offset
      if (endOffset !== undefined && offset >= endOffset) {
        hasMore = false;
        break;
      }
      const organizations = await prisma.organization.findMany({
        where: {
          AND: [
            {
              [field]: {
                not: null,
              },
            },
            {
              [field]: {
                not: {
                  contains: R2_CUSTOM_DOMAIN,
                },
              },
            },
          ],
        },
        take: batchSize,
        skip: offset,
        select: {
          id: true,
          domain: true,
          [field]: true,
        },
      });

      if (organizations.length === 0) {
        hasMore = false;
        break;
      }

      // Process in parallel batches of 30
      for (let i = 0; i < organizations.length; i += 30) {
        const batch = organizations.slice(i, i + 30);
        
        await Promise.all(batch.map(async (org) => {
          processed++;
          const imageUrl = (org as any)[field] as string | null;

          if (!imageUrl) {
            skipped++;
            return;
          }

          // If it's already using custom domain, skip
          if (isCustomDomainUrl(imageUrl)) {
            skipped++;
            return;
          }

          // If it's R2 public endpoint, convert to custom domain
          if (isR2PublicEndpointUrl(imageUrl)) {
            try {
              const newUrl = convertR2UrlToCustomDomain(imageUrl);
              await prisma.organization.update({
                where: { id: (org as any).id },
                data: { [field]: newUrl },
              });
              
              globalMigratedCount++;
              console.log(`URL actual: ${imageUrl}`);
              console.log(`URL nueva:  ${newUrl}`);
              console.log("");
              console.log("");
              console.log("");
              console.log(`Progreso: ${globalMigratedCount}/${globalTotalCount}`);
              migrated++;
              return;
            } catch (error) {
              console.error(`  ❌ Error updating ${field} for org ${(org as any).id}:`, error);
              errors++;
              return;
            }
          }

          // If it's not simplefile URL, skip
          if (!isSimplefileUrl(imageUrl)) {
            skipped++;
            return;
          }

          try {
            const imageBuffer = await downloadImageFromSimplefile(imageUrl);

            if (!imageBuffer) {
              errors++;
              return;
            }

            const filename = getFilenameFromUrl(imageUrl);
            const contentFolder = getContentFolder("organization", field);
            const orgDomain = (org as any).domain as string;
            const orgId = (org as any).id as number;

            const newUrl = await uploadToR2AndGetPublicUrl(
              imageBuffer,
              filename,
              orgDomain,
              orgId,
              contentFolder
            );

            await prisma.organization.update({
              where: { id: orgId },
              data: { [field]: newUrl },
            });

            globalMigratedCount++;
            console.log(`URL actual: ${imageUrl}`);
            console.log(`URL nueva:  ${newUrl}`);
            console.log("");
            console.log("");
            console.log("");
            console.log(`Progreso: ${globalMigratedCount}/${globalTotalCount}`);
            migrated++;
          } catch (error) {
            console.error(`  ❌ Error migrating ${field} for org ${(org as any).id}:`, error);
            errors++;
          }
        }));
      }

      offset += batchSize;
      if (organizations.length < batchSize) {
        hasMore = false;
      }
    }
  }

  return { processed, migrated, skipped, errors };
}

/**
 * Process User images
 */
async function migrateUserImages(batchSize: number = 30) {
  console.log("\n👤 Processing User images...");
  
  let offset = startOffset !== undefined ? startOffset : 0;
  let hasMore = true;
  let processed = 0;
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  while (hasMore) {
    // Stop if we've reached the end offset
    if (endOffset !== undefined && offset >= endOffset) {
      hasMore = false;
      break;
    }
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            imageUrl: {
              not: null,
            },
          },
          {
            imageUrl: {
              not: {
                contains: R2_CUSTOM_DOMAIN,
              },
            },
          },
        ],
      },
      take: batchSize,
      skip: offset,
      select: {
        id: true,
        imageUrl: true,
      },
    });

    if (users.length === 0) {
      hasMore = false;
      break;
    }

    // Process in parallel batches of 30
    for (let i = 0; i < users.length; i += 30) {
      const batch = users.slice(i, i + 30);
      
      await Promise.all(batch.map(async (user) => {
        processed++;
        if (!user.imageUrl) {
          skipped++;
          return;
        }

        // If it's already using custom domain, skip
        if (isCustomDomainUrl(user.imageUrl)) {
          skipped++;
          return;
        }

        // If it's R2 public endpoint, convert to custom domain
        if (isR2PublicEndpointUrl(user.imageUrl)) {
          try {
            const newUrl = convertR2UrlToCustomDomain(user.imageUrl);
            await prisma.user.update({
              where: { id: user.id },
              data: { imageUrl: newUrl },
            });
            
            globalMigratedCount++;
            console.log(`URL actual: ${user.imageUrl}`);
            console.log(`URL nueva:  ${newUrl}`);
            console.log("");
            console.log("");
            console.log("");
            console.log(`Progreso: ${globalMigratedCount}/${globalTotalCount}`);
            migrated++;
            return;
          } catch (error) {
            console.error(`  ❌ Error updating image for user ${user.id}:`, error);
            errors++;
            return;
          }
        }

        // If it's not simplefile URL, skip
        if (!isSimplefileUrl(user.imageUrl)) {
          skipped++;
          return;
        }

        try {
          const imageBuffer = await downloadImageFromSimplefile(user.imageUrl);

          if (!imageBuffer) {
            errors++;
            return;
          }

          const filename = getFilenameFromUrl(user.imageUrl);
          const contentFolder = getContentFolder("user", "imageUrl");

          const newUrl = await uploadToR2AndGetPublicUrl(
            imageBuffer,
            filename,
            undefined,
            undefined,
            contentFolder
          );

          await prisma.user.update({
            where: { id: user.id },
            data: { imageUrl: newUrl },
          });

          globalMigratedCount++;
          console.log(`URL actual: ${user.imageUrl}`);
          console.log(`URL nueva:  ${newUrl}`);
          console.log("");
          console.log("");
          console.log("");
          console.log(`Progreso: ${globalMigratedCount}/${globalTotalCount}`);
          migrated++;
        } catch (error) {
          console.error(`  ❌ Error migrating image for user ${user.id}:`, error);
          errors++;
        }
      }));
    }

    offset += batchSize;
    if (users.length < batchSize) {
      hasMore = false;
    }
  }

  return { processed, migrated, skipped, errors };
}

/**
 * Process Author images
 */
async function migrateAuthorImages(batchSize: number = 30) {
  console.log("\n✍️  Processing Author images...");
  
  let offset = startOffset !== undefined ? startOffset : 0;
  let hasMore = true;
  let processed = 0;
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  while (hasMore) {
    // Stop if we've reached the end offset
    if (endOffset !== undefined && offset >= endOffset) {
      hasMore = false;
      break;
    }
    const authors = await prisma.author.findMany({
      where: {
        AND: [
          {
            imageUrl: {
              not: null,
            },
          },
          {
            imageUrl: {
              not: {
                contains: R2_CUSTOM_DOMAIN,
              },
            },
          },
        ],
      },
      take: batchSize,
      skip: offset,
      select: {
        id: true,
        imageUrl: true,
      },
    });

    if (authors.length === 0) {
      hasMore = false;
      break;
    }

    for (const author of authors) {
      processed++;
      if (!author.imageUrl) {
        skipped++;
        continue;
      }

      // If it's already using custom domain, skip
      if (isCustomDomainUrl(author.imageUrl)) {
        skipped++;
        continue;
      }

      // If it's R2 public endpoint, convert to custom domain
      if (isR2PublicEndpointUrl(author.imageUrl)) {
        try {
          const newUrl = convertR2UrlToCustomDomain(author.imageUrl);
          await prisma.author.update({
            where: { id: author.id },
            data: { imageUrl: newUrl },
          });
          
          globalMigratedCount++;
          console.log(`URL actual: ${author.imageUrl}`);
          console.log(`URL nueva:  ${newUrl}`);
          console.log("");
          console.log("");
          console.log("");
          console.log(`Progreso: ${globalMigratedCount}/${globalTotalCount}`);
          migrated++;
          continue;
        } catch (error) {
          console.error(`  ❌ Error updating image for author ${author.id}:`, error);
          errors++;
          continue;
        }
      }

      // If it's not simplefile URL, skip
      if (!isSimplefileUrl(author.imageUrl)) {
        skipped++;
        continue;
      }

      try {
        const imageBuffer = await downloadImageFromSimplefile(author.imageUrl);

        if (!imageBuffer) {
          errors++;
          continue;
        }

        const filename = getFilenameFromUrl(author.imageUrl);
        const contentFolder = getContentFolder("author", "imageUrl");

        const newUrl = await uploadToR2AndGetPublicUrl(
          imageBuffer,
          filename,
          undefined,
          undefined,
          contentFolder
        );

        await prisma.author.update({
          where: { id: author.id },
          data: { imageUrl: newUrl },
        });

        globalMigratedCount++;
        console.log(`URL actual: ${author.imageUrl}`);
        console.log(`URL nueva:  ${newUrl}`);
        console.log("");
        console.log("");
        console.log("");
        console.log(`Progreso: ${globalMigratedCount}/${globalTotalCount}`);
        migrated++;
      } catch (error) {
        console.error(`  ❌ Error migrating image for author ${author.id}:`, error);
        errors++;
      }
    }

    offset += batchSize;
    if (authors.length < batchSize) {
      hasMore = false;
    }
  }

  return { processed, migrated, skipped, errors };
}

/**
 * Process Manga images
 */
async function migrateMangaImages(batchSize: number = 30) {
  console.log("\n📚 Processing Manga images...");
  
  const fields = ["imageUrl", "bannerUrl"];
  let processed = 0;
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const field of fields) {
    let offset = startOffset !== undefined ? startOffset : 0;
    let hasMore = true;

    while (hasMore) {
      // Stop if we've reached the end offset
      if (endOffset !== undefined && offset >= endOffset) {
        hasMore = false;
        break;
      }
      const mangas = await prisma.manga.findMany({
        where: {
          AND: [
            {
              [field]: {
                not: null,
              },
            },
            {
              [field]: {
                not: {
                  contains: R2_CUSTOM_DOMAIN,
                },
              },
            },
          ],
        },
        take: batchSize,
        skip: offset,
        select: {
          id: true,
          [field]: true,
        },
      });

      if (mangas.length === 0) {
        hasMore = false;
        break;
      }

      // Process in parallel batches of 30
      for (let i = 0; i < mangas.length; i += 30) {
        const batch = mangas.slice(i, i + 30);
        
        await Promise.all(batch.map(async (manga) => {
          processed++;
          const imageUrl = (manga as any)[field] as string | null;

          if (!imageUrl) {
            skipped++;
            return;
          }

          // If it's already using custom domain, skip
          if (isCustomDomainUrl(imageUrl)) {
            skipped++;
            return;
          }

          // If it's R2 public endpoint, convert to custom domain
          if (isR2PublicEndpointUrl(imageUrl)) {
            try {
              const newUrl = convertR2UrlToCustomDomain(imageUrl);
              const mangaId = (manga as any).id as number;
              await prisma.manga.update({
                where: { id: mangaId },
                data: { [field]: newUrl },
              });
              
              globalMigratedCount++;
              console.log(`URL actual: ${imageUrl}`);
              console.log(`URL nueva:  ${newUrl}`);
              console.log("");
              console.log("");
              console.log("");
              console.log(`Progreso: ${globalMigratedCount}/${globalTotalCount}`);
              migrated++;
              return;
            } catch (error) {
              console.error(`  ❌ Error updating ${field} for manga ${(manga as any).id}:`, error);
              errors++;
              return;
            }
          }

          // If it's not simplefile URL, skip
          if (!isSimplefileUrl(imageUrl)) {
            skipped++;
            return;
          }

          try {
            const imageBuffer = await downloadImageFromSimplefile(imageUrl);

            if (!imageBuffer) {
              errors++;
              return;
            }

            const filename = getFilenameFromUrl(imageUrl);
            const contentFolder = getContentFolder("manga", field);

            const newUrl = await uploadToR2AndGetPublicUrl(
              imageBuffer,
              filename,
              undefined,
              undefined,
              contentFolder
            );

            const mangaId = (manga as any).id as number;
            await prisma.manga.update({
              where: { id: mangaId },
              data: { [field]: newUrl },
            });

            globalMigratedCount++;
            console.log(`URL actual: ${imageUrl}`);
            console.log(`URL nueva:  ${newUrl}`);
            console.log("");
            console.log("");
            console.log("");
            console.log(`Progreso: ${globalMigratedCount}/${globalTotalCount}`);
            migrated++;
          } catch (error) {
            console.error(`  ❌ Error migrating ${field} for manga ${(manga as any).id}:`, error);
            errors++;
          }
        }));
      }

      offset += batchSize;
      if (mangas.length < batchSize) {
        hasMore = false;
      }
    }
  }

  return { processed, migrated, skipped, errors };
}

/**
 * Process MangaCustom images
 */
async function migrateMangaCustomImages(batchSize: number = 30) {
  console.log("\n📖 Processing MangaCustom images...");
  
  const fields = ["imageUrl", "bannerUrl"];
  let processed = 0;
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const field of fields) {
    let offset = startOffset !== undefined ? startOffset : 0;
    let hasMore = true;

    while (hasMore) {
      // Stop if we've reached the end offset
      if (endOffset !== undefined && offset >= endOffset) {
        hasMore = false;
        break;
      }
      const mangaCustoms = await prisma.mangaCustom.findMany({
        where: {
          AND: [
            {
              [field]: {
                not: null,
              },
            },
            {
              [field]: {
                not: {
                  contains: R2_CUSTOM_DOMAIN,
                },
              },
            },
          ],
        },
        take: batchSize,
        skip: offset,
        select: {
          id: true,
          organizationId: true,
          [field]: true,
          organization: {
            select: {
              domain: true,
            },
          },
        },
      });

      if (mangaCustoms.length === 0) {
        hasMore = false;
        break;
      }

      // Process in parallel batches of 30
      for (let i = 0; i < mangaCustoms.length; i += 30) {
        const batch = mangaCustoms.slice(i, i + 30);
        
        await Promise.all(batch.map(async (mangaCustom) => {
          processed++;
          const imageUrl = (mangaCustom as any)[field] as string | null;

          if (!imageUrl) {
            skipped++;
            return;
          }

          // If it's already using custom domain, skip
          if (isCustomDomainUrl(imageUrl)) {
            skipped++;
            return;
          }

          // If it's R2 public endpoint, convert to custom domain
          if (isR2PublicEndpointUrl(imageUrl)) {
            try {
              const newUrl = convertR2UrlToCustomDomain(imageUrl);
              const mangaCustomId = (mangaCustom as any).id as number;
              await prisma.mangaCustom.update({
                where: { id: mangaCustomId },
                data: { [field]: newUrl },
              });
              
              globalMigratedCount++;
              console.log(`URL actual: ${imageUrl}`);
              console.log(`URL nueva:  ${newUrl}`);
              console.log("");
              console.log("");
              console.log("");
              console.log(`Progreso: ${globalMigratedCount}/${globalTotalCount}`);
              migrated++;
              return;
            } catch (error) {
              console.error(`  ❌ Error updating ${field} for mangaCustom ${(mangaCustom as any).id}:`, error);
              errors++;
              return;
            }
          }

          // If it's not simplefile URL, skip
          if (!isSimplefileUrl(imageUrl)) {
            skipped++;
            return;
          }

          try {
            const imageBuffer = await downloadImageFromSimplefile(imageUrl);

            if (!imageBuffer) {
              errors++;
              return;
            }

            const filename = getFilenameFromUrl(imageUrl);
            const contentFolder = getContentFolder("manga_custom", field);
            const mangaCustomOrg = (mangaCustom as any).organization as { domain: string } | null | undefined;
            const mangaCustomId = (mangaCustom as any).id as number;
            const mangaCustomOrgId = (mangaCustom as any).organizationId as number;

            const newUrl = await uploadToR2AndGetPublicUrl(
              imageBuffer,
              filename,
              mangaCustomOrg?.domain,
              mangaCustomOrgId,
              contentFolder
            );

            await prisma.mangaCustom.update({
              where: { id: mangaCustomId },
              data: { [field]: newUrl },
            });

            globalMigratedCount++;
            console.log(`URL actual: ${imageUrl}`);
            console.log(`URL nueva:  ${newUrl}`);
            console.log("");
            console.log("");
            console.log("");
            console.log(`Progreso: ${globalMigratedCount}/${globalTotalCount}`);
            migrated++;
          } catch (error) {
            console.error(`  ❌ Error migrating ${field} for mangaCustom ${(mangaCustom as any).id}:`, error);
            errors++;
          }
        }));
      }

      offset += batchSize;
      if (mangaCustoms.length < batchSize) {
        hasMore = false;
      }
    }
  }

  return { processed, migrated, skipped, errors };
}

/**
 * Process Chapter images
 */
async function migrateChapterImages(batchSize: number = 30) {
  console.log("\n📄 Processing Chapter images...");
  
  let offset = startOffset !== undefined ? startOffset : 0;
  let hasMore = true;
  let processed = 0;
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  while (hasMore) {
    // Stop if we've reached the end offset
    if (endOffset !== undefined && offset >= endOffset) {
      hasMore = false;
      break;
    }
    const chapters = await prisma.chapter.findMany({
      where: {
        AND: [
          {
            imageUrl: {
              not: null,
            },
          },
          {
            imageUrl: {
              not: {
                contains: R2_CUSTOM_DOMAIN,
              },
            },
          },
        ],
      },
      take: batchSize,
      skip: offset,
      select: {
        id: true,
        imageUrl: true,
        mangaCustom: {
          select: {
            organizationId: true,
            organization: {
              select: {
                domain: true,
              },
            },
          },
        },
      },
    });

    if (chapters.length === 0) {
      hasMore = false;
      break;
    }

    // Process in parallel batches of 30
    for (let i = 0; i < chapters.length; i += 30) {
      const batch = chapters.slice(i, i + 30);
      
      await Promise.all(batch.map(async (chapter) => {
        processed++;
        if (!chapter.imageUrl) {
          skipped++;
          return;
        }

        // If it's already using custom domain, skip
        if (isCustomDomainUrl(chapter.imageUrl)) {
          skipped++;
          return;
        }

        // If it's R2 public endpoint, convert to custom domain
        if (isR2PublicEndpointUrl(chapter.imageUrl)) {
          try {
            const newUrl = convertR2UrlToCustomDomain(chapter.imageUrl);
            await prisma.chapter.update({
              where: { id: chapter.id },
              data: { imageUrl: newUrl },
            });
            
            globalMigratedCount++;
            console.log(`URL actual: ${chapter.imageUrl}`);
            console.log(`URL nueva:  ${newUrl}`);
            console.log("");
            console.log("");
            console.log("");
            console.log(`Progreso: ${globalMigratedCount}/${globalTotalCount}`);
            migrated++;
            return;
          } catch (error) {
            console.error(`  ❌ Error updating image for chapter ${chapter.id}:`, error);
            errors++;
            return;
          }
        }

        // If it's not simplefile URL, skip
        if (!isSimplefileUrl(chapter.imageUrl)) {
          skipped++;
          return;
        }

        try {
          const imageBuffer = await downloadImageFromSimplefile(chapter.imageUrl);

          if (!imageBuffer) {
            errors++;
            return;
          }

          const filename = getFilenameFromUrl(chapter.imageUrl);
          const contentFolder = getContentFolder("chapter", "imageUrl");

          const newUrl = await uploadToR2AndGetPublicUrl(
            imageBuffer,
            filename,
            chapter.mangaCustom?.organization?.domain,
            chapter.mangaCustom?.organizationId,
            contentFolder
          );

          await prisma.chapter.update({
            where: { id: chapter.id },
            data: { imageUrl: newUrl },
          });

          globalMigratedCount++;
          console.log(`URL actual: ${chapter.imageUrl}`);
          console.log(`URL nueva:  ${newUrl}`);
          console.log("");
          console.log("");
          console.log("");
          console.log(`Progreso: ${globalMigratedCount}/${globalTotalCount}`);
          migrated++;
        } catch (error) {
          console.error(`  ❌ Error migrating image for chapter ${chapter.id}:`, error);
          errors++;
        }
      }));
    }

    offset += batchSize;
    if (chapters.length < batchSize) {
      hasMore = false;
    }
  }

  return { processed, migrated, skipped, errors };
}

/**
 * Process Page images
 */
async function migratePageImages(batchSize: number = 30) {
  console.log("\n🖼️  Processing Page images...");
  
  let offset = startOffset !== undefined ? startOffset : 0;
  let hasMore = true;
  let processed = 0;
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  while (hasMore) {
    // Stop if we've reached the end offset
    if (endOffset !== undefined && offset >= endOffset) {
      hasMore = false;
      break;
    }
    const pages = await prisma.page.findMany({
      where: {
        imageUrl: {
          not: {
            contains: R2_CUSTOM_DOMAIN,
          },
        },
      },
      take: batchSize,
      skip: offset,
      select: {
        id: true,
        imageUrl: true,
        chapter: {
          select: {
            mangaCustom: {
              select: {
                organizationId: true,
                organization: {
                  select: {
                    domain: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (pages.length === 0) {
      hasMore = false;
      break;
    }

    // Process in parallel batches of 30
    for (let i = 0; i < pages.length; i += 30) {
      const batch = pages.slice(i, i + 30);
      
      await Promise.all(batch.map(async (page) => {
        processed++;
        if (!page.imageUrl) {
          skipped++;
          return;
        }

        // If it's already using custom domain, skip
        if (isCustomDomainUrl(page.imageUrl)) {
          skipped++;
          return;
        }

        // If it's R2 public endpoint, convert to custom domain
        if (isR2PublicEndpointUrl(page.imageUrl)) {
          try {
            const newUrl = convertR2UrlToCustomDomain(page.imageUrl);
            await prisma.page.update({
              where: { id: page.id },
              data: { imageUrl: newUrl },
            });
            
            globalMigratedCount++;
            console.log(`URL actual: ${page.imageUrl}`);
            console.log(`URL nueva:  ${newUrl}`);
            console.log("");
            console.log("");
            console.log("");
            console.log(`Progreso: ${globalMigratedCount}/${globalTotalCount}`);
            migrated++;
            return;
          } catch (error) {
            console.error(`  ❌ Error updating image for page ${page.id}:`, error);
            errors++;
            return;
          }
        }

        // If it's not simplefile URL, skip
        if (!isSimplefileUrl(page.imageUrl)) {
          skipped++;
          return;
        }

        try {
          const imageBuffer = await downloadImageFromSimplefile(page.imageUrl);

          if (!imageBuffer) {
            errors++;
            return;
          }

          const filename = getFilenameFromUrl(page.imageUrl);
          const contentFolder = getContentFolder("page", "imageUrl");

          const newUrl = await uploadToR2AndGetPublicUrl(
            imageBuffer,
            filename,
            page.chapter?.mangaCustom?.organization?.domain,
            page.chapter?.mangaCustom?.organizationId,
            contentFolder
          );

          await prisma.page.update({
            where: { id: page.id },
            data: { imageUrl: newUrl },
          });

          globalMigratedCount++;
          console.log(`URL actual: ${page.imageUrl}`);
          console.log(`URL nueva:  ${newUrl}`);
          console.log("");
          console.log("");
          console.log("");
          console.log(`Progreso: ${globalMigratedCount}/${globalTotalCount}`);
          migrated++;
        } catch (error) {
          console.error(`  ❌ Error migrating image for page ${page.id}:`, error);
          errors++;
        }
      }));
    }

    offset += batchSize;
    if (pages.length < batchSize) {
      hasMore = false;
    }
  }

  return { processed, migrated, skipped, errors };
}

/**
 * Process Comment images
 */
async function migrateCommentImages(batchSize: number = 30) {
  console.log("\n💬 Processing Comment images...");
  
  let offset = startOffset !== undefined ? startOffset : 0;
  let hasMore = true;
  let processed = 0;
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  while (hasMore) {
    // Stop if we've reached the end offset
    if (endOffset !== undefined && offset >= endOffset) {
      hasMore = false;
      break;
    }
    const comments = await prisma.comment.findMany({
      where: {
        AND: [
          {
            imageUrl: {
              not: null,
            },
          },
          {
            imageUrl: {
              not: {
                contains: R2_CUSTOM_DOMAIN,
              },
            },
          },
        ],
      },
      take: batchSize,
      skip: offset,
      select: {
        id: true,
        imageUrl: true,
        organization: {
          select: {
            id: true,
            domain: true,
          },
        },
      },
    });

    if (comments.length === 0) {
      hasMore = false;
      break;
    }

    // Process in parallel batches of 30
    for (let i = 0; i < comments.length; i += 30) {
      const batch = comments.slice(i, i + 30);
      
      await Promise.all(batch.map(async (comment) => {
        processed++;
        if (!comment.imageUrl) {
          skipped++;
          return;
        }

        // If it's already using custom domain, skip
        if (isCustomDomainUrl(comment.imageUrl)) {
          skipped++;
          return;
        }

        // If it's R2 public endpoint, convert to custom domain
        if (isR2PublicEndpointUrl(comment.imageUrl)) {
          try {
            const newUrl = convertR2UrlToCustomDomain(comment.imageUrl);
            await prisma.comment.update({
              where: { id: comment.id },
              data: { imageUrl: newUrl },
            });
            
            globalMigratedCount++;
            console.log(`URL actual: ${comment.imageUrl}`);
            console.log(`URL nueva:  ${newUrl}`);
            console.log("");
            console.log("");
            console.log("");
            console.log(`Progreso: ${globalMigratedCount}/${globalTotalCount}`);
            migrated++;
            return;
          } catch (error) {
            console.error(`  ❌ Error updating image for comment ${comment.id}:`, error);
            errors++;
            return;
          }
        }

        // If it's not simplefile URL, skip
        if (!isSimplefileUrl(comment.imageUrl)) {
          skipped++;
          return;
        }

        try {
          const imageBuffer = await downloadImageFromSimplefile(comment.imageUrl);

          if (!imageBuffer) {
            errors++;
            return;
          }

          const filename = getFilenameFromUrl(comment.imageUrl);
          const contentFolder = getContentFolder("comment", "imageUrl");

          const newUrl = await uploadToR2AndGetPublicUrl(
            imageBuffer,
            filename,
            comment.organization?.domain,
            comment.organization?.id,
            contentFolder
          );

          await prisma.comment.update({
            where: { id: comment.id },
            data: { imageUrl: newUrl },
          });

          globalMigratedCount++;
          console.log(`URL actual: ${comment.imageUrl}`);
          console.log(`URL nueva:  ${newUrl}`);
          console.log("");
          console.log("");
          console.log("");
          console.log(`Progreso: ${globalMigratedCount}/${globalTotalCount}`);
          migrated++;
        } catch (error) {
          console.error(`  ❌ Error migrating image for comment ${comment.id}:`, error);
          errors++;
        }
      }));
    }

    offset += batchSize;
    if (comments.length < batchSize) {
      hasMore = false;
    }
  }

  return { processed, migrated, skipped, errors };
}

// Global counter for progress tracking
let globalMigratedCount = 0;
let globalTotalCount = 0;

/**
 * Count total images to migrate (excluding already migrated ones)
 */
async function countTotalImages(): Promise<number> {
  let total = 0;
  
  // Count Organization images (excluding already migrated)
  const orgFields = ["imageUrl", "bannerUrl", "logoUrl", "faviconUrl"];
  for (const field of orgFields) {
    const count = await prisma.organization.count({
      where: {
        AND: [
          { [field]: { not: null } },
          { [field]: { not: { contains: R2_CUSTOM_DOMAIN } } },
        ],
      },
    });
    total += count;
  }
  
  // Count User images (excluding already migrated)
  total += await prisma.user.count({
    where: {
      AND: [
        { imageUrl: { not: null } },
        { imageUrl: { not: { contains: R2_CUSTOM_DOMAIN } } },
      ],
    },
  });
  
  // Count Author images (excluding already migrated)
  total += await prisma.author.count({
    where: {
      AND: [
        { imageUrl: { not: null } },
        { imageUrl: { not: { contains: R2_CUSTOM_DOMAIN } } },
      ],
    },
  });
  
  // Count Manga images (excluding already migrated)
  const mangaFields = ["imageUrl", "bannerUrl"];
  for (const field of mangaFields) {
    const count = await prisma.manga.count({
      where: {
        AND: [
          { [field]: { not: null } },
          { [field]: { not: { contains: R2_CUSTOM_DOMAIN } } },
        ],
      },
    });
    total += count;
  }
  
  // Count MangaCustom images (excluding already migrated)
  for (const field of mangaFields) {
    const count = await prisma.mangaCustom.count({
      where: {
        AND: [
          { [field]: { not: null } },
          { [field]: { not: { contains: R2_CUSTOM_DOMAIN } } },
        ],
      },
    });
    total += count;
  }
  
  // Count Chapter images (excluding already migrated)
  total += await prisma.chapter.count({
    where: {
      AND: [
        { imageUrl: { not: null } },
        { imageUrl: { not: { contains: R2_CUSTOM_DOMAIN } } },
      ],
    },
  });
  
  // Count Page images (excluding already migrated)
  total += await prisma.page.count({
    where: {
      imageUrl: { not: { contains: R2_CUSTOM_DOMAIN } },
    },
  });
  
  // Count Comment images (excluding already migrated)
  total += await prisma.comment.count({
    where: {
      AND: [
        { imageUrl: { not: null } },
        { imageUrl: { not: { contains: R2_CUSTOM_DOMAIN } } },
      ],
    },
  });
  
  return total;
}

/**
 * Main migration function
 */
async function main() {
  console.log("🚀 Starting image migration from Simplefile Server to Cloudflare R2");
  console.log(`📡 Simplefile Server Domain: ${normalizedSimplefileDomain}`);
  if (startOffset !== undefined || endOffset !== undefined) {
    console.log(`📍 Offset range: ${startOffset ?? 0} - ${endOffset ?? "∞"}`);
  }
  console.log("=" .repeat(60));
  
  if (startOffset === undefined && endOffset === undefined) {
    console.log("\n📊 Counting total images to migrate...");
    globalTotalCount = await countTotalImages();
    console.log(`📈 Total images found: ${globalTotalCount}`);
  } else {
    console.log("\n📊 Counting images in specified range...");
    // Calculate approximate total in the range
    const rangeTotal = endOffset !== undefined 
      ? endOffset - (startOffset ?? 0)
      : await countTotalImages() - (startOffset ?? 0);
    globalTotalCount = Math.max(0, rangeTotal);
    console.log(`📈 Estimated images in range: ${globalTotalCount}`);
  }
  console.log("=" .repeat(60));

  const batchSize = 30;
  const results: Record<string, { processed: number; migrated: number; skipped: number; errors: number }> = {};

  try {
    results.organization = await migrateOrganizationImages(batchSize);
    results.user = await migrateUserImages(batchSize);
    results.author = await migrateAuthorImages(batchSize);
    results.manga = await migrateMangaImages(batchSize);
    results.mangaCustom = await migrateMangaCustomImages(batchSize);
    results.chapter = await migrateChapterImages(batchSize);
    results.page = await migratePageImages(batchSize);
    results.comment = await migrateCommentImages(batchSize);

    console.log("\n" + "=".repeat(60));
    console.log("📊 Migration Summary:");
    console.log("=".repeat(60));

    let totalProcessed = 0;
    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const [table, stats] of Object.entries(results)) {
      console.log(`\n${table}:`);
      console.log(`  Processed: ${stats.processed}`);
      console.log(`  Migrated:  ${stats.migrated}`);
      console.log(`  Skipped:   ${stats.skipped}`);
      console.log(`  Errors:    ${stats.errors}`);
      
      totalProcessed += stats.processed;
      totalMigrated += stats.migrated;
      totalSkipped += stats.skipped;
      totalErrors += stats.errors;
    }

    console.log("\n" + "=".repeat(60));
    console.log("📈 Totals:");
    console.log(`  Processed: ${totalProcessed}`);
    console.log(`  Migrated:  ${totalMigrated}`);
    console.log(`  Skipped:   ${totalSkipped}`);
    console.log(`  Errors:    ${totalErrors}`);
    console.log("=".repeat(60));

    if (totalErrors > 0) {
      console.log("\n⚠️  Some images failed to migrate. Check the errors above.");
    } else {
      console.log("\n✅ Migration completed successfully!");
    }
  } catch (error) {
    console.error("\n❌ Fatal error during migration:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
main();

