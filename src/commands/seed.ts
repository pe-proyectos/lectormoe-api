import { prisma } from "../models/prisma";

const demography = [
    {
        name: "Kodomo",
        slug: "kodomo",
        description: "Dirigido a niños pequeños."
    },
    {
        name: "Shōnen",
        slug: "shonen",
        description: "Dirigido a chicos adolescentes."
    },
    {
        name: "Shōjo",
        slug: "shojo",
        description: "Dirigido a chicas adolescentes."
    },
    {
        name: "Seinen",
        slug: "seinen",
        description: "Dirigido a hombres jóvenes y adultos."
    },
    {
        name: "Josei",
        slug: "josei",
        description: "Dirigido a mujeres jóvenes y adultas."
    }
];

console.log('Seeding demography...');

await prisma.demography.createMany({
    data: demography,
    skipDuplicates: true,
});
