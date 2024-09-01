import path from "path";
import { cubeID, prefixID } from "./typedefs";
import fs from "fs-extra";

const updatedCubes: cubeID[] = ["blackcheckered", "red", "black", "white", "pinkgoo", "bluegoo", "greengoo", "pinkcrystal", "bluecrystal", "greencrystal", "glass", "scorpio", "sagittarius", "pisces", "obsidian", "sapphire", "rustedcube", "mossymetal", "distorted", "gilded", "hay", "ultrahd", "meaty", "greenbutton", "durasteel", "delusional", "adamantium", "sheenobsidian", "ruby", "goldrusted"];
const updatedPrefixes: prefixID[] = [];

const iconDirectory = `./../ccicons/`
const allFiles = fs.readdirSync(iconDirectory, { recursive: true }).filter(item => typeof item === "string");
const fileMapFunc = (item: string) => {
    return path.resolve(`${iconDirectory}${item}`);
};

const updatedCubeFiles = [...allFiles].filter(file => updatedCubes.find(cubeID => file.includes(`${cubeID}.png`) || file.includes(`${cubeID}.gif`) ) !== undefined).map(fileMapFunc);

const updatedPrefixFiles = [...allFiles].filter(file => updatedPrefixes.find(prefixID => !file.includes('.') && !file.includes('\\') && file.includes(`prefix`) && file.includes(prefixID.toLowerCase())) !== undefined).map(fileMapFunc);

updatedCubeFiles.forEach(filePath => {
    fs.unlinkSync(filePath);
    console.log(`Deleted: ${filePath}`);
});

updatedPrefixFiles.forEach(filePath => {
    fs.rmSync(filePath, { recursive: true, force: true });
    console.log(`Deleted Directory: ${filePath}`);
})

console.log(`Update Complete.
Removed ${updatedCubeFiles.length} Cube Images.
Removed ${updatedPrefixFiles.length} Prefix Directories.
`)