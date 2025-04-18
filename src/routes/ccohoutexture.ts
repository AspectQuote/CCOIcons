import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import * as path from 'node:path';
import Jimp from 'jimp';
import * as fs from 'fs-extra';

const outputDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/ccohoutextures`);
let validCubeIDS: CCOIcons.cubeID[] = [
    "4dpumpkin",
    "abstractone",
    "abstracttwo",
    "adamantium",
    "aerogel",
    "airconditioner",
    "aldrins",
    "aliengrass",
    "amber",
    "amp",
    "angry",
    "apple",
    "aquarium",
    "aquarius",
    "aries",
    "arizona",
    "aspectcircuit",
    "aspectcircuittwo",
    "aspects",
    "australian",
    "autumn",
    "autumnleaves",
    "badass",
    "ballin",
    "banded",
    "barcode",
    "barn",
    "barrel",
    "basesixtyfour",
    "basetencube",
    "bash",
    "basket",
    "basketball",
    "battery",
    "beach",
    "beachball",
    "beefcube",
    "beehive",
    "binary",
    "bismuth",
    "black",
    "blackcat",
    "blackcheckered",
    "blackhole",
    "blackmarble",
    "blooming",
    "blue",
    "bluealien",
    "blueblock",
    "bluebook",
    "bluebuildingblock",
    "bluecamo",
    "bluecandycane",
    "bluechocobox",
    "bluecore",
    "bluecrystal",
    "bluecup",
    "bluedonut",
    "bluedrawers",
    "bluefabric",
    "blueflower",
    "bluefoliage",
    "bluegalaxy",
    "bluegift",
    "blueglowstick",
    "bluegoo",
    "bluegrinning",
    "bluejumble",
    "bluemarble",
    "bluemushroom",
    "bluenebula",
    "bluepastel",
    "bluepill",
    "bluepokerchip",
    "bluesplatcyub",
    "bluestriped",
    "bluetarget",
    "blueterra",
    "bluetiles",
    "bluetoaster",
    "bluevillabrick",
    "bomb",
    "boom",
    "boring",
    "bottomless",
    "brain",
    "brandnew",
    "bread",
    "brick",
    "brimstone",
    "brownbook",
    "brownpaperbag",
    "bubbly",
    "buddy",
    "bunnycosmo",
    "burger",
    "burrito",
    "butt",
    "butter",
    "cake",
    "calm",
    "cancer",
    "capricorn",
    "caramelapple",
    "cardboardbox",
    "cathedral",
    "cautionary",
    "cave",
    "celebratory",
    "chalkboard",
    "chicken",
    "childsafe",
    "chocolate",
    "cigarette",
    "cinderblock",
    "cinnamonroll",
    "climatechanged",
    "clock",
    "clover",
    "clubsuit",
    "cobbled",
    "coders",
    "collegeruled",
    "compacteddust",
    "compactedspice",
    "completelynormal",
    "confetti",
    "configurum",
    "constellation",
    "copper",
    "coral",
    "corn",
    "cowardly",
    "craftancient",
    "creepy",
    "crimson",
    "crowded",
    "crust",
    "cubehub",
    "cubeofmanyfaces",
    "cubitos",
    "cupidsarrow",
    "cutesy",
    "darkmatter",
    "deathly",
    "deductory",
    "deepsea",
    "deepspace",
    "derpycubeorsumidk",
    "desertcamo",
    "desolate",
    "diamond",
    "diamondsuit",
    "dice",
    "dog",
    "dragonglass",
    "dreamy",
    "dregs",
    "ducky",
    "durasteel",
    "dusk",
    "earth",
    "earthquake",
    "eclipse",
    "elixir",
    "emerald",
    "emo",
    "erupting",
    "eventhorizon",
    "fade",
    "feathered",
    "feathered2",
    "feathered3",
    "fiftysevenk",
    "firegem",
    "flushed",
    "forestfloor",
    "fourdee",
    "franklin",
    "freaky",
    "fridgec",
    "gara",
    "gara2",
    "garter",
    "gasoline",
    "gemini",
    "general",
    "ghost",
    "gilded",
    "glacial",
    "gluttony",
    "gold",
    "goldabstract",
    "goldalien",
    "goldbanded",
    "goldbrimstone",
    "goldciggies",
    "goldcinnammonroll",
    "goldclover",
    "goldenapple",
    "goldenslime",
    "goldfocused",
    "goldfrank",
    "goldilluminati",
    "goldinfinite",
    "goldmagatsu",
    "goldmonoone",
    "goldmonotwo",
    "goldmushroom",
    "goldrusted",
    "goldsushi",
    "goldtoaster",
    "goldworkingcube",
    "goodbye",
    "gradient1",
    "gradient2",
    "grease",
    "green",
    "greenalien",
    "greenbook",
    "greenbuildingblock",
    "greencamo",
    "greencandycane",
    "greenchocobox",
    "greencrystal",
    "greencup",
    "greendonut",
    "greendrawers",
    "greenfabric",
    "Greenfoliage",
    "greenglowstick",
    "greengoo",
    "greengrass",
    "greengrinning",
    "greenhazmat",
    "greenice",
    "greenjumble",
    "greenmarble",
    "greenmushroom",
    "greenpastel",
    "greenpill",
    "greenshell",
    "greensplatcyub",
    "greenstriped",
    "greentarget",
    "greentiles",
    "greentoaster",
    "greenvillabrick",
    "happe",
    "hateletter",
    "hay",
    "heartratemonitor",
    "heartsuit",
    "highasfuck",
    "holey",
    "hollow",
    "holywater",
    "honey",
    "horus1",
    "horus2",
    "houndstooth",
    "hurricane",
    "ice",
    "idol",
    "illuminati",
    "immaculate",
    "infernos",
    "infested",
    "infinity",
    "interrobang",
    "ionizing1",
    "ionizing2",
    "iron",
    "island",
    "jackolantern1",
    "jackolantern2",
    "jackolantern3",
    "jam",
    "joshpresent",
    "key0",
    "key1",
    "key2",
    "key3",
    "key4",
    "key5",
    "key6",
    "key7",
    "key8",
    "key9",
    "keya",
    "keyb",
    "keyc",
    "keyd",
    "keye",
    "keyf",
    "keyg",
    "keyh",
    "keyi",
    "keyj",
    "keyk",
    "keyl",
    "keym",
    "keyn",
    "keyo",
    "keyp",
    "keyq",
    "keyr",
    "keys",
    "keyt",
    "keyu",
    "keyv",
    "keyw",
    "keyx",
    "keyy",
    "keyz",
    "kissing",
    "kyanite",
    "lame",
    "landmass",
    "lazy",
    "leadbasedpaint",
    "lenny",
    "linkballotbox",
    "linkboredguy",
    "linkfawkes",
    "linksbongo",
    "linksflowers",
    "linksfreoncube",
    "linkshoneycomb",
    "linkskimono",
    "linkslightning",
    "linksmud",
    "linksneapolitan",
    "linksriver",
    "linoleum",
    "log",
    "loveletter",
    "luckysevens",
    "lunarflare",
    "lunchbox",
    "magatsu",
    "mango",
    "mangoindustrial",
    "manncube",
    "mantle",
    "marble",
    "margarine",
    "marshmallow",
    "maze",
    "meaty",
    "mellting",
    "melon",
    "melting",
    "meteor",
    "meteorite",
    "minty",
    "mirror",
    "mischievous",
    "missing",
    "missingtexture",
    "monocuba",
    "moon",
    "moony",
    "mossymetal",
    "mountainous",
    "mourning",
    "neglected",
    "no",
    "nostalgic",
    "nostalgic2",
    "nuclear",
    "nuked",
    "object",
    "obsidian",
    "oceano",
    "older",
    "olive",
    "oosherscloud",
    "ooshersfossil",
    "ooshersmagma",
    "ooshersmime",
    "ooshersrainbow",
    "opal1",
    "opal2",
    "opulent",
    "oracle",
    "orange",
    "orangebox",
    "orangedonut",
    "orangeflower",
    "orangefruit",
    "orangeterra",
    "orichalcum",
    "orthographic",
    "pandoras",
    "parallaxxs",
    "patchwork",
    "pathing",
    "peanutbutter",
    "pencil",
    "pensive",
    "pepecringe",
    "peppermint",
    "perceiving",
    "permafrost",
    "petrified1",
    "petrified2",
    "petrified3",
    "petrified4",
    "photon",
    "pillar",
    "pink",
    "pinkblock",
    "pinkbuildingblock",
    "pinkcamo",
    "pinkcandycane",
    "pinkcheckered",
    "pinkchocobox",
    "pinkcrystal",
    "pinkdonut",
    "pinkeye",
    "pinkfabric",
    "pinkflower",
    "pinkgalaxy",
    "pinkgoo",
    "pinkice",
    "pinkjumble",
    "pinkmushroom",
    "pinkpastel",
    "pinkpokerchip",
    "pinkshell",
    "pinksplatcyub",
    "pinkstriped",
    "pinktarget",
    "pinktiles",
    "pinktoaster",
    "pinkvillabrick",
    "pisces",
    "plaguecapsule",
    "plasticrings",
    "plum",
    "polkacapsule",
    "pomegranate",
    "pond",
    "popcorn",
    "propaganda",
    "psychedelic",
    "pumpkin",
    "purple",
    "purplealien",
    "purplecrystal",
    "purpledonut",
    "purpleflower",
    "purplegalaxy",
    "purplemushroom",
    "purplenebula",
    "purplepill",
    "purplepokerchip",
    "purpleshell",
    "purplestriped",
    "purpletarget",
    "purpleterra",
    "puzzle",
    "quark",
    "qubit",
    "racerhelmet",
    "radium",
    "rainbowcircuit",
    "red",
    "redalien",
    "redblock",
    "redbuildingblock",
    "redcamo",
    "redcandycane",
    "redchocobox",
    "redcore",
    "redcrystal",
    "redcup",
    "reddonut",
    "reddrawers",
    "redeye",
    "redfabric",
    "redfoliage",
    "redgalaxy",
    "redgift",
    "redglowstick",
    "redgoo",
    "redgrass",
    "redgrinning",
    "redhazmat",
    "redice",
    "redjumble",
    "redmarble",
    "redmushroom",
    "rednebula",
    "redpastel",
    "redpill",
    "redpokerchip",
    "redsplatcyub",
    "redstriped",
    "redtarget",
    "redterra",
    "redtoaster",
    "redvillabrick",
    "retro",
    "rock",
    "rose",
    "rotted",
    "rotten",
    "ruby",
    "rustedadamantite",
    "rustedcube",
    "sagittarius",
    "saltine",
    "sandcastle",
    "sapphire",
    "scorpio",
    "scrambling",
    "sdomas",
    "sed",
    "servercustomcube",
    "sheenobsidian",
    "shoji1",
    "shoji2",
    "shoji3",
    "shoji4",
    "shore",
    "shunned",
    "skin",
    "snail",
    "soaking",
    "sobbing",
    "softdrink",
    "soup",
    "spacedust",
    "spadesuit",
    "speaker",
    "splatter1",
    "splatter2",
    "splatter3",
    "stained",
    "static",
    "stock",
    "stone1",
    "stone2",
    "stone3",
    "stone4",
    "strawberryroll",
    "striped",
    "sun",
    "sunny",
    "sunset",
    "supercomputer",
    "supercooled",
    "superheated",
    "supreme",
    "sushi",
    "taurus",
    "tcore",
    "therelic",
    "tire",
    "toad",
    "toaster",
    "tofu",
    "tombstone",
    "topographical",
    "tornado",
    "tough",
    "treasuremap",
    "truerelic",
    "turf",
    "tv",
    "twilight",
    "ucore",
    "ufolaser",
    "ultralame",
    "unrealgreen",
    "unsettling",
    "unsignedletter",
    "upsidedown",
    "valentines",
    "vaporwave",
    "velvet",
    "virgo",
    "volcano",
    "waffle",
    "watamelon",
    "waves",
    "welcome",
    "white",
    "whitebaked",
    "whitedrawers",
    "whitegoo",
    "winebottle",
    "woqas",
    "working",
    "wormhole",
    "worried",
    "worshipped",
    "xpcube",
    "xviremix",
    "yellow",
    "yellowcup",
    "yellowdonut",
    "yellowdrawers",
    "yelloweye",
    "yellowgalaxycube",
    "yellowglowstick",
    "yellowhazmat",
    "yellowmarble",
    "yellowmushroom",
    "yellowpill",
    "yellowshell",
    "yellowstriped",
    "yinyang",
    "zsaga",
    "stitched",
    "missingno",
    "gilbert",
    "aspectsmodifiedgaze"
]

const route: CCOIcons.documentedRoute = {
    routes: ['/ccohoutexture/:cubeid/'],
    documentation: {
        title: "Get CCOHou Cube Texture",
        subtitle: "GETs custom texture that matches a CCOHou UV map.",
        resolves: "image",
        author: "AspectQuote",
        description: "Uses basic linear maths to map cube icons to 3D Model UVs. These icons are used in a project that hasn't been released yet.",
        examples: [
            {
                name: "Red Cube UV",
                example: "/ccohoutexture/red",
                description: "Retrieves the generated UV for the red cube from the server."
            },
            {
                name: "Event Horizon Cube UV",
                example: "/ccohoutexture/eventhorizon",
                description: "Retrieves the generated UV for the event horizon cube from the server."
            }
        ],
        parameterDocs: [
            {
                parameter: ':cubeid',
                name: "CubeID",
                subtitle: "The ID of a valid CubeID",
                description: "Only certain IDs are valid.",
                required: true,
                requiredNote: "You need a cube ID to get a cube's image, obviously.",
                examples: [
                    {
                        name: "Green Cube UV",
                        example: "/ccohoutexture/green",
                        description: "Retrieves the generated UV for the green cube from the server."
                    },
                    {
                        name: "Australian Cube UV",
                        example: "/ccohoutexture/australian",
                        description: "Retrieves the generated UV for the australian cube from the server."
                    }
                ],
                requestBuilderPossibs: validCubeIDS
            }
        ],
        queryDocs: []
    },
    responseFunction: async (req, res) => {
        if (!validCubeIDS.includes(req.params.cubeid as CCOIcons.cubeID)) return res.send("Invalid Cube ID");
        const cubeID: CCOIcons.cubeID = (req.params.cubeid as CCOIcons.cubeID);
        let imagePath: string = '';
        const sourceFile = `./sourceicons/cubes/${cubeID}/cube.png`;
        const outputFile = `${outputDirectory}/${cubeID}.png`;
        if (!fs.existsSync(outputFile) || config.devmode) {
            // Create the image (if needed)
            const outputImage = createCCOHouImage(await Jimp.read(sourceFile));
            await outputImage.writeAsync(outputFile);
        }
        imagePath = outputFile;
        // Finally, send the file.
        res.setHeader("Access-Control-Allow-Origin", "*");
        return res.sendFile(imagePath);
    }
}

function createCCOHouImage(image: Jimp): Jimp {
    image.resize(32, 32, Jimp.RESIZE_NEAREST_NEIGHBOR);
    let outputFile = new Jimp(64, 48, 0x00000000);
    let topUpperLerpLine = {
        start: {x: 0, y: 8},
        end: {x: 16, y: 0},
        domain: 15
    }
    let topLowerLerpLine = {
        start: {x: 16, y: 16},
        end: {x: 31, y: 8},
        domain: 15
    }
    function getPointOnLerpLine(line: typeof topUpperLerpLine, x: number) {
        let xIncrement = (line.end.x - line.start.x) / line.domain;
        let yIncrement = (line.end.y - line.start.y) / line.domain;
        let output = {
            x: Math.round(line.start.x + (xIncrement * x)),
            y: Math.round(line.start.y + (yIncrement * x))
        };
        return output;
    }
    for (let topTextureX = 0; topTextureX < 16; topTextureX++) {
        let outputFileY = 15 - topTextureX;
        let currentLerpLine: typeof topUpperLerpLine = {
            start: getPointOnLerpLine(topUpperLerpLine, topTextureX),
            end: getPointOnLerpLine(topLowerLerpLine, topTextureX),
            domain: 15
        }
        for (let topTextureY = 0; topTextureY < 16; topTextureY++) {
            let outputFileX = 16 + topTextureY;
            let inputFileCoords = getPointOnLerpLine(currentLerpLine, topTextureY);
            outputFile.setPixelColor(image.getPixelColor(inputFileCoords.x, inputFileCoords.y), outputFileX, outputFileY);
        }
    }

    let leftUpperLerpLine = {
        start: { x: 0, y: 9 },
        end: { x: 15, y: 17 },
        domain: 15
    }
    let leftLowerLerpLine = {
        start: { x: 0, y: 23 },
        end: { x: 15, y: 31 },
        domain: 15
    }
    for (let leftTextureX = 0; leftTextureX < 16; leftTextureX++) {
        let outputFileX = 16 + leftTextureX;
        let currentLerpLine: typeof topUpperLerpLine = {
            start: getPointOnLerpLine(leftUpperLerpLine, leftTextureX),
            end: getPointOnLerpLine(leftLowerLerpLine, leftTextureX),
            domain: 15
        }
        for (let leftTextureY = 0; leftTextureY < 16; leftTextureY++) {
            let outputFileY = 16 + leftTextureY;
            let inputFileCoords = getPointOnLerpLine(currentLerpLine, leftTextureY);
            outputFile.setPixelColor(image.getPixelColor(inputFileCoords.x, inputFileCoords.y), outputFileX, outputFileY);
        }
    }

    let rightUpperLerpLine = {
        start: { x: 16, y: 17 },
        end: { x: 31, y: 9 },
        domain: 15
    }
    let rightLowerLerpLine = {
        start: { x: 16, y: 31 },
        end: { x: 31, y: 23 },
        domain: 15
    }
    for (let rightTextureX = 0; rightTextureX < 16; rightTextureX++) {
        let outputFileX = 32 + rightTextureX;
        let currentLerpLine: typeof topUpperLerpLine = {
            start: getPointOnLerpLine(rightUpperLerpLine, rightTextureX),
            end: getPointOnLerpLine(rightLowerLerpLine, rightTextureX),
            domain: 15
        }
        for (let rightTextureY = 0; rightTextureY < 16; rightTextureY++) {
            let outputFileY = 16 + rightTextureY;
            let inputFileCoords = getPointOnLerpLine(currentLerpLine, rightTextureY);
            outputFile.setPixelColor(image.getPixelColor(inputFileCoords.x, inputFileCoords.y), outputFileX, outputFileY);
        }
    }
    return outputFile;
}

export {
    route as CCOHouTextureRoute
}