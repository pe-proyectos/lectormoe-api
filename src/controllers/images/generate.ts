import puppeteer from 'puppeteer';
import type { GenerateImageFromPage } from "../../types/images/generate";
import { uploadFile } from '../../util/upload-file';
import { prisma } from '../../models/prisma';

export const createImageFromPage = async (organizationId: number, mangaSlug: string, params: GenerateImageFromPage) => {
    const mangaCustom = await prisma.mangaCustom.findFirst({
        where: {
            organizationId,
            manga: {
                slug: mangaSlug,
            },
        },
    });

    if (!mangaCustom) {
        throw new Error("Tu organización no tiene este manga");
    }

    const browser = await puppeteer.launch({
        defaultViewport: {
            width: 1200,
            height: 600,
        },
        args: [
            '--no-sandbox',
            '--headless',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--remote-debugging-port=9222',
            '--remote-debugging-address=0.0.0.0',
        ],
    });
    const page = await browser.newPage();

    await page.goto(params.pageUrl);
    await page.setViewport({ width: 1200, height: 630 });
    const screenShotBuffer = await page.screenshot({
        type: 'webp',
        encoding: 'binary',
    });

    await browser.close();

    const imageUrl = await uploadFile(screenShotBuffer, `${params.pageUrl}.webp`);

    await prisma.mangaCustom.update({
        where: {
            id: mangaCustom.id,
        },
        data: {
            imageUrl,
        },
    });

    return imageUrl;
};
