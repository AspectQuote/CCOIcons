import * as CCOIcons from './../typedefs';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as Jimp from 'jimp';
let seedrandom = require('seedrandom');

const cubes: { [key in CCOIcons.cubeID]: CCOIcons.cubeDefinition } = fs.readJSONSync('./config/cubes.json');
const prefixes: { [key in CCOIcons.prefixID]: CCOIcons.cubeDefinition } = fs.readJSONSync('./config/prefixes.json');
const rarityConfig: { [key in CCOIcons.rarityID]: CCOIcons.rarityDefinition } = fs.readJSONSync('./config/rarityConfig.json');
const patternSchema: { [key in CCOIcons.patternedCubeID]: CCOIcons.patternedCubeDefinition } = fs.readJSONSync('./config/patterneditems.json');
const patternedCubeIDs: CCOIcons.patternedCubeID[] = Object.keys(patternSchema) as CCOIcons.patternedCubeID[];

const relativeRootDirectory = `${__dirname}/../../..`;
const sourceImagesDirectory = './sourceicons/cubes/';

function seededWithinRange(low: number, high: number, seed: any) {
    return ((high - low) * seed()) + low;
}
async function generateSeededCubeIcon(cubeID: CCOIcons.patternedCubeID, seed: number): Promise<Jimp> {
    const patternInfo: undefined | CCOIcons.patternedCubeDefinition = patternSchema[cubeID];
    // Include cubeID just in case, without it patterns on multiple cubes could use the same positions, which would look uniform if multiple cubes used the same pattern options
    var patternRNG = new seedrandom(`${cubeID}${seed.toString()}`);

    // Image Directory
    const imageDirectory = `./sourceicons/seededcubetextures/${cubeID}`;

    // Load the base cube image from the seeded cube directory.
    let baseImage = await Jimp.read(`${imageDirectory}/base.png`)

    let patternImages = []
    for (let patternImageIndex = 0; patternImageIndex < patternInfo.patternimages.length; patternImageIndex++) {
        const patternImageData = patternInfo.patternimages[patternImageIndex];
        // Get rotated pattern image/create rotated pattern image
        let patternImage = await Jimp.read(`./sourceicons/textures/${patternImageData.path}.png`)

        // I love typedefs!!!
        let imageManipulations: { apply: "lighten" | "brighten" | "darken" | "desaturate" | "saturate" | "greyscale" | "spin" | "hue" | "mix" | "tint" | "shade" | "xor" | "red" | "green" | "blue", params: [number]}[] = [];

        // Brighten the pattern image
        if (patternImageData.seedbrightness) {
            const brightness = seededWithinRange(patternImageData.seedbrightnessrange[0], patternImageData.seedbrightnessrange[1], patternRNG);
            const manipulationMethod = brightness > 0 ? "lighten" : "darken";
            imageManipulations.push({ apply: manipulationMethod, params: [Math.abs(brightness)] });
        }

        // Saturate the pattern image
        if (patternImageData.seedsaturate) {
            const saturation = seededWithinRange(patternImageData.seedsaturaterange[0], patternImageData.seedsaturaterange[1], patternRNG);
            const manipulationMethod = saturation > 0 ? "saturate" : "desaturate";
            imageManipulations.push({ apply: manipulationMethod, params: [saturation] });
        }

        // Hue-Rotate the pattern image
        if (patternImageData.seedhuerotate) {
            imageManipulations.push({ apply: "hue", params: [Math.round(patternRNG() * 360)] });
        }

        // Scale the pattern image
        if (patternImageData.seedscale) {
            const scale = seededWithinRange(patternImageData.seedscalerange[0], patternImageData.seedscalerange[1], patternRNG);
            patternImage.resize(patternImage.bitmap.width * scale, patternImage.bitmap.height * scale, Jimp.RESIZE_NEAREST_NEIGHBOR)
        }

        // Rotate pattern image
        if (patternImageData.seedrotate) {
            let degrees = Math.floor(patternRNG() * 360)
            patternImage.rotate(degrees, false)
            const imageSizeTarget = Math.sqrt(Math.pow((patternImage.bitmap.width / 2), 2) + Math.pow((patternImage.bitmap.height / 2), 2))
            patternImage.crop((patternImage.bitmap.width - imageSizeTarget) / 2, (patternImage.bitmap.height - imageSizeTarget) / 2, imageSizeTarget, imageSizeTarget)
        }

        // Create cropped pattern image to the size of the pattern mask, at a random(seeded) position
        const cropXPos = Math.floor(patternRNG() * (patternImage.bitmap.width - baseImage.bitmap.width));
        const cropYPos = Math.floor(patternRNG() * (patternImage.bitmap.height - baseImage.bitmap.height));
        patternImage.crop(cropXPos, cropYPos, baseImage.bitmap.height, baseImage.bitmap.width);
        
        // Apply color manimpulatons, if they exist.
        if (imageManipulations.length > 0) patternImage.color(imageManipulations);

        patternImages.push(patternImage.clone());
    }

    for (let maskImageIndex = 0; maskImageIndex < patternInfo.masks.length; maskImageIndex++) {
        const maskInfo = patternInfo.masks[maskImageIndex];
        // Read random(seeded) mask image
        let maskImage = await Jimp.read(`${imageDirectory}/${maskInfo.images[Math.floor(maskInfo.images.length * patternRNG())]}.png`);
        // Mask the pattern image with the mask image and composite the modified masked image
        baseImage.composite(patternImages[maskInfo.patternimage].clone().mask(maskImage, 0, 0), 0, 0)
    }

    // Read mask overlay image and put that over the composite
    var overlayImage = await Jimp.read(`${imageDirectory}/finaloverlay.png`);
    baseImage.composite(overlayImage, 0, 0);

    return baseImage;
}

