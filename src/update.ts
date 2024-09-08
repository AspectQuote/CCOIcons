import path from "path";
import { cubeID, prefixID } from "./typedefs";
import fs from "fs-extra";

const updatedCubes: cubeID[] = [];
const updatedPrefixes: prefixID[] = [];

const iconDirectory = `./../ccicons/`
const allFiles = fs.readdirSync(iconDirectory, { recursive: true }).filter(item => typeof item === "string");
const fileMapFunc = (item: string) => {
    return path.resolve(`${iconDirectory}${item}`);
};

console.log(allFiles)

const updatedCubeFiles = [...allFiles].filter(file => updatedCubes.find(cubeID => file.includes(`${cubeID}.png`) || file.includes(`${cubeID}.gif`) ) !== undefined).map(fileMapFunc);

const updatedPrefixFiles = [...allFiles].filter(file => updatedPrefixes.find(prefixID => !file.includes('.') && !file.includes('\\') && file.includes(`prefix`) && file.includes(prefixID.toLowerCase())) !== undefined).map(fileMapFunc);

const updatedPrefixCacheDirs = [...allFiles].filter(file => file.startsWith('prefixcache') && !file.endsWith('.png') && !!updatedPrefixes.find(prefixID => file.includes(prefixID.toLowerCase()))).map(fileMapFunc)

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