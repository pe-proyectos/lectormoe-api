import { type Static, t } from 'elysia';

export const GenerateImageFromPage = t.Object({
    pageUrl: t.String(),
});

export type GenerateImageFromPage = Static<typeof GenerateImageFromPage>;
