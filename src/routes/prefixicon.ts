import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import * as path from 'node:path';
import * as Jimp from 'jimp';
import * as fs from 'fs-extra';

import { prefixes, getNeededPaddingFromCompiledFrames, prefixIDApplicationOrder, sortPrefixesByApplicationOrder } from './../modules/schematics/prefixes';
import { createBSideImage } from './../modules/bside';
import { loadAnimatedCubeIcon, saveAnimatedCubeIcon } from 'src/modules/imageutils';
import { generatePrefixedCube } from 'src/modules/cubeiconutils';

const outputDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/singleprefixicons/`);

const route: CCOIcons.documentedRoute = {
    routes: ['/prefixicon/', '/prefixicon/:prefixid'],
    documentation: {
        title: "Get Prefix Icon",
        subtitle: "GETs a prefix icon without a cube.",
        resolves: "image",
        author: "AspectQuote",
        description: "Generates a prefix icon without the cube. However, if a prefix requires a cube then the 'green' cube will be added.",
        examples: [
            {
                name: "Captain Prefix Icon",
                example: "/prefixicon/Captain",
                description: "Will resolve into the icon of the Captain Prefix."
            },
            {
                name: "Contaminated Prefix Icon",
                example: "/prefixicon/Contaminated",
                description: "Will resolve into the icon of the Contaminated Prefix."
            }
        ],
        parameterDocs: [
            {
                parameter: ':prefixid',
                name: "Prefix ID",
                subtitle: "The prefix you want",
                description: "The prefix ID you want to request. Case-Sensitive.",
                required: false,
                requiredNote: "The server will default to the 'Sacred' prefix if no prefix ID is given.",
                examples: [
                    {
                        name: "Tentacular Prefix Icon",
                        example: "/prefixicon/Tentacular",
                        description: "Will resolve into the icon of the Tentacular Prefix."
                    },
                    {
                        name: "Sacred Prefix Icon",
                        example: "/prefixicon",
                        description: "Will resolve into the icon of the Sacred Prefix."
                    }
                ],
                requestBuilderPossibs: Object.keys(prefixes)
            }
        ],
        queryDocs: [
            {
                query: 'seed',
                name: "Prefix Seed",
                subtitle: "The desired prefix seed.",
                description: `The pattern can be any number from 0 to ${config.prefixPatternIndexLimit - 1}. This only affects prefixes with seeded variants. Supplying a number greater than ${config.prefixPatternIndexLimit - 1} will simply have the modulus of ${config.prefixPatternIndexLimit - 1} taken from that number. Supplying a number less than 0 will have its absolute value taken. NOTE: If no 'seed' is supplied then the server will default to pattern ID 1.`,
                examples: [
                    {
                        name: "Seed 220 Flaming Prefix",
                        example: "/prefixicon/Flaming?seed=220",
                        description: "Will return the Flaming Prefix with seed 220."
                    },
                    {
                        name: "Seed 1 Flaming Prefix",
                        example: "/prefixicon/Flaming",
                        description: "Will return the Flaming Prefix with seed 1."
                    }
                ],
                requestBuilderPossibs: [1].map(() => {
                    let validArray: string[] = [];
                    while (validArray.length < config.prefixPatternIndexLimit) {
                        validArray.push(`${validArray.length}`);
                    }
                    return validArray;
                }).flat(1)
            }
        ]
    },
    responseFunction: async (req, res) => {
        const iconName: CCOIcons.prefixID = (req.params.prefixid ?? "Sacred") as CCOIcons.prefixID;
        const usingCubeID: CCOIcons.cubeID = 'green';
        let seed = 1;
        let imagePath: string = '';
        if (Object.keys(prefixes).includes(iconName)) {
            if (typeof req.query.seed === "string") {
                let possiblePrefixSeed = Number.parseInt(req.query.seed);
                if (Number.isNaN(possiblePrefixSeed)) {
                    possiblePrefixSeed = 1;
                }
                if (possiblePrefixSeed < 0) {
                    possiblePrefixSeed = Math.abs(possiblePrefixSeed);
                }
                if (possiblePrefixSeed > (config.prefixPatternIndexLimit - 1)) {
                    possiblePrefixSeed = possiblePrefixSeed % (config.prefixPatternIndexLimit - 1);
                }
                seed = possiblePrefixSeed;
            }
            try {
                const fileName = `${iconName.toLowerCase()}${((prefixes[iconName].seeded) ? seed : '')}`;
                let outputFile = `${outputDirectory}/${fileName}.png`;
                if (!fs.existsSync(outputFile) || !config.usePrefixImageCache) {
                    // Create the image (if needed)
                    const outputAnimation = await generatePrefixedCube(await loadAnimatedCubeIcon(`${config.sourceImagesDirectory}cubes/${usingCubeID}/cube.png`), usingCubeID, [iconName], seed, 1, false);
                    await saveAnimatedCubeIcon(outputAnimation, fileName, outputDirectory, config.getCubeAnimationDelay(usingCubeID));
                    if (outputAnimation.length > 1) {
                        outputFile = `${outputDirectory}/${fileName}.gif`;
                    }
                    console.log(outputAnimation.length)
                }
                imagePath = outputFile;
            } catch (e) {
                console.log(e);
                res.status(403);
                return res.send('Failed to get this image. Internal error: ' + e);
            }
        } else {
            return res.send('Invalid Prefix ID.');
        }
        // Finally, send the file.
        res.sendFile(imagePath);
        return;
    }
}

export {
    route as prefixIconRoute
}