import * as cheerio from "cheerio";

export const projects = [
  {
    title: "A STORY ABOUT A GIRL WHO DEVELOPED SELECTIVE MUTISM",
    status: "Finalizado",
    type: "ONE SHOT",
    link: "https://visortmo.com/library/one_shot/63530/a-story-about-a-girl-who-developed-selective-mutism",
  },
  {
    title: "IINCHOU-CHAN TO FURYOU-CHAN",
    status: "Finalizado",
    type: "ONE SHOT",
    link: "https://visortmo.com/library/one_shot/63547/iinchou-chan-to-furyou-chan",
  },
  {
    title: "PSEUDO HAREM",
    status: "Finalizado",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/41116/gijiharem",
  },
  {
    title: "NETA CHARA TENSEI TO KA ANMARI DA!",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/55318/neta-chara-tensei-to-ka-anmari-da",
  },
  {
    title:
      "DESPUÉS DE LA ESCUELA, HAY CARAS QUE LA GENIAL MINAGAWA-SAN SÓLO ME MUESTRA A MÍ",
    status: "Finalizado",
    type: "ONE SHOT",
    link: "https://visortmo.com/library/one_shot/64393/despues-de-la-escuela-hay-caras-que-la-genial-minagawa-san-solo-me-muestra-a-mi",
  },
  {
    title: "TENSEI YOUJO WA AKIRAMENAI",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/53034/reincarnationslittlegirlnevergivesup",
  },
  {
    title: "A ZOMBIE AND HER MASTER",
    status: "Finalizado",
    type: "ONE SHOT",
    link: "https://visortmo.com/library/one_shot/67914/a-zombie-and-her-master",
  },
  {
    title: "THE COFFEE SHOP AND THE DEGENERATE WOMAN",
    status: "Finalizado",
    type: "ONE SHOT",
    link: "https://visortmo.com/library/one_shot/67963/the-coffee-shop-and-the-degenerate-woman",
  },
  {
    title: "PERSONA 4 - THE MAGICIAN",
    status: "Finalizado",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/68236/persona-4-the-magician",
  },
  {
    title:
      "TENSEI SHOUJO WA MAZU IPPO KARA HAJIMETAI ~ MAMONO GA IRU TOKA KIITENAI! ~",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/68404/tensei-shoujo-wa-mazu-ippo-kara-hajimetai-mamono-ga-iru-toka-kiitenai",
  },
  {
    title: "SUKI KOSO MOMO NO JOUZU NARE!",
    status: "Finalizado",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/58439/suki-koso-momo-no-jouzu-nare",
  },
  {
    title: "A SMARTPHONE IN LOVE",
    status: "Finalizado",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/60684/a-smartphone-in-love",
  },
  {
    title: "LOVE ME FOR WHAT I AM",
    status: "Finalizado",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/40624/fukakai-na-boku-no-subete-wo",
  },
  {
    title: "BIG BROTHER'S FAVOURITE SIBLING",
    status: "Finalizado",
    type: "ONE SHOT",
    link: "https://visortmo.com/library/one_shot/71260/big-brothers-favourite-sibling",
  },
  {
    title: "VRMMO DE SUMMONER HAJIMEMASHITA",
    status: "Finalizado",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/43730/vrmmo-de-summoner-hajimemashita",
  },
  {
    title: "FATE/GRAND ORDER - MASTER LOVES ASTOLFO",
    status: "Finalizado",
    type: "ONE SHOT",
    link: "https://visortmo.com/library/one_shot/71369/fategrand-order-master-loves-astolfo",
  },
  {
    title: "FULLMETAL ALCHEMIST - A FATHER'S FEELING",
    status: "Finalizado",
    type: "ONE SHOT",
    link: "https://visortmo.com/library/one_shot/71398/fullmetal-alchemist-a-fathers-feeling",
  },
  {
    title: "ISEKAI TRUCK 1",
    status: "Finalizado",
    type: "ONE SHOT",
    link: "https://visortmo.com/library/one_shot/71422/isekai-truck-1",
  },
  {
    title: "ISEKAI TRUCK 2",
    status: "Finalizado",
    type: "ONE SHOT",
    link: "https://visortmo.com/library/one_shot/71472/isekai-truck-2",
  },
  {
    title: "YANKEE AKUYAKU REIJOU TENSEI TENKA YUIGADOKUSON",
    status: "Finalizado",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/72500/yankee-akuyaku-reijou-tensei-tenka-yuigadokuson",
  },
  {
    title: "NEKO NO KOHANA",
    status: "Finalizado",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/55320/neko-no-kohana",
  },
  {
    title:
      "GENKAI KOE NO TENPU WA, TENSEI-SHA NI SHIKA ATSUKAENAI - OVERLIMIT SKILL HOLDERS -",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/56519/genkai-koe-no-tenpu-wa-tensei-sha-ni-shika-atsukaenai-overlimit-skill-holders",
  },
  {
    title: "SWORD, TIARA AND HIGH HEELS",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/58635/sword-tiara-and-high-heels",
  },
  {
    title: "LINDA KOHANA",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/74369/neko-no-kohana-2",
  },
  {
    title: "MINECRAFT ANIME EDITION",
    status: "Activo",
    type: "MANHWA",
    link: "https://visortmo.com/library/manhwa/74577/minecraft-anime-edition",
  },
  {
    title: "COCKROA-CHAN",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/73654/cockroachan",
  },
  {
    title: "TRAPITOS FOR EVERYONE!",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/75042/trapitos-for-everyone",
  },
  {
    title: "ANI YOME-SAN NO SEWA WO YAKU",
    status: "Finalizado",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/60480/ani-yome-san-no-sewa-wo-yaku",
  },
  {
    title: "YUUSHA TO MAOU NO KONPAKU REKITEI (EXTASIS)",
    status: "Finalizado",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/43011/yuusha-to-maou-no-konpaku-rekitei-extasis",
  },
  {
    title: "EL PEQUEÑO MUNDO DE LOS ANIMALITOS Y LAS VTUBERS",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/75594/the-small-world-of-animals-and-vtubers",
  },
  {
    title: "SUCCUBUS TAMER NO ISEKAI MUSOU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/75795/succubus-tamer-no-isekai-musou",
  },
  {
    title: "JINROUKI WINVURGA REBELLION",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/75807/jinroukiwinvurgarebellion",
  },
  {
    title: "HIKARU TO HIKARU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/76404/hikarutohikaru",
  },
  {
    title: "SATAN'S DAUGHTER IS A SUCCUBUS",
    status: "Finalizado",
    type: "MANHWA",
    link: "https://visortmo.com/library/manhwa/76419/satansdaughterisasuccubus",
  },
  {
    title: "SHOUJO NYUUMON",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/76435/shoujo-nyuumon",
  },
  {
    title:
      "ME CONVERTÍ EN UNA PROFESORA UNIVERSITARIA A LOS 14 AÑOS, PORQUE SOY UNA GENIO",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/76606/me-converti-en-una-profesora-universitaria-a-los-14-anos-porque-soy-una-genio",
  },
  {
    title: "KAWAI TAIGA NO JUNANA NICHIJOU DAIICHIWA",
    status: "Finalizado",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/76639/kawai-taiga-no-junana-nichijou-daiichiwa",
  },
  {
    title: "TS MUSUME EBISU-KUN",
    status: "Finalizado",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/76760/ts-musume-ebisu-kun",
  },
  {
    title: "ICHINICHI ICHI JIKAN DAKE NEKO NI NARU IMOUTO",
    status: "Finalizado",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/76840/ichinichi-ichi-jikan-dake-neko-ni-naru-imouto",
  },
  {
    title: "NOW THAT WE DRAW",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/76867/kakunaru-ue-wa",
  },
  {
    title: "HIME TO ONNA YUUSHA GA MUSUBARERU TAME NO 12 NO HIJIRI KOUI",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/76890/himetoonnayuushagamusubarerutameno12nohijirikoui",
  },
  {
    title: "DAI 3 OUJI WA SLOW LIFE O GOSHOMOU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/76891/dai-3-ouji-wa-slow-life-o-goshomou",
  },
  {
    title: "YUUSHA-SAMA WA HOUSHUU NI HITOZUMA O GO KIBOUDESU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/76910/theherowantsamarriedwomanasareward",
  },
  {
    title:
      "KOUSHAKU REIJOU NI TENSEI SHITESHIMATTA NODE, MENTAL OTOME NA ORE WA, ZENRYOKU DE ONNANOKO WO TANOSHIMIMASU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/77654/koushaku-reijou-ni-tensei-shiteshimatta-node-mental-otome-na-ore-wa-zenryoku-de-onnanoko-wo-tanoshimimasu",
  },
  {
    title: "THE DEVIL KISSES THE ROSARY",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/79300/the-devil-kisses-the-rosary",
  },
  {
    title: "TS EISEIHEI-SAN NO SENJOU NIKKI",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/79310/ts-eiseihei-san-no-senjou-nikki",
  },
  {
    title:
      "KAKURE TENSEI YUUSHA CHEAT SKILL TO YUUSHA JOB O KAKUSHITE DAINI NO JINSEI O TANOSHIN DE YARU!",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/79322/kakure-tensei-yuusha-cheat-skill-to-yuusha-job-o-kakushite-daini-no-jinsei-o-tanoshin-de-yaru",
  },
  {
    title: "JUUNENME, KIKAN O AKIRAMETA TENISHA WA IMASARA SHUJINKOU NI NARU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/79328/juunenme-kikan-o-akirameta-tenisha-wa-imasara-shujinkou-ni-naru",
  },
  {
    title:
      'EL DÍA QUE, YO, EL "FALSO HÉROE", EXPULSE A ÉL, EL "VERDADERO HÉROE", DEL GRUPO',
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/79355/el-dia-que-yo-el-falso-heroe-expulse-a-el-el-verdadero-heroe-del-grupo",
  },
  {
    title: "ONII-CHAN IS DONE FOR! - HIGHSCHOOL ONIMAI",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/79593/onii-chan-wa-oshimai-onna-doshi-no-ai",
  },
  {
    title: "DANNA GA NANI WO ITTE IRUKA WAKARANAI KEN",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/80029/dannagananiwoitteirukawakaranaiken",
  },
  {
    title: "SEEKERS - MEIKYUU SAIKYOU NO OJI-SAN, KAMI HAISHINSHA TO NARU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/80170/seekers-meikyuu-saikyou-no-oji-san-kami-haishinsha-to-naru",
  },
  {
    title: "PARADISE HELL",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/80378/paradise-hell",
  },
  {
    title:
      "ISEKAI DE BITCH NA MEGAMI-SAMA NO SHINJA WO FUYASU KANTAN NA OSHIGOTO DESU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/80582/isekai-de-bitch-na-megami-sama-no-shinja-wo-fuyasu-kantan-na-oshigoto-desu",
  },
  {
    title: "DANSHI KOUKOUSEI WA ISEKAI DE JK NI NATTA",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/81136/danshi-koukousei-wa-isekai-de-jk-ni-natta",
  },
  {
    title:
      "TSUIHOU SARETA RENKIN JUTSUSHI WA MUJIKAKU NI DENSETSU TONARU YANDERE IMOUTO (OUKOKU NO SHUGO RYUU) TO ISSHO NI HENKYOU DE SHIAWASE NI KURASHIMASU!",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/81781/tsuihousaretarenkinjutsushiwamujikakunidensetsutonaruyandereimoutooukokunoshugoryuutoisshonihenkyoudeshiawasenikurashimasu",
  },
  {
    title: "DDADDICTION",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/81817/ddaddiction",
  },
  {
    title: "ORE TO KIMITACHI NO DUNGEON SENSOU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/81821/oretokimitachinodungeonsensou",
  },
  {
    title:
      "A CAMBIO DE OBTENER EL PODER MÁS PODEROSO, ME CONVERTÍ EN UNA CHICA QUE NO QUIERE SENTIRSE INCÓMODA ESTANDO EN UN GRUPO EN EL QUE SÓLO HAY MUJERES.",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/79122/saikyou-no-chikara-wo-te-ni-ireta-kawari-ni-onnanoko-ni-narimashita-onna-dake-no-party-ni-boku-ga-haittemo-iwakan-ga-nai-no-wa-komaru-ndesu-ga",
  },
  {
    title: "EL HOMBRE INVENCIBLE QUE CONVIERTE A CUALQUIER RAZA EN SU ESPOSA",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/83972/cronicasdelreydelharenenotromundoelhombreinvenciblequeconvierteacualquierrazaensuesposa",
  },
  {
    title:
      "ISEKAI KAERI NO YUUSHA WA, DUNGEON GA SHUTSUGEN SHITA GENJITSU SEKAI DE, INFLUENCER NATTE KANE WO KASEGIMASU!",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/73762/isekaigaerinoyuushawadungeongashutsugenshitagenjitsusekaideinfluencerninattekinwokasegimasu",
  },
  {
    title: "TOMODACHI GA HOSHIKATTA NO DE AKUMA WO FUKKATSU SASEMASHITA WA!",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/83754/tomodachigahoshikattanodeakumawofukkatsusasemashitawa",
  },
  {
    title: "TABERU DAKE DE LEVEL-UP! DAMEGAMI TO ISSHO NI ISEKAI MUSOU",
    status: "Finalizado",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/43815/taberudakedelevelupdamegamitoisshoniisekaimusou",
  },
  {
    title: "SAIKYOU NO KUROKISHI♂, SENTOU MAID♀ NI TENSHOKU SHIMASHITA",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/40117/saikyounokurokishisentoumaidnitenshokushimashita",
  },
  {
    title: "KIMIWA KAWAII REPTILE!",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/81180/kimiwa-kawaii-reptile",
  },
  {
    title: "WAGA ITOSHI NO WOTA KANOJO",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/39228/waga-itoshi-no-wota-kanojo",
  },
  {
    title:
      "ISEKAI KARA KITA MAZOKU, HIROIMASHITA. UKKARI MORATTA BAKUDAI NA MARYOKU DE, DUNGEON NO ARU KURASHI WO MANKITSU SHIMASU.",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/84079/isekaikarakitamazokuhiroimashitaukkarimorattabakudainamaryokudedungeonnoarukurashiwomankitsushimasu",
  },
  {
    title: "ONII-CHAN WA OSHIMAI",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/32730/oniichanwaoshimai",
  },
  {
    title: "AMACHIN WA JISHOU ♂",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/40969/amachinwajishou",
  },
  {
    title: "MADARA RAMBLE",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/84164/madararamble",
  },
  {
    title: "SHIKANOKO NOKONOKO KOSHITANTAN",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/71285/shikanokonokonokokoshitantan",
  },
  {
    title: "ANTES DE REENCARNARME ERA HOMBRE, POR ESO RECHAZO EL HARÉN INVERSO",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/74519/tenseimaewaotokodattanodegyakuharemwaokotowarishiteorimasu",
  },
  {
    title:
      "¡ME HE CONVERTIDO EN UNA HERMOSA CHICA, PERO DECIDI SER UN ADICTO A LOS JUEGOS EN LINEA!",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/47897/ive-turned-into-a-bishoujo-but-i-chose-to-be-a-net-game-addict",
  },
  {
    title:
      "UNA JEFA QUE DA MIEDO, PERO A PARTIR DE AHORA VA A SER CADA VEZ MÁS FELIZ.",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/73212/una-jefa-que-da-miedo-pero-a-partir-de-ahora-va-a-ser-cada-vez-mas-feliz",
  },
  {
    title: "GIRI CHOKO GIRAI NO FUTARI",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/84383/girichokogirainofutari",
  },
  {
    title: "SWORD SAINT ADEL’S SECOND CHANCE",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/84387/swordsaintadelssecondchance",
  },
  {
    title: "WATASHI NO KOKORO WA OJI-SAN DEARU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/84392/watashinokokorowaojisandearu",
  },
  {
    title: "HOUKAGO, BOKU WA KIMI NI NARU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/84402/houkagobokuwakimininaru",
  },
  {
    title: "RIN-CHAN WA SUEZEN SHITAI",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/57462/rinchanwasuezenshitai",
  },
  {
    title: "CHISAI BOCCHI",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/84485/chisaibocchi",
  },
  {
    title: "FANTASY BISHOUJO JUNIKU OJISAN TO",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/47105/fantasybishoujojunikuojisanto",
  },
  {
    title: "MIMICRY GIRLS",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/84525/mimicrygirls",
  },
  {
    title: "KOTODAMA KANAETE! TOKIESENSEI",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/84564/kotodamakanaetetokiesensei",
  },
  {
    title: "¡ENSEÑAME A AMAR!",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/84582/ensenameaamar",
  },
  {
    title: "MIHOYO NO NICHIJOU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/84627/mihoyononichijou",
  },
  {
    title:
      "HAIKEI, TENGOKU NO NEESAN, YUUSHA NI NATTA MEI GA ERO SUGITE OJISAN, HOGOSHA TOKA SOROSORO MURI DESU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/84660/haikeitengokunoneesanyuushaninattameigaerosugiteojisanhogoshatokasorosoromuridesu",
  },
  {
    title: "DUNGEON ELF - DUNGEON NI TAKARABAKO GA ARU NO WA ATARIMAE DESU KA?",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/84833/dungeonelfdungeonnitakarabakogaarunowaatarimaedesuka",
  },
  {
    title: "SHUUEN NO MAJO TO SEKAI NO TABI",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/84840/shuuennomajotosekainotabi",
  },
  {
    title: "MINAMI KAMAKURA KŌKŌ JOSHI JITENSHA-BU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/24672/minamikamakurakoukoujoshijitenshabu",
  },
  {
    title: "OTOME BARE",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/39894/otomebare",
  },
  {
    title: "MAHOU SHOUJO JIHEN",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/65442/mahou-shoujo-jihen",
  },
  {
    title: "THE BLOOD PRINCESS AND THE KNIGHT",
    status: "Activo",
    type: "MANHUA",
    link: "https://visortmo.com/library/manhua/52026/the-blood-princess-and-the-knight",
  },
  {
    title: "JICHOU SHINAI MOTOYUUSHA NO TSUYOKUTE TANOSHII NEW GAME",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/37324/Jichou-shinai-Motoyuusha-no-Tsuyokute-Tanoshii-New-Game",
  },
  {
    title: "BOKU WA ONEE-CHAN NO OMOCHA",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/84939/bokuwaoneechannoomocha",
  },
  {
    title:
      "SOBODOL - YOMEI WAZUKA NO OBAA-CHAN, WAKAGAETTE MAGO TO IDOL NI NARU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/84969/sobodolyomeiwazukanoobaachanwakagaettemagotoidolninaru",
  },
  {
    title: "AISARE TENSHI NA CLASSMATE GA, ORE NI DAKE ITAZURA NI HOHOEMU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/84974/aisaretenshinaclassmategaorenidakeitazuranihohoemu",
  },
  {
    title: "LAST BOSS LOVE DEATH",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85011/lastbosslovedeath",
  },
  {
    title: "SEINARU OTOME TO HIMEGOTO WO",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85027/seinaruotometohimegotowo",
  },
  {
    title: "REINCARNE",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/64394/reincarne",
  },
  {
    title: "MAZOKU NO PET NI NARIMASHITE",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85065/mazokunopetninarimashite",
  },
  {
    title: "WAKARASERO! NAMAIKITSUNE-SAMA",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85092/wakaraseronamaikitsunesama",
  },
  {
    title: "ODA-CHAN TO AKECHI-KUN",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85193/odachantoakechikun",
  },
  {
    title:
      '"SAIKYOU SUTETASU" WO HIKITSUIDE NINGEN NI TENSEI SHITA KIYOSHIJUU BEHEMOTH, YUUSHA NO KONNYAKUSHA (OHIMESAMA) WO UKKARI NETOTTE SHIMAU',
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85199/saikyousutetasuwohikitsuideningennitenseishitakiyoshijuubehemothyuushanokonnyakushaohimesamawoukkarinetotteshimau",
  },
  {
    title:
      "MESUGAKI GA WATASHI WO WAKARASE NI KURU NO DE SHOURI NO MESUGAKI NO CHIKARA WO KARITE KOCCHI MO WAKA",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85213/mesugakigawatashiwowakarasenikurunodeshourinomesugakinochikarawokaritekocchimowaka",
  },
  {
    title: "MEMEMORI-KUN NI WA KANAWANAI 〰 SERIALIZED",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/55470/mememori-kun-ni-wa-kanawanai-serialized",
  },
  {
    title:
      "BANNOU SKILL NO RETTOU SEIJO: KIYOU SUGIRU NO DE BINBOU NI HANARIMASEN DESHITA",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85246/bannouskillnorettouseijokiyousugirunodebinbounihanarimasendeshita",
  },
  {
    title:
      "CHEAT DE KATEI SAIEN - TABUN WATASHI GA SEIREI HIME DAKEDO, HOKA NI NANORIDETA MONO GA IRU NO DE, KATEI SAIEN SHICHAIMASU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85277/cheatdekateisaientabunwatashigaseireihimedakedohokaninanoridetamonogairunodekateisaienshichaimasu",
  },
  {
    title: "DEADPOOL: SAMURAI 2ND SEASON",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85296/deadpoolsamurai2ndseason",
  },
  {
    title: "MULTIVERSE NO WATASHI, KOISHITE II DESU KA?",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85093/multiversenowatashikoishiteiidesuka",
  },
  {
    title: "KASANE GA SANE NO HATSUKOI DESU GA",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85348/kasanegasanenohatsukoidesuga",
  },
  {
    title:
      "CÓMO EL HERMANO PEQUEÑO QUE SE CONVIRTIÓ EN NIÑA SE CONVIRTIÓ EN LA NOVIA DE SU HERMANO MAYOR",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/77607/anikinokanojoninaruonnanokoninacchattaotouto",
  },
  {
    title: "LA LOBA QUE SE ENAMORÓ DE LA LUNA.",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85388/ookamiwatsukinikoiwosuru",
  },
  {
    title: "MAOU TOSHI",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85394/maoutoshi",
  },
  {
    title:
      "DESPUES DE QUE REENCARNE, MI EQUIPO ESTABA LLENO DE ''TRAVESTIS'', PERO ¡NO SOY UN SHOTACON!",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/60843/afterreincarnationmypartywasfulloftrapsbutimnotashotacon",
  },
  {
    title: "SERIAL KILLER ISEKAI NI ORITATSU: ISEKAI BATTLE ROYALE",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85419/serialkillerisekainioritatsuisekaibattleroyale",
  },
  {
    title: "TSUMI TO BATSU NO SPICA",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85435/tsumitobatsunospica",
  },
  {
    title: "LA GATITA YANDERE CUYO AMOR ES DEMASIADO PESADO - FULL COLOR",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85436/lagatitayanderecuyoamoresdemasiadopesadofullcolor",
  },
  {
    title: "LA GATITA YANDERE CUYO AMOR ES DEMASIADO PESADO",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/83157/lagatitayanderecuyoamoresdemasiadopesado",
  },
  {
    title: "KYOU KARA ORE WA LOLI NO HIMO!",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/39471/kyoukaraorewalolinohimo",
  },
  {
    title:
      "YAMI OCHI YUUSHA NO HAISHIN HAISHIN: TSUIHOU SARETA, KAKUSHI BOSS HEYA NI HOURIKOMARETA KEKKA BOSS TO TANSAKUSHA KARI HAISHIN WO HAJIMERU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85478/yamiochiyuushanohaishinhaishintsuihousaretakakushibossheyanihourikomaretakekkabosstotansakushakarihaishinwohajimeru",
  },
  {
    title: "HAREBARE BIYORI",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/69822/harebarebiyori",
  },
  {
    title:
      "BOUKEN NI WA, BUKI GA HITSUYOU DA! ~KODAWARI RUDY NO KAJIYA GURASHI",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85496/boukenniwabukigahitsuyoudakodawarirudynokajiyagurashi",
  },
  {
    title: "BFF",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85532/bff",
  },
  {
    title: "HAHA O TAZUNETE, ISEKAI NI",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85534/hahaotazuneteisekaini",
  },
  {
    title: "AYANO-SAN WA BABU-CHAN NI NARU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85544/ayanosanwababuchanninaru",
  },
  {
    title: "BOKURA NO LIBIDO",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85558/bokuranolibido",
  },
  {
    title: "MUSOU NO KAITAISHI",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85583/musounokaitaishi",
  },
  {
    title:
      "SHADOW ASSASSINS WORLD - KAGE WA USUI KEDO, SAIKYOU NINJA YATTEMASU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85607/shadowassassinsworldkagewausuikedosaikyouninjayattemasu",
  },
  {
    title: "MAYAKA EESAN WA USO GA TSUKENAI",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85631/mayakaeesanwausogatsukenai",
  },
  {
    title:
      "ZENSEI DE KAZOKU NI MEGUMARENAKATTA ORE, KONYO DE HA YASASHI KAZOKU NI KAKOMARERU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85640/zenseidekazokunimegumarenakattaorekonyodehayasashikazokunikakomareru",
  },
  {
    title: "SACCHAN TO KEN-CHAN WA KYOU MO ITTERU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85657/sacchantokenchanwakyoumoitteru",
  },
  {
    title:
      "MIRUKU SHIBORI HANTA NO ISEKAI SAKUNYUUKI ~ NOUKA NO SAENAI OTOKO GA ARAYURU SHUZOKU NO CHIKU B WO MOTEASOBI TORIKO NI SURU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85711/mirukushiborihantanoisekaisakunyuukinoukanosaenaiotokogaarayurushuzokunochikubwomoteasobitorikonisuru",
  },
  {
    title: "YUMENE CONNECT",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85717/yumeneconnect",
  },
  {
    title: "ANKOKU KISHI NO ORE DESU GA SAIKYOU NO SEIKISHI WO MEZASHIMASU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/51126/ankoku-kishi-no-ore-desu-ga-saikyou-no-seikishi-wo-mezashimasu",
  },
  {
    title: "DESTINY UNCHAIN ONLINE",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/74282/destiny-unchain-online",
  },
  {
    title:
      "TAIDANA AKUHAZUKASHIME KIZOKU NI TENSEI SHITA ORE, SCENARIO WO BUKKOWASHITARA KIKAKU GAI NO MARYOKU DE SAIKYO NI NATTA",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85743/taidanaakuhazukashimekizokunitenseishitaorescenariowobukkowashitarakikakugainomaryokudesaikyoninatta",
  },
  {
    title: "HITOJICHI KOUKAN GAME",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/79418/hitojichi-koukan-game",
  },
  {
    title: "KONO KOI WA CHONOURYOKU DE WA KAIKETSU DEKINAI",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85776/konokoiwachonouryokudewakaiketsudekinai",
  },
  {
    title: "KANOJO WO CHARAMAKE!",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85782/kanojowocharamake",
  },
  {
    title: "ZOMBIE SEKAI DE HAREM WO TSUKUROU",
    status: "Activo",
    type: "MANGA",
    link: "https://visortmo.com/library/manga/85802/zombiesekaideharemwotsukurou",
  },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


async function main() {
  console.log("starting...");
  
  for (const project of projects) {
    let file = await (await Bun.file("data.json")).json();
    if ((file[project.title]?.chapters || []).every((_chapter: any) => _chapter?.pages?.length > 0)) {
      console.log('already done', project.title);
      continue;
    }
    console.log(project);
    
    const html: string = await fetch(project.link, {
      headers: {
        Referer: "https://visortmo.com/",
      },
    }).then((res) => res.text());

    const $ = cheerio.load(html);
    let chapters: any = [];

    $("li.list-group-item.upload-link").each((chapterIndex, v) => {
      let scans = $(v).find("ul.list-group.list-group-flush.chapter-list > li");
      let scanIndex = scans
        .toArray()
        .findIndex((scanElem) =>
          $(scanElem).text().includes("KAZOKU NO FANSUB")
        );

      if (scanIndex !== -1) {
        const scanElem = scans[scanIndex];
        const chapterTitle =
          $(v).find(".btn-collapse").text().trim() ||
          `Capítulo ${
            $("li.list-group-item.upload-link").length - chapterIndex
          }`;
        const releaseDate = $(scanElem)
          .find(".fa-calendar")
          .parent()
          .text()
          .trim();
        const link = $(scanElem).find(".text-right a").attr("href");

        chapters.push({
          chapterTitle,
          releaseDate,
          link,
        });
      }
    });

    chapters = chapters.reverse();

    let i = 0;
    for (const chapter of chapters) {
      i++;
      file = await (await Bun.file("data.json")).json();
      if ((file[project.title]?.chapters || []).find((_chapter: any) => _chapter.link === chapter.link)?.pages?.length > 0) {
        console.log('already done', project.title, chapter.link);
        continue;
      }
      let uniqid;
      while (true) {
        console.log("attemping to get chapter...", chapter);

        const redirectHTML: string = await fetch(chapter.link, {
          headers: {
            Referer: project.link,
          },
        }).then((res) => res.text());

        let _uniqid = redirectHTML.match(/uniqid: '(.*?)'/)?.[1];

        if (_uniqid) {
          uniqid = _uniqid;
          break;
        }

        await wait(5000); // 5 seconds
      }

      console.log({ uniqid });

      const pagesHTML = await fetch(
        `https://visortmo.com/viewer/${uniqid}/cascade`,
        {
          headers: {
            Referer: project.link,
          },
        }
      ).then((res) => res.text());

      const pages$ = cheerio.load(pagesHTML);

      let pages: any[] = [];

      pages$("#main-container img").each((i, elem) => {
        pages.push(elem.attribs["data-src"]);
      });

      console.log(pages);
      file = await (await Bun.file("data.json")).json();

      if (!file[project.title]) {
        file[project.title] = {
          title: project.title,
          status: project.status,
          type: project.type,
          link: project.link,
          chapters: chapters,
        };
      }

      if (
        !file[project.title].chapters.find(
          (chapter: any) => chapter.chapterTitle === chapter.chapterTitle
        )
      ) {
        file[project.title].chapters.push({
          ...chapter,
          chapterNumber: i,
          pages,
        });
      }

      file[project.title].chapters = file[project.title].chapters.map((_chapter: any) => {
        if (chapter.link === _chapter.link) {
          _chapter.pages = pages;
        }
        return _chapter;
      });

      await Bun.write("data.json", JSON.stringify(file, null, 2));
    }
  }

  return true;
}

main()
  .then(() => console.log("done!"))
  .catch((err) => console.error(err));
