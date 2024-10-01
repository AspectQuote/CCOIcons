import path from "path";
import { cubeID, prefixID } from "./typedefs";
import fs from "fs-extra";
import { readDirectoryRecursively } from "./modules/miscutils";
import { boxID } from "./modules/schematics/boxes";

(async () => {
    const updatedCubes: cubeID[] = [];
    const updatedPrefixes: prefixID[] = [];
    const updatedBoxes: boxID[] = [ "spooky" ];

    const iconDirectory = `./../ccicons/`
    const allFiles: string[] = await readDirectoryRecursively(iconDirectory);
    
    const updatedCubeFiles = [...allFiles].filter(file => updatedCubes.find(cubeID => file.includes(`${cubeID}.png`) || file.includes(`${cubeID}.gif`) ) !== undefined)
    
    const updatedPrefixFiles = [...allFiles].filter(file => updatedPrefixes.find(prefixID => !file.includes('.') && file.includes(`prefix`) && file.includes(prefixID.toLowerCase())) !== undefined)
    
    const updatedPrefixCacheDirs = [...allFiles].filter(file => file.includes('prefixcache') && !file.endsWith('.png') && !!updatedPrefixes.find(prefixID => file.includes(prefixID.toLowerCase())))
    
    const updatedBoxFiles = [...allFiles].filter(file => file.includes('boxicons') && !!updatedBoxes.find(boxID => file.includes(boxID.toLowerCase())))
    
    updatedCubeFiles.forEach(filePath => {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted Image: ${filePath}`);
        }
    });
    
    updatedPrefixFiles.forEach(filePath => {
        if (fs.existsSync(filePath)) {
            fs.rmSync(filePath, { recursive: true, force: true });
            console.log(`Deleted Prefix Directory: ${filePath}`);
        }
    });
    
    updatedPrefixCacheDirs.forEach(filePath => {
        if (fs.existsSync(filePath)) {
            fs.rmSync(filePath, { recursive: true, force: true });
            console.log(`Deleted Prefix Cache Directory: ${filePath}`);
        }
    });
    
    updatedBoxFiles.forEach(filePath => {
        if (fs.existsSync(filePath)) {
            fs.rmSync(filePath, { recursive: true, force: true });
            console.log(`Deleted Box Image: ${filePath}`);
        }
    });
    
    console.log(`Update Complete.
    Removed ${updatedCubeFiles.length} Cube Images.
    Removed ${updatedPrefixFiles.length} Prefix Directories.
    Removed ${updatedPrefixCacheDirs.length} Prefix Cache Directories.
    Removed ${updatedBoxFiles.length} Box Images.
    `)
})()