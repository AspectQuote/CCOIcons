import * as CCOIcons from './../typedefs';
import * as config from '../modules/schematics/config';
import { prefixes } from 'src/modules/schematics/prefixes';
import fs from 'fs-extra';
import { cubeIconGenerationParameters, generateCubeIcon, generatePrefixedCube } from 'src/modules/cubeiconutils';
import { loadAnimatedCubeIcon, saveAnimatedCubeIcon } from 'src/modules/imageutils';
import Jimp from 'jimp';
import path from 'path';

const route: CCOIcons.documentedRoute = {
    routes: ['/cubeiconbsidealgorithmcomparison/'],
    documentation: {
        title: "Cube Icon B-Side Algorithm Comparison",
        subtitle: "GETs an image used for comparing b-side algorithms.",
        resolves: "image",
        author: "AspectQuote",
        description: "Creates B-Side images of random cubes with random patterns and prefixes.",
        examples: [],
        parameterDocs: [],
        queryDocs: []
    },
    responseFunction: async (req, res) => {
        if (!config.devmode) return res.json({ message: "devmode must be enabled for this to function" })
        const prefixPool: CCOIcons.prefixID[] = Object.keys(prefixes) as CCOIcons.prefixID[];
        const cubes: { [key in CCOIcons.cubeID]: CCOIcons.cubeDefinition } = fs.readJSONSync('./config/cubes.json');
        const cubePool = Object.keys(cubes) as CCOIcons.cubeID[];

        const usingPrefixes: CCOIcons.prefixID[] = [];
        const usingCubeID = cubePool[Math.floor(Math.random() * cubePool.length)];
        while ((Math.random() < 0.5 && usingPrefixes.length < 3)) {
            usingPrefixes.push(prefixPool[Math.floor(Math.random() * prefixPool.length)])
        }

        const cubeSeed = Math.floor(Math.random() * config.cubePatternIndexLimit);
        const prefixSeed = Math.floor(Math.random() * config.prefixPatternIndexLimit);

        const iconGenerationParameters: Partial<cubeIconGenerationParameters> = {
            prefixes: {
                use: usingPrefixes.length > 0,
                data: {
                    prefixes: usingPrefixes,
                    prefixSeed,
                    cubeSeed
                }
            }
        }

        const bSideV1Icon = await loadAnimatedCubeIcon(await generateCubeIcon({ ...iconGenerationParameters, bSide: { use: true, data: { algorithm: "V1" } } }, usingCubeID, cubeSeed, false));
        const bSideV2Icon = await loadAnimatedCubeIcon(await generateCubeIcon({ ...iconGenerationParameters, bSide: { use: true, data: { algorithm: "V2" } } }, usingCubeID, cubeSeed, false));

        const compositeImageBase = new Jimp(bSideV1Icon[0].bitmap.width + bSideV2Icon[0].bitmap.width, Math.max(bSideV1Icon[0].bitmap.height, bSideV2Icon[0].bitmap.height ), 0x00000000);
        const compositeFrames: Jimp[] = [];
        
        for (let cubeIconFrameIndex = 0; cubeIconFrameIndex < bSideV1Icon.length; cubeIconFrameIndex++) {
            const V1Frame = bSideV1Icon[cubeIconFrameIndex];
            const V2Frame = bSideV2Icon[cubeIconFrameIndex];
            
            const newFrame = compositeImageBase.clone();
            newFrame.composite(V1Frame, 0, 0);
            newFrame.composite(V2Frame, V1Frame.bitmap.width, 0);

            compositeFrames.push(newFrame);
        }

        const outputDirectory = `./../ccicons/randombsidealgorithmcomparisons/`;
        const outputFileName = `${usingCubeID}${usingPrefixes.sort().join('')}.${(compositeFrames.length === 1) ? 'png' : 'gif'}`;
        if (!fs.existsSync(outputDirectory)) fs.mkdirSync(outputDirectory, { recursive: true });
        const output = await saveAnimatedCubeIcon(compositeFrames, outputFileName, outputDirectory, config.getCubeAnimationDelay(usingCubeID));
        if (output) {
            const finalPath = path.resolve(`${outputDirectory}/${outputFileName}`);
            console.log(finalPath)
            return res.sendFile(finalPath);
        } else {
            return res.json({ success: false, message: "Failed to save animated cube icon." });
        }
    }
}

export {
    route as cubeIconBSideAlgorithmComparison
}