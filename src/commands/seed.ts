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

const genre = [
    {
        "name": "Nekketsu",
        "nameEs": "Ardiente",
        "slug": "nekketsu",
        "display": true,
        "description": "Tipo de manga en el que abundan las escenas de acción protagonizadas por un personaje exaltado que defiende valores como la amistad y la superación personal."
    },
    {
        "name": "Spokon",
        "nameEs": "Deportivo",
        "slug": "spokon",
        "display": true,
        "description": "Manga de temática deportiva. El término proviene de contraer la palabra inglesa 'sports' y la japonesa 'konjo', que significa 'valor', 'coraje'."
    },
    {
        "name": "Gekiga",
        "nameEs": "Drama Gráfico",
        "slug": "gekiga",
        "display": true,
        "description": "Manga de temática adulta y dramática."
    },
    {
        "name": "Mahō Shōjo",
        "nameEs": "Chicas Mágicas",
        "slug": "mahou-shoujo",
        "display": true,
        "description": "Niñas/os o chicos que tienen algún objeto mágico o poder especial."
    },
    {
        "name": "Yuri",
        "nameEs": "Amor entre chicas",
        "slug": "yuri",
        "display": true,
        "description": "Historia de amor entre chicas."
    },
    {
        "name": "Yaoi",
        "nameEs": "Amor entre chicos",
        "slug": "yaoi",
        "display": true,
        "description": "Historia de amor entre chicos."
    },
    {
        "name": "Harem",
        "nameEs": "Harén",
        "slug": "harem",
        "display": true,
        "description": "Grupo femenino, pero con algún chico como coprotagonista."
    },
    {
        "name": "Mecha",
        "nameEs": "Mecánico",
        "slug": "mecha",
        "display": true,
        "description": "Tienen presencia importante los robots, en muchas ocasiones gigantes y tripulados por humanos."
    },
    {
        "name": "Ecchi",
        "nameEs": "Subido de tono",
        "slug": "ecchi",
        "display": true,
        "description": "De corte humorístico con contenido erótico."
    },
    {
        "name": "Jidaimono",
        "nameEs": "Histórico",
        "slug": "jidaimono",
        "display": true,
        "description": "Ambientado en el Japón feudal."
    },
    {
        "name": "Gore",
        "nameEs": "Sangriento",
        "slug": "gore",
        "display": true,
        "description": "Género de anime asignado a aquellas series que poseen alta violencia gráfica, comúnmente estos son de terror. Literalmente, sangre derramada."
    },
    {
        "name": "Progresivo",
        "nameEs": "Progresivo",
        "slug": "progresivo",
        "display": true,
        "description": "Animación hecha con propósito de emular la originalidad japonesa."
    },
    {
        "name": "Cyberpunk",
        "nameEs": "Ciberpunk",
        "slug": "cyberpunk",
        "display": true,
        "description": "La historia sucede en un mundo donde los avances tecnológicos toman parte crucial en la historia, junto con algún grado de desintegración o cambio radical en el orden social."
    },
    {
        "name": "Furry",
        "nameEs": "Furros",
        "slug": "furry",
        "display": true,
        "description": "Significa peludo, conformado de Animales antropomórficos, que es la combinación de rasgos humanos y animales."
    },
    {
        "name": "Harem Inverso",
        "nameEs": "Harén Inverso",
        "slug": "harem-inverso",
        "display": true,
        "description": "Muchos hombres son atraídos por una misma mujer."
    },
    {
        "name": "Isekai",
        "nameEs": "Otro Mundo",
        "slug": "isekai",
        "display": true,
        "description": "Historia donde el protagonista es transportado a otro mundo, lugar donde comúnmente se desarrolla la historia."
    },
    {
        "name": "Kemono",
        "nameEs": "Animal",
        "slug": "kemono",
        "display": true,
        "description": "Humanos con rasgos de animales o viceversa."
    },
    {
        "name": "Meitantei",
        "nameEs": "Detective",
        "slug": "meitantei",
        "display": true,
        "description": "Es una historia policíaca."
    },
    {
        "name": "Victorian Fantasy",
        "nameEs": "Victoriana Fantástica",
        "slug": "victoriana-fantasy",
        "display": true,
        "description": "La historia sigue a un chico/chica del siglo xix que normalmente tiene alguna relación con alguna organización religiosa o gubernamental y que se enfrenta a energías sobrenaturales."
    },
    {
        "name": "Victorian Era",
        "nameEs": "Victoriana Histórica",
        "slug": "victorian-era",
        "display": true,
        "description": "A diferencia de la fantástica, la histórica nos muestra sucesos que ocurrieron en el siglo xix, con un toque de romance o comedia."
    },
    {
        "name": "Virtual Reality",
        "nameEs": "Realidad virtual",
        "slug": "virtual-reality",
        "display": true,
        "description": "En este caso los protagonistas están dentro de un videojuego en línea (RPG) y siguen una historia que puede ir variando mucho."
    },
    {
        "name": "Survival Game",
        "nameEs": "Juego de Supervivencia",
        "slug": "survival-game",
        "display": true,
        "description": "Este género es bastante conocido y siempre tiene bastante gore. Las historias de este tipo tratan de varios personajes que por diversos motivos se ven obligados a participar en un juego de supervivencia ya sea matándose unos a otros o haciendo equipo con otros personajes."
    },
    {
        "name": "Romakome",
        "nameEs": "Comedia Romántica",
        "slug": "romcom",
        "display": true,
        "description": "Es una comedia romántica."
    },
    {
        "name": "Sentai",
        "nameEs": "Escuadrón",
        "slug": "sentai",
        "display": true,
        "description": "En anime, se refiere a un grupo de superheróes."
    }
];

console.log('Seeding genre...');

await prisma.genre.createMany({
    data: genre,
    skipDuplicates: true,
});