const iconModifiers = {
    baseIcon: {
        directory: '/ccicons',
        modificationFunction: async function (modifyingPath, modifyingID, modifyingIcon, data: { seed: number }) {
            // Get the path of the output of the previous modification 
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${modifyingIcon}`);
            // Create the directory path of the outcome of this modification
            const outcomePath = path.resolve(`${relativeRootDirectory}/ccicons`);
            // If the path to the directory doesn't exist, create it.
            if (!fs.pathExistsSync(outcomePath)) fs.mkdirSync(outcomePath, { recursive: true });

            // If the cube is seeded,
            if (patternedCubeIDs.find(patternedCubeID => patternedCubeID === modifyingID) !== undefined) {
                const cubeSeed = data.seed;
                // Create the outcome path of the file
                const outcomeFile = `${outcomePath}/${modifyingID}${cubeSeed}.png`;
                if (!fs.existsSync(outcomeFile)) {
                    let iconFile = await generateSeededCubeIcon(modifyingID as CCOIcons.patternedCubeID, cubeSeed);
                    await iconFile.writeAsync(outcomeFile);
                }
            } else {
                // Create the outcome path of the file
                const outcomeFile = `${outcomePath}/${modifyingID}.png`;
                // If the icon hasn't been generated yet, then generate it (in this case, it's copying it to the generated icons directory to make sure the original image isn't accidentally modified)
                if (!fs.existsSync(outcomeFile)) fs.copyFileSync(originalImagePath, outcomeFile);
            }
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
            // Create the outcome path of the file
            const outcomeFile = `${outcomePath}/${modifyingID}.png`;
            // If the path to the directory doesn't exist, create it.
            if (!fs.pathExistsSync(outcomePath)) fs.mkdirSync(outcomePath, { recursive: true });
            // If the icon hasn't been generated yet, then generate it (in this case, it's masking the accent image with a 'contraband' image, then compositing the original image with the masked accent image.)
            if (!fs.existsSync(outcomeFile)) {
                const customMaskImagePath = `${sourceImagesDirectory}${modifyingID}/accents.png`;
                const maskImage = await Jimp.read((!fs.existsSync(customMaskImagePath)) ? `${sourceImagesDirectory}_DEFAULT_/accents.png` : customMaskImagePath);
                const baseImage = await Jimp.read(`${originalImagePath}`);
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
    modificationFunction: (modifyingPath: string[], modifyingID: CCOIcons.cubeID, modifyingIcon: string, data: any) => Promise<string>
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
    imageFileName = `${cubeID}${(patternedCubeIDs.find(patternedCubeID => patternedCubeID === cubeID) !== undefined) ? iconSeed : ''}.png`;
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
            },
            {
                query: 'pattern',
                name: "Pattern Attribute",
                subtitle: "Request a specific pattern index from a cube.",
                description: "The pattern can be any number from 0 to 999. This only affects cubes with seeded patterns, or have a seeded prefix. Supplying a number greater than 999 will simply have the modulus of 999 taken from that number. Supplying a number less than 0 will simply have its absolute value taken. Supplying 'random' as the parameter will simply make the server take a random seed. NOTE: If no 'pattern' is supplied then the server will default to pattern ID 1.",
                examples: [
                    {
                        name: "Perfect Eclipse Cube Icon",
                        example: "/cubeicon/eclipse?pattern=984",
                        description: "Will return the 984th pattern index of the eclipse cube (the 'perfect' variant)."
                    },
                    {
                        name: "512x512 Random Chalkboard Cube Icon",
                        example: "/cubeicon/chalkboard?pattern=random",
                        description: "Will return a random Chalkboard Cube icon at a size of 512x512px. Note: 'pattern' is supplied 'random' instead of a pattern index."
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
        let cubeIconSeed = 1;
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
            if (typeof req.query.pattern === "string") {
                if (req.query.pattern === "random") {
                    cubeIconSeed = Math.floor(Math.random() * 1000);
                } else {
                    let possibleIconSeed = Number.parseInt(req.query.pattern);
                    if (Number.isNaN(possibleIconSeed)) {
                        possibleIconSeed = 1; // If an unparsable pattern was given
                    }
                    if (possibleIconSeed < 0) {
                        possibleIconSeed = Math.abs(possibleIconSeed); // If the seed is less than 0, then set it to the positive version of that number.
                    }
                    if (possibleIconSeed > 999) {
                        possibleIconSeed = possibleIconSeed % 999; // If the number is greater than the pattern limit, then just take the remainder of the number.
                    }
                    cubeIconSeed = possibleIconSeed;
                }
            }
        }
        let imagePath = '';
        try {
            // Create the image (if needed) and get its path
            imagePath = await generateCubeIcon(cubeIconParams, requestedCubeID, cubeIconSeed);
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