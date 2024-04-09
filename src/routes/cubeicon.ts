import * as CCOIcons from './../typedefs';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as Jimp from 'jimp';
let seedrandom = require('seedrandom');

const cubes: { [key in CCOIcons.cubeID]: CCOIcons.cubeDefinition } = fs.readJSONSync('./config/cubes.json');
const prefixes: { [key in CCOIcons.prefixID]: CCOIcons.cubeDefinition } = fs.readJSONSync('./config/prefixes.json');
const rarityConfig: { [key in CCOIcons.rarityID]: CCOIcons.rarityDefinition } = fs.readJSONSync('./config/rarityConfig.json')

const relativeRootDirectory = `${__dirname}/../../..`;
const sourceImagesDirectory = './sourceicons/cubes/';

const iconModifiers = {
    baseIcon: {
        directory: '/ccicons',
        modificationFunction: async function (modifyingPath, modifyingID, modifyingIcon, data: { seed: number }) {
            // Get the path of the output of the previous modification 
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${modifyingIcon}`);
            // Create the directory path of the outcome of this modification
            const outcomePath = path.resolve(`${relativeRootDirectory}/ccicons`);
            // Create the outcome path of the file
            const outcomeFile = `${outcomePath}/${modifyingID}.png`;
            // If the path to the directory doesn't exist, create it.
            if (!fs.pathExistsSync(outcomePath)) fs.mkdirSync(outcomePath, { recursive: true });
            // If the icon hasn't been generated yet, then generate it (in this case, it's copying it to the generated icons directory to make sure the original image isn't accidentally modified)
            if (!fs.existsSync(outcomeFile)) fs.copyFileSync(originalImagePath, outcomeFile);
            // Return the directory to add to the icon generation function.
            return `/ccicons/`;
        }
    },
    contraband: {
        directory: '/contraband',
        modificationFunction: async function(modifyingPath, modifyingID, modifyingIcon, data: any) {
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${modifyingIcon}`);
            // Create the directory path of the outcome of this modification
            const outcomePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}/contraband`);
            console.log(outcomePath)
            // Create the outcome path of the file
            const outcomeFile = `${outcomePath}/${modifyingID}.png`;
            // If the path to the directory doesn't exist, create it.
            if (!fs.pathExistsSync(outcomePath)) fs.mkdirSync(outcomePath, { recursive: true });
            // If the icon hasn't been generated yet, then generate it (in this case, it's masking the accent image with a 'contraband' image, then compositing the original image with the masked accent image.)
            if (!fs.existsSync(outcomeFile)) {
                const customMaskImagePath = `${sourceImagesDirectory}${modifyingID}/accents.png`;
                const maskImage = await Jimp.read((!fs.existsSync(customMaskImagePath)) ? `${sourceImagesDirectory}_DEFAULT_/accents.png` : customMaskImagePath);
                const baseImage = await Jimp.read(`${sourceImagesDirectory}${modifyingID}/cube.png`);
                const contrabandEffectImage = await Jimp.read(`./sourceicons/attributeeffects/contraband.png`);
                var patternRNG = new seedrandom(`${modifyingID}`);

                const cropX = Math.round(patternRNG() * (contrabandEffectImage.bitmap.width - baseImage.bitmap.width));
                const cropY = Math.round(patternRNG() * (contrabandEffectImage.bitmap.height - baseImage.bitmap.height));
                contrabandEffectImage.crop(cropX, cropY, baseImage.bitmap.width, baseImage.bitmap.height);
                contrabandEffectImage.mask(maskImage, 0, 0);
                baseImage.composite(contrabandEffectImage, 0, 0);
                await baseImage.writeAsync(outcomeFile);
            }
            return `/contraband/`;
        }
    },
    bSide: {
        directory: '/bside',
        modificationFunction: async function(modifyingPath, modifyingID, modifyingIcon, data: any) {
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${modifyingIcon}`);
            
            return `/bside`;
        }
    },
    divine: {
        directory: '/divine',
        modificationFunction: async function(modifyingPath, modifyingID, modifyingIcon, data: any) {
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${modifyingIcon}`);
            
            return `/divine`;
        }
    },
    slated: {
        directory: '/slated',
        modificationFunction: async function(modifyingPath, modifyingID, modifyingIcon, data: any) {
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${modifyingIcon}`);
            
            return `/slated`;
        }
    },
    prefixes: {
        directory: '/prefix',
        modificationFunction: async function (modifyingPath, modifyingID, modifyingIcon, data: { prefixes: string[], seed: number }) {
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${modifyingIcon}`);

            return `/prefix`;
        }
    },
    size: {
        directory: '/size',
        modificationFunction: async function (modifyingPath, modifyingID, modifyingIcon, data: { size: number }) {
            // Check if the size is a power of 2, within the bounds of 16-2048. If not, don't resize and don't return a new nested directory
            if (Number.isNaN(data.size) || data.size > 2048 || data.size < 16 || (Math.log(data.size) / Math.log(2)) % 1 !== 0) return '';

            // Get the path of the output of the previous modification
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${modifyingIcon}`);

            // Sizes can be in many forms, so let's create a separate directory for each size.
            const resizeDirectory = `/sizex${data.size}/`;

            // Create the directory path of the outcome of this modification
            const outcomeDirectory = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${resizeDirectory}`);

            // Create the outcome path of the file
            const outcomeFile = `${outcomeDirectory}/${modifyingIcon}`;

            // If the path to the directory doesn't exist, create it.
            if (!fs.pathExistsSync(outcomeDirectory)) fs.mkdirSync(outcomeDirectory, { recursive: true });

            // If the icon hasn't been generated yet, then generate it (in this case, it's simply reading the original image then resizing it.)
            if (!fs.existsSync(outcomeFile)) {
                // Read the original icon
                let cubeIcon = await Jimp.read(originalImagePath)

                // Resize the icon
                cubeIcon.resize(data.size, data.size, Jimp.RESIZE_NEAREST_NEIGHBOR)
                
                // Write the icon
                await cubeIcon.writeAsync(outcomeFile);
            }

            // Return the directory to add to the icon generation function.
            return resizeDirectory;
        }
    }
} satisfies {[key: string]: {
    directory: string,
    modificationFunction: (modifyingPath: string[], modifyingID: string, modifyingIcon: string, data: any) => Promise<string>
}}

interface cubeIconGenerationParameters {
    contraband: {
        use: boolean,
            data: any
    },
    bSide: {
        use: boolean,
            data: any
    },
    divine: {
        use: boolean,
            data: any
    },
    slated: {
        use: boolean,
            data: any
    },
    prefixes: {
        use: boolean,
            data: {
            prefixes: CCOIcons.prefixID[],
                seed: number
        }
    },
    size: {
        use: boolean,
            data: {
            size: number
        }
    }
}

async function generateCubeIcon(iconAttributes: Partial<cubeIconGenerationParameters>, cubeID: CCOIcons.cubeID, iconSeed: number): Promise<string> {
    let imageDirectories: string[] = [];
    let imageFileName = 'cube.png';
    const baseDirectory = await iconModifiers.baseIcon.modificationFunction([`/CCOIcons/sourceicons/cubes/${cubeID}/`], cubeID, imageFileName, { seed: iconSeed });
    imageFileName = `${cubeID}.png`;
    imageDirectories.push(baseDirectory);

    // These IF..ELSE statements are set up in this order to enforce the image application filter order... obviously we don't want 'b-side' to be applied after 'size' and stuff like that... it wouldn't look quite right

    if (iconAttributes.prefixes !== undefined && iconAttributes.prefixes.use === true) {
        imageDirectories.push(await iconModifiers.prefixes.modificationFunction(imageDirectories, cubeID, imageFileName, iconAttributes.prefixes.data));
    }
    
    if (iconAttributes.bSide !== undefined && iconAttributes.bSide.use === true) {
        imageDirectories.push(await iconModifiers.bSide.modificationFunction(imageDirectories, cubeID, imageFileName, iconAttributes.bSide.data));
    }
    
    if (iconAttributes.contraband !== undefined && iconAttributes.contraband.use === true) {
        imageDirectories.push(await iconModifiers.contraband.modificationFunction(imageDirectories, cubeID, imageFileName, iconAttributes.contraband.data));
    }
    
    if (iconAttributes.divine !== undefined && iconAttributes.divine.use === true) {
        imageDirectories.push(await iconModifiers.divine.modificationFunction(imageDirectories, cubeID, imageFileName, iconAttributes.divine.data));
    }
    
    if (iconAttributes.slated !== undefined && iconAttributes.slated.use === true) {
        imageDirectories.push(await iconModifiers.slated.modificationFunction(imageDirectories, cubeID, imageFileName, iconAttributes.slated.data));
    }
    
    if (iconAttributes.size !== undefined && iconAttributes.size.use === true) {
        imageDirectories.push(await iconModifiers.size.modificationFunction(imageDirectories, cubeID, imageFileName, iconAttributes.size.data));
    }
    
    return path.resolve(`${relativeRootDirectory}${imageDirectories.join('')}${imageFileName}`);
}

const route: CCOIcons.documentedRoute = {
    routes: ['/cubeicon/:cubeid/', '/cubeicon/'],
    documentation: {
        title: "Cube Icon",
        subtitle: "GETs icons for cubes, generates them if needed.",
        resolves: "image",
        author: "AspectQuote",
        description: "Blurb about icons and what this does",
        examples: [{
            name: "Large Green Cube Icon",
            example: "/cubeicon/green?s=512",
            description: "Will resolve into a 512x512 version of the Green Cube icon."
        }],
        parameterDocs: [
            {
                parameter: ':cubeid',
                name: "Cube ID",
                subtitle: "ID of any Cube",
                description: "Accepts any cube ID. Changes the requested icon to that cube ID. For example, 'green' will give the green cube icon. Similarly, 'red' will return the Red Cube's icon, so on and so forth.",
                required: false,
                requiredNote: "If no cubeid is given the server will return the 'green' cube icon.",
                examples: [
                    {
                        name: "Red Cube Icon",
                        example: "/cubeicon/red",
                        description: "Will return the icon for the red cube."
                    },
                    {
                        name: "Raccoon Cube Icon",
                        example: "/cubeicon/raccoon",
                        description: "Will return the icon for the raccoon cube."
                    }
                ]
            }
        ],
        queryDocs: [
            {
                query: 's',
                name: "Icon Size",
                subtitle: "The desired size.",
                description: "The desired size of the requested icon in pixels. Must be a power of 2, with the minimum being 16, and the maximum being 2048.",
                examples: [
                    {
                        name: "512x512 Cube Icon",
                        example: "/cubeicon?s=512",
                        description: "Will return the 'green' cubeID icon at a size of 512x512px."
                    },
                    {
                        name: "16x16 Cardboard Box Cube Icon",
                        example: "/cubeicon/cardboardbox?s=16",
                        description: "Will return the cardboard box icon at a size of 16x16px. Note: This is the smallest version of any icon you can request."
                    }
                ]
            },
            {
                query: 'c',
                name: "Contraband Attribute",
                subtitle: "Whether or not you want the contraband attribute modification to be applied.",
                description: "You don't have to include anything as part of this parameter, simply including 'c' as a query modifier in the URL is enough.",
                examples: [
                    {
                        name: "Contraband Green Cube Icon",
                        example: "/cubeicon?c",
                        description: "Will return the 'green' cubeID icon in its contraband variant."
                    },
                    {
                        name: "512x512 Contraband Red Cube Icon",
                        example: "/cubeicon/red?c&s=512",
                        description: "Will return the contraband red cube icon at a size of 512x512px. Note: 'c' is simply provided without any value in the URL."
                    }
                ]
            }
        ]
    },
    responseFunction: async (req, res) => {
        // Set requested cube ID variable
        let requestedCubeID: CCOIcons.cubeID;
        if (cubes[req.params.cubeid as CCOIcons.cubeID] !== undefined) {
            requestedCubeID = (req.params.cubeid as CCOIcons.cubeID) ?? 'green';
        } else {
            requestedCubeID = 'green';
        }
        console.log(requestedCubeID)
        // Cube icon generation parameters storer
        const cubeIconParams: Partial<cubeIconGenerationParameters> = {};
        if (Object.keys(req.query).length > 0) {
            if (typeof req.query.s === "string") { // Cube Icon Size query modifier
                cubeIconParams.size = {
                    use: true,
                    data: {
                        size: Number.parseInt(req.query.s)
                    }
                }
            }
            if (req.query.c !== undefined) {
                cubeIconParams.contraband = {
                    use: true,
                    data: {}
                }
            }
        }
        let imagePath = '';
        try {
            // Create the image (if needed) and get its path
            imagePath = await generateCubeIcon(cubeIconParams, requestedCubeID, 0);
        } catch (e) {
            console.log(e);
            res.status(403);
            res.send('Failed to get this image. Internal error: '+e)
        }
        // Finally, send the file.
        console.log(imagePath);
        res.sendFile(imagePath);
        return;
    }
}

export {
    route as cubeIconRoute
}