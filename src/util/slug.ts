import slugify from "slugify";

export const toSlug = (str: string) => {
    const slug = slugify(str, {
        remove: /[*+~.()'"!:@]/g,
        lower: true,
        strict: true,
        trim: true,
    });

    if (slug.length === 0) {
        throw new Error(`El slug de '${str}' no puede ser vacío`);
    }

    return slug;
}
