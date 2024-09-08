import path from "path";
import { cubeID, prefixID } from "./typedefs";
import fs from "fs-extra";
import { readDirectoryRecursively } from "./modules/miscutils";

const updatedCubes: cubeID[] = [
    "purple",
    "green",
    "blue",
    "pinkmushroom",
    "pinkeye",
    "redgoo",
    "aquarium",
    "ghostly",
    "rock",
    "redcrystal",
    "virgo",
    "taurus",
    "valentines",
    "olive",
    "corn",
    "arcade",
    "supreme",
    "melting",
    "tabby",
    "upsidedown",
    "broken",
    "foursided",
    "cowardly",
    "terrarium",
    "deathly",
    "psychedelic",
    "neonoir",
    "neonoirmk2",
    "illuminati",
    "blackcheckered",
    "red",
    "black",
    "white",
    "pinkgoo",
    "bluegoo",
    "greengoo",
    "pinkcrystal",
    "bluecrystal",
    "greencrystal",
    "glass",
    "scorpio",
    "sagittarius",
    "pisces",
    "obsidian",
    "sapphire",
    "rustedcube",
    "mossymetal",
    "distorted",
    "gilded",
    "hay",
    "ultrahd",
    "meaty",
    "greenbutton",
    "durasteel",
    "delusional",
    "adamantium",
    "sheenobsidian",
    "ruby",
    "goldrusted",
    "yellow",
    "pinkbuildingblock",
    "greenbuildingblock",
    "bean",
    "redgrass",
    "pinkcheckered",
    "maze",
    "barrel",
    "pancake",
    "steel",
    "gemini",
    "capricorn",
    "cancer",
    "aries",
    "bluegalaxy",
    "flamesteel",
    "yellowgalaxycube",
    "bakedpotato",
    "redbutton",
    "bluebutton",
    "configurum",
    "blooming",
    "cat",
    "orichalcum",
    "cake",
    "cubeonastick",
    "buddy",
    "bismuth",
    "brimstone",
    "redbuildingblock",
    "bluebuildingblock",
    "greencamo",
    "greentarget",
    "greenmushroom",
    "bluetarget",
    "burrito",
    "yelloweye",
    "redtarget",
    "purpletarget",
    "aries",
    "aquarius",
    "redeye",
    "pillar",
    "redgalaxy",
    "pinkgalaxy",
    "purplegalaxy",
    "minty",
    "gluttony",
    "bluenebula",
    "rednebula",
    "purplenebula",
    "earth",
    "planarsilk",
    "plastique",
    "mutes",
    "binary",
    "peppermint",
    "truerelic",
    "goldplanarsilk",
    "goldbrimstone",
    "goldsushi",
    "bluecamo",
    "redcamo",
    "pinkcamo",
    "bluemushroom",
    "redmushroom",
    "yellowmushroom",
    "autumnleaves",
    "pinktarget",
    "iron",
    "hologram",
    "greengrass",
    "holey",
    "boom",
    "mosaica",
    "invisible",
    "gold",
    "emerald",
    "copper",
    "sushi",
    "chicken",
    "dice",
    "tv",
    "neon",
    "therelic",
    "crust",
    "aspects",
    "kyanite",
    "crtmonitor",
    "weirdearth",
];
const updatedPrefixes: prefixID[] = [];

const iconDirectory = `./../ccicons/`
const allFiles = readDirectoryRecursively(iconDirectory);

const updatedCubeFiles = [...allFiles].filter(file => updatedCubes.find(cubeID => file.includes(`${cubeID}.png`) || file.includes(`${cubeID}.gif`) ) !== undefined)

const updatedPrefixFiles = [...allFiles].filter(file => updatedPrefixes.find(prefixID => !file.includes('.') && !file.includes('\\') && file.includes(`prefix`) && file.includes(prefixID.toLowerCase())) !== undefined)

const updatedPrefixCacheDirs = [...allFiles].filter(file => file.startsWith('prefixcache') && !file.endsWith('.png') && !!updatedPrefixes.find(prefixID => file.includes(prefixID.toLowerCase())))

updatedCubeFiles.forEach(filePath => {
    fs.unlinkSync(filePath);
    console.log(`Deleted Image: ${filePath}`);
});

updatedPrefixFiles.forEach(filePath => {
    fs.rmSync(filePath, { recursive: true, force: true });
    console.log(`Deleted Prefix Directory: ${filePath}`);
});

updatedPrefixCacheDirs.forEach(filePath => {
    fs.rmSync(filePath, { recursive: true, force: true });
    console.log(`Deleted Prefix Cache Directory: ${filePath}`);
});

console.log(`Update Complete.
Removed ${updatedCubeFiles.length} Cube Images.
Removed ${updatedPrefixFiles.length} Prefix Directories.
Removed ${updatedPrefixCacheDirs.length} Prefix Cache Directories.
`)