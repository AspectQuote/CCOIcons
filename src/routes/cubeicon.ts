import * as CCOIcons from './../typedefs';
import * as fs from 'fs-extra';
import * as path from 'path';
import Jimp from 'jimp';
import { JimpBitmap } from 'gifwrap';
import { createBSideImage } from './../modules/bside';
import { loadAnimatedCubeIcon, saveAnimatedCubeIcon, strokeImage } from './../modules/imageutils';
let seedrandom = require('seedrandom');

const cubes: { [key in CCOIcons.cubeID]: CCOIcons.cubeDefinition } = fs.readJSONSync('./config/cubes.json');
const prefixes: { [key in CCOIcons.prefixID]: CCOIcons.cubeDefinition } = fs.readJSONSync('./config/prefixes.json');
const rarityConfig: { [key in CCOIcons.rarityID]: CCOIcons.rarityDefinition } = fs.readJSONSync('./config/rarityConfig.json');
const patternSchema: { [key in CCOIcons.patternedCubeID]: CCOIcons.patternedCubeDefinition } = fs.readJSONSync('./config/patterneditems.json');
const patternedCubeIDs: CCOIcons.patternedCubeID[] = Object.keys(patternSchema) as CCOIcons.patternedCubeID[];

const patternIndexLimit = 1000;
const patternAtlasRoot = Math.ceil(Math.sqrt(patternIndexLimit));
const patternAtlasPadding = 1;

const resizeMax = 512;
const resizeMin = 16;

const relativeRootDirectory = `${__dirname}/../../..`;
const sourceImagesDirectory = './sourceicons/cubes/';

function clampRandomHiLo(low: number, high: number, seed: any) {
    return ((high - low) * seed) + low;
}

type cubeSeedValues = {
    brightness: number
    saturation: number
    scale: number
    hue: number
    rotation: number
    cropX: number
    cropY: number
    maskImage: number[]
}
function getSeededIconRNGValues(cubeID: CCOIcons.patternedCubeID, seed: number, offset: number): cubeSeedValues {
    const RNGenerator = new seedrandom(`${cubeID}${seed.toString()}${offset.toString()}`);
    const seedValuesObj: cubeSeedValues = {
        brightness: RNGenerator(),
        saturation: RNGenerator(),
        scale: RNGenerator(),
        hue: RNGenerator(),
        rotation: RNGenerator(),
        cropX: RNGenerator(),
        cropY: RNGenerator(),
        maskImage: [RNGenerator(), RNGenerator(), RNGenerator(), RNGenerator(), RNGenerator(), RNGenerator(), RNGenerator(), RNGenerator(), RNGenerator(), RNGenerator()]
    }
    return seedValuesObj;
}

const xAtlasTypes = ["base", "accents", "eyes", "mouths"] as const;
function getPatternAtlasCoordinates(iconWidth: number, iconHeight: number, patternIndex: number, type: typeof xAtlasTypes[number]): {x: number, y: number} {
    const xPatternTypeCoordinateAddition = xAtlasTypes.indexOf(type) * iconWidth * patternAtlasRoot;
    const x = xPatternTypeCoordinateAddition + (iconWidth * (patternIndex % patternAtlasRoot));
    const y = iconHeight * Math.floor(patternIndex / patternAtlasRoot);
    return {x, y};
}

async function getSeededIconAtlas(cubeID: CCOIcons.patternedCubeID): Promise<Jimp> {
    const patternInfo: undefined | CCOIcons.patternedCubeDefinition = patternSchema[cubeID];
    const patternAtlasDirectory = path.resolve(`${relativeRootDirectory}/ccicons/patternatlases`);
    if (!fs.existsSync(patternAtlasDirectory)) fs.mkdirSync(patternAtlasDirectory, { recursive: true });
    const patternAtlasFilePath = path.resolve(`${patternAtlasDirectory}/${cubeID}patternatlas.png`);
    if (fs.existsSync(patternAtlasFilePath)) {
        return await Jimp.read(patternAtlasFilePath);
    } else {
        // Image Directory
        const imageDirectory = `./sourceicons/seededcubetextures/${cubeID}`;
        // Load the base cube image from the seeded cube directory.
        const baseImage = await Jimp.read(`${imageDirectory}/base.png`)

        const iconWidth = (baseImage.bitmap.width + (patternAtlasPadding * 2));
        const iconHeight = (baseImage.bitmap.height + (patternAtlasPadding * 2));
        
        const newPatternAtlas: Jimp = new Jimp((patternAtlasRoot * iconWidth * xAtlasTypes.length) - (patternAtlasPadding * 2), (patternAtlasRoot * iconHeight) - (patternAtlasPadding * 2), 0x00000000);
        // Read mask overlay image and put that over the composite later
        const overlayImage = await Jimp.read(`${imageDirectory}/finaloverlay.png`);

        for (let patternIndex = 0; patternIndex < patternIndexLimit; patternIndex++) {
            let patternImages: { [key in typeof xAtlasTypes[number]]?: undefined | Jimp }[] = []
            const overallPatternSeedRNG = getSeededIconRNGValues(cubeID, patternIndex, 0);
            for (let patternImageIndex = 0; patternImageIndex < patternInfo.patternimages.length; patternImageIndex++) {
                const individualPatternSeedRNG = getSeededIconRNGValues(cubeID, patternIndex, patternImageIndex);
                const patternImageData = patternInfo.patternimages[patternImageIndex];

                let patternImageLayers: { [key in typeof xAtlasTypes[number]]: Jimp | undefined} = {
                    base: undefined,
                    accents: undefined,
                    eyes: undefined,
                    mouths: undefined
                };
                for (let patternImageLayerIndex = 0; patternImageLayerIndex < Object.keys(patternImageLayers).length; patternImageLayerIndex++) {
                    const key: keyof typeof patternImageLayers = Object.keys(patternImageLayers)[patternImageLayerIndex] as keyof typeof patternImageLayers;
                    const imageFilePath = path.resolve(`./sourceicons/textures/${patternImageData.path}/${key}.png`);
                    if (fs.existsSync(imageFilePath)) {
                        patternImageLayers[key] = await Jimp.read(imageFilePath);
                        // I love typedefs!!!
                        let imageManipulations: { apply: "lighten" | "brighten" | "darken" | "desaturate" | "saturate" | "greyscale" | "spin" | "hue" | "mix" | "tint" | "shade" | "xor" | "red" | "green" | "blue", params: [number] }[] = [];
                        if (key === "base") {
                            // Brighten the pattern image
                            if (patternImageData.seedbrightness) {
                                const brightness = clampRandomHiLo(patternImageData.seedbrightnessrange[0], patternImageData.seedbrightnessrange[1], individualPatternSeedRNG.brightness);
                                const manipulationMethod = brightness > 0 ? "lighten" : "darken";
                                imageManipulations.push({ apply: manipulationMethod, params: [Math.abs(brightness)] });
                            }
                            // Saturate the pattern image
                            if (patternImageData.seedsaturate) {
                                const saturation = clampRandomHiLo(patternImageData.seedsaturaterange[0], patternImageData.seedsaturaterange[1], individualPatternSeedRNG.saturation);
                                const manipulationMethod = saturation > 0 ? "saturate" : "desaturate";
                                imageManipulations.push({ apply: manipulationMethod, params: [saturation] });
                            }
                
                            // Hue-Rotate the pattern image
                            if (patternImageData.seedhuerotate) {
                                imageManipulations.push({ apply: "hue", params: [Math.round(individualPatternSeedRNG.hue * 360)] });
                            }
                        }
                        if (patternImageLayers[key] !== undefined) {
                            const JimpImg: Jimp = patternImageLayers[key] as Jimp;
                            // Scale the pattern image
                            if (patternImageData.seedscale) {
                                const scale = clampRandomHiLo(patternImageData.seedscalerange[0], patternImageData.seedscalerange[1], individualPatternSeedRNG.scale);
                                JimpImg.resize(JimpImg.bitmap.width * scale, JimpImg.bitmap.height * scale, Jimp.RESIZE_NEAREST_NEIGHBOR);
                            }
                
                            // Rotate pattern image
                            if (patternImageData.seedrotate) {
                                let degrees = Math.floor(individualPatternSeedRNG.rotation * 360);
                                const imageSizeTarget = Math.sqrt(Math.pow((JimpImg.bitmap.width / 2), 2) + Math.pow((JimpImg.bitmap.height / 2), 2));
                                JimpImg.rotate(degrees, false)
                                JimpImg.crop((JimpImg.bitmap.width - imageSizeTarget) / 2, (JimpImg.bitmap.height - imageSizeTarget) / 2, imageSizeTarget, imageSizeTarget);
                            }
    
                            // Create cropped pattern image to the size of the pattern mask, at a random(seeded) position
                            const cropXPos = Math.floor(individualPatternSeedRNG.cropX * (JimpImg.bitmap.width - baseImage.bitmap.width));
                            const cropYPos = Math.floor(individualPatternSeedRNG.cropY * (JimpImg.bitmap.height - baseImage.bitmap.height));
                            JimpImg.crop(cropXPos, cropYPos, baseImage.bitmap.height, baseImage.bitmap.width);
            
                            // Apply color manimpulatons, if they exist.
                            if (imageManipulations.length > 0) JimpImg.color(imageManipulations);
                        }
                    }
                }

    
                patternImages.push(patternImageLayers);
            }
            const newBaseImage = baseImage.clone();
            for (let maskImageIndex = 0; maskImageIndex < patternInfo.masks.length; maskImageIndex++) {
                const maskInfo = patternInfo.masks[maskImageIndex];
                // Read random(seeded) mask image
                let maskImage = await Jimp.read(`${imageDirectory}/${maskInfo.images[Math.floor(maskInfo.images.length * overallPatternSeedRNG.maskImage[maskImageIndex % overallPatternSeedRNG.maskImage.length])]}.png`);
                
                for (let patternImageLayerIndex = 0; patternImageLayerIndex < Object.keys(patternImages[maskInfo.patternimage]).length; patternImageLayerIndex++) {
                    const key: keyof typeof patternImages[number] = Object.keys(patternImages[maskInfo.patternimage])[patternImageLayerIndex] as keyof typeof patternImages[number];
                    // Mask the pattern image with the mask image and composite the modified masked image
                    if (patternImages[maskInfo.patternimage][key] !== undefined) {
                        // @ts-ignore 'key' is a dynamic object property... it's OK!!!
                        const maskedImage = patternImages[maskInfo.patternimage][key].clone().mask(maskImage, 0, 0);
                        if (key === "base") {
                            newBaseImage.composite(maskedImage, 0, 0);
                        } else {
                            const atlasCoordinates = getPatternAtlasCoordinates(iconWidth, iconHeight, patternIndex, key);
                            newPatternAtlas.composite(maskedImage, atlasCoordinates.x, atlasCoordinates.y);
                        }
                    }
                }
            }
            const atlasCoordinates = getPatternAtlasCoordinates(iconWidth, iconHeight, patternIndex, "base");
            // console.log(`Generated atlas image for pattern index ${patternIndex} and cube ID ${cubeID}.`)
            newBaseImage.composite(overlayImage, 0, 0);
            newPatternAtlas.composite(newBaseImage, atlasCoordinates.x, atlasCoordinates.y);
        }
        await newPatternAtlas.writeAsync(patternAtlasFilePath);
        return newPatternAtlas;
    }
}

async function getSeededCubeIconType(cubeID: CCOIcons.patternedCubeID, seed: number, type: typeof xAtlasTypes[number]): Promise<Jimp> {
    // Load the base cube image from the seeded cube directory, for the width/height
    const baseImage = await Jimp.read(`./sourceicons/seededcubetextures/${cubeID}/base.png`)
    const atlas = await getSeededIconAtlas(cubeID);
    const iconPosition = getPatternAtlasCoordinates((baseImage.bitmap.width + (patternAtlasPadding * 2)), (baseImage.bitmap.height + (patternAtlasPadding * 2)), seed, type);
    return atlas.crop(iconPosition.x, iconPosition.y, baseImage.bitmap.width, baseImage.bitmap.height);
}

const iconModifiers = {
    baseIcon: {
        directory: '/ccicons',
        modificationFunction: async function (modifyingPath, modifyingID, fileName, data: { seed: number }) {
            // Get the path of the output of the previous modification 
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${fileName}`);
            // Create the directory path of the outcome of this modification
            const outcomePath = path.resolve(`${relativeRootDirectory}/ccicons`);
            // If the path to the directory doesn't exist, create it.
            if (!fs.pathExistsSync(outcomePath)) fs.mkdirSync(outcomePath, { recursive: true });

            let fileNameOverride: `${string}.png` = `${modifyingID}.png`;

            // If the cube is seeded,
            if (patternedCubeIDs.find(patternedCubeID => patternedCubeID === modifyingID) !== undefined) {
                const cubeSeed = data.seed;
                // Create the outcome path of the file
                fileNameOverride = `${modifyingID}${cubeSeed}.png`;
                const outcomeFile = `${outcomePath}/${fileNameOverride}`;
                // getSeededIconAtlas(modifyingID as CCOIcons.patternedCubeID);
                if (!fs.existsSync(outcomeFile)) {
                    let iconFile = await getSeededCubeIconType(modifyingID as CCOIcons.patternedCubeID, cubeSeed, "base");
                    await saveAnimatedCubeIcon([iconFile], fileNameOverride, `${outcomePath}/`);
                }
            } else {
                // Create the outcome path of the file
                const outcomeFile = `${outcomePath}/${modifyingID}.png`;
                // If the icon hasn't been generated yet, then generate it (in this case, it's copying it to the generated icons directory to make sure the original image isn't accidentally modified)
                if (!fs.existsSync(outcomeFile)) {
                    let iconFrames = await loadAnimatedCubeIcon(originalImagePath);
                    let savedIcon = await saveAnimatedCubeIcon(iconFrames, fileNameOverride, `${outcomePath}/`);
                    if (savedIcon !== true) {
                        console.log('Failed to save icon!');
                    }
                }
            }
            // Return the directory to add to the icon generation function.
            return {
                directoryAddition: `/ccicons/`,
                newFileName: fileNameOverride
            };
        }
    },
    contraband: {
        directory: '/contraband',
        modificationFunction: async function(modifyingPath, modifyingID, fileName, data: { seed: number }) {
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${fileName}`);
            // Create the directory path of the outcome of this modification
            const outcomePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}/contraband`);
            // Create the outcome path of the file
            const outcomeFile = `${outcomePath}/${fileName}`;
            // If the path to the directory doesn't exist, create it.
            if (!fs.pathExistsSync(outcomePath)) fs.mkdirSync(outcomePath, { recursive: true });
            // If the icon hasn't been generated yet, then generate it (in this case, it's masking the accent image with a 'contraband' image, then compositing the original image with the masked accent image.)
            if (!fs.existsSync(outcomeFile)) {
                let iconFrames: Jimp[] = [];
                let frameMasks: Jimp[] = [];
                if (patternedCubeIDs.find(patternedCubeID => patternedCubeID === modifyingID) !== undefined) {
                    frameMasks = [await getSeededCubeIconType(modifyingID as CCOIcons.patternedCubeID, data.seed, "accents")];
                } else {
                    const customMaskImagePath = `${sourceImagesDirectory}${modifyingID}/accents.png`;
                    frameMasks = await loadAnimatedCubeIcon((!fs.existsSync(customMaskImagePath)) ? `${sourceImagesDirectory}_DEFAULT_/accents.png` : customMaskImagePath);
                }
                iconFrames = await loadAnimatedCubeIcon(`${originalImagePath}`);
                const contrabandEffectImage = await Jimp.read(`./sourceicons/attributeeffects/contraband.png`);
                var patternRNG = new seedrandom(`${modifyingID}`);
                const cropX = Math.ceil(patternRNG() * (contrabandEffectImage.bitmap.width - iconFrames[0].bitmap.width));
                const cropY = Math.ceil(patternRNG() * (contrabandEffectImage.bitmap.height - iconFrames[0].bitmap.height));
                contrabandEffectImage.crop(cropX, cropY, iconFrames[0].bitmap.width, iconFrames[0].bitmap.height);
                for (let frameIndex = 0; frameIndex < iconFrames.length; frameIndex++) {
                    let contrabandEffectClone = contrabandEffectImage.clone();
                    contrabandEffectClone.mask(frameMasks[frameIndex % frameMasks.length], 0, 0);
                    strokeImage(contrabandEffectClone, 0x000000ff)
                    iconFrames[frameIndex].composite(contrabandEffectClone, 0, 0);
                }
                await saveAnimatedCubeIcon(iconFrames, fileName, `${outcomePath}/`);
            }
            return {
                directoryAddition: `/contraband/`
            };
        }
    },
    bSide: {
        directory: '/bside',
        modificationFunction: async function (modifyingPath, modifyingID, fileName, data: any) {
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${fileName}`);
            const newImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}/bside`);
            if (!fs.existsSync(newImagePath)) fs.mkdirSync(newImagePath, { recursive: true });
            const newIconPath = path.resolve(`${newImagePath}/${fileName}`);
            if (!fs.existsSync(newIconPath)) {
                    let iconFrames = await loadAnimatedCubeIcon(originalImagePath);
                    for (let frameIndex = 0; frameIndex < iconFrames.length; frameIndex++) {
                        iconFrames[frameIndex] = await createBSideImage(iconFrames[frameIndex]);
                    }
                    await saveAnimatedCubeIcon(iconFrames, fileName, `${newImagePath}/`);
            }
            return {
                directoryAddition: `/bside/`
            };
        }
    },
    tallying: {
        directory: '/tallying',
        modificationFunction: async function (modifyingPath, modifyingID, fileName, data: {tallies: number}) {
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${fileName}`);

            return {
                directoryAddition: `/tallying`
            };
        }
    },
    divine: {
        directory: '/divine',
        modificationFunction: async function (modifyingPath, modifyingID, fileName, data: any) {
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${fileName}`);

            return {
                directoryAddition: `/divine`
            };
        }
    },
    slated: {
        directory: '/slated',
        modificationFunction: async function (modifyingPath, modifyingID, fileName, data: any) {
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${fileName}`);

            return {
                directoryAddition: `/slated`
            };
        }
    },
    prefixes: {
        directory: '/prefix',
        modificationFunction: async function (modifyingPath, modifyingID, fileName, data: { prefixes: string[], seed: number }) {
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${fileName}`);

            return {
                directoryAddition: `/prefix`
            };
        }
    },
    size: {
        directory: '/size',
        modificationFunction: async function (modifyingPath, modifyingID, fileName, data: { size: number }) {
            // Check if the size is a power of 2, within the bounds of set above. If not, don't resize and don't return a new nested directory
            if (Number.isNaN(data.size) || data.size > resizeMax || data.size < resizeMin || (Math.log(data.size) / Math.log(2)) % 1 !== 0) return {directoryAddition: ''};

            // Get the path of the output of the previous modification
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${fileName}`);

            // Sizes can be in many forms, so let's create a separate directory for each size.
            const resizeDirectory = `/sizex${data.size}/`;

            // Create the directory path of the outcome of this modification
            const outcomeDirectory = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${resizeDirectory}`);

            // Create the outcome path of the file
            const outcomeFile = `${outcomeDirectory}/${fileName}`;

            // If the path to the directory doesn't exist, create it.
            if (!fs.pathExistsSync(outcomeDirectory)) fs.mkdirSync(outcomeDirectory, { recursive: true });

            // If the icon hasn't been generated yet, then generate it (in this case, it's simply reading the original image then resizing it.)
            if (!fs.existsSync(outcomeFile)) {
                // Read the original icon
                let iconFrames = await loadAnimatedCubeIcon(originalImagePath)

                for (let frameIndex = 0; frameIndex < iconFrames.length; frameIndex++) {
                    // Resize the icon
                    iconFrames[frameIndex].resize(data.size, data.size, Jimp.RESIZE_NEAREST_NEIGHBOR)
                }
                
                // Write the icon
                await saveAnimatedCubeIcon(iconFrames, fileName, outcomeDirectory);
            }

            // Return the directory to add to the icon generation function.
            return {
                directoryAddition: resizeDirectory
            };
        }
    }
} satisfies {[key: string]: {
    directory: string,
    modificationFunction: (modifyingPath: string[], modifyingID: CCOIcons.cubeID, modifyingFileName: `${string}.png`, data: any) => Promise<{directoryAddition: string, newFileName?: string}>
}}

interface cubeIconGenerationParameters {
    contraband: {
        use: boolean,
        data: {
            seed: number
        }
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
    },
    tallying: {
        use: boolean,
        data: {
            tallies: number
        }
    }
}

async function generateCubeIcon(iconAttributes: Partial<cubeIconGenerationParameters>, cubeID: CCOIcons.cubeID, iconSeed: number, returnSpriteSheet: boolean): Promise<string> {
    let imageDirectories: string[] = [];
    let fileName: `${string}.png` = `${'cube'}.png`;
    const copyModification = await iconModifiers.baseIcon.modificationFunction([`/CCOIcons/sourceicons/cubes/${cubeID}/`], cubeID, fileName, { seed: iconSeed });
    fileName = copyModification.newFileName;
    imageDirectories.push(copyModification.directoryAddition);

    // These IF..ELSE statements are set up in this order to enforce the image application filter order... obviously we don't want 'b-side' to be applied after 'size' and stuff like that... it wouldn't look quite right

    if (iconAttributes.prefixes !== undefined && iconAttributes.prefixes.use === true) {
        imageDirectories.push((await iconModifiers.prefixes.modificationFunction(imageDirectories, cubeID, fileName, iconAttributes.prefixes.data)).directoryAddition);
    }
    
    if (iconAttributes.contraband !== undefined && iconAttributes.contraband.use === true) {
        imageDirectories.push((await iconModifiers.contraband.modificationFunction(imageDirectories, cubeID, fileName, iconAttributes.contraband.data)).directoryAddition);
    }
    
    if (iconAttributes.divine !== undefined && iconAttributes.divine.use === true) {
        imageDirectories.push((await iconModifiers.divine.modificationFunction(imageDirectories, cubeID, fileName, iconAttributes.divine.data)).directoryAddition);
    }
    
    if (iconAttributes.slated !== undefined && iconAttributes.slated.use === true) {
        imageDirectories.push((await iconModifiers.slated.modificationFunction(imageDirectories, cubeID, fileName, iconAttributes.slated.data)).directoryAddition);
    }

    if (iconAttributes.tallying !== undefined && iconAttributes.tallying.use === true) {
        imageDirectories.push((await iconModifiers.tallying.modificationFunction(imageDirectories, cubeID, fileName, iconAttributes.tallying.data)).directoryAddition);
    }

    if (iconAttributes.bSide !== undefined && iconAttributes.bSide.use === true) {
        imageDirectories.push((await iconModifiers.bSide.modificationFunction(imageDirectories, cubeID, fileName, iconAttributes.bSide.data)).directoryAddition);
    }

    if (iconAttributes.size !== undefined && iconAttributes.size.use === true) {
        imageDirectories.push((await iconModifiers.size.modificationFunction(imageDirectories, cubeID, fileName, iconAttributes.size.data)).directoryAddition);
    }

    if (!returnSpriteSheet && fs.existsSync(`${relativeRootDirectory}${imageDirectories.join('')}${fileName.replace('.png', '.gif')}`)) {
        // @ts-ignore An override for a .gif, should be OK.
        fileName = fileName.replace('.png', '.gif');
    }

    return path.resolve(`${relativeRootDirectory}${imageDirectories.join('')}${fileName}`);
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
                description: `The desired size of the requested icon in pixels. Must be a power of 2, with the minimum being ${resizeMin}, and the maximum being ${resizeMax}.`,
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
                query: 'b',
                name: "B-Side Icon",
                subtitle: "Whether or not you want the B-Side attribute modification to be applied.",
                description: "You don't have to include anything as part of this parameter, simply including 'b' as a query modifier in the URL is enough.",
                examples: [
                    {
                        name: "B-Side Brimstone Cube Icon",
                        example: "/cubeicon/brimstone?b",
                        description: "Will return the 'brimstone' icon with the B-Side attribute modifier applied."
                    },
                    {
                        name: "B-Side Perfect Eclipse Cube Icon",
                        example: "/cubeicon/eclipse?b&pattern=45",
                        description: "Will return the 'eclipse' icon, with pattern ID 45, along with the B-Side attribute modifier applied."
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
                query: 'spritesheet',
                name: "Spritesheet",
                subtitle: "Whether or not you want the server to send you the spritesheet of an animated icon.",
                description: "You don't have to include anything as part of this parameter, simply including 'spritesheet' as a query modifier in the URL is enough. Providing this with an icon that isn't animated will do nothing.",
                examples: [
                    {
                        name: "Sublime Cube Spritesheet",
                        example: "/cubeicon/sublime?spritesheet",
                        description: "Will return the 'sublime' cubeID's spritesheet image."
                    },
                    {
                        name: "Contraband Sublime Cube Spritesheet",
                        example: "/cubeicon/sublime?c&spritesheet",
                        description: "Will return the 'sublime' cubeID's contraband variant spritesheet image."
                    }
                ]
            },
            {
                query: 'pattern',
                name: "Pattern Attribute",
                subtitle: "Request a specific pattern index from a cube.",
                description: `The pattern can be any number from 0 to ${patternIndexLimit - 1}. This only affects cubes with seeded patterns, or have a seeded prefix. Supplying a number greater than ${patternIndexLimit - 1} will simply have the modulus of ${patternIndexLimit - 1} taken from that number. Supplying a number less than 0 will have its absolute value taken. Supplying 'random' as the parameter will make the server take a random seed. NOTE: If no 'pattern' is supplied then the server will default to pattern ID 1.`,
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
        let startIconGeneration = performance.now();
        // Set requested cube ID variable
        let requestedCubeID: CCOIcons.cubeID;
        if (cubes[req.params.cubeid as CCOIcons.cubeID] !== undefined) {
            requestedCubeID = (req.params.cubeid as CCOIcons.cubeID) ?? 'green';
        } else {
            requestedCubeID = 'green';
        }
        console.log(requestedCubeID);
        // Cube icon generation parameters storer
        const cubeIconParams: Partial<cubeIconGenerationParameters> = {};
        let cubeIconSeed = 1;
        let returnSpriteSheet = false;
        if (Object.keys(req.query).length > 0) {
            if (typeof req.query.s === "string") { // Cube Icon Size query modifier
                cubeIconParams.size = {
                    use: true,
                    data: {
                        size: Number.parseInt(req.query.s)
                    }
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
                    if (possibleIconSeed > (patternIndexLimit - 1)) {
                        possibleIconSeed = possibleIconSeed % (patternIndexLimit - 1); // If the number is greater than the pattern limit, then just take the remainder of the number.
                    }
                    cubeIconSeed = possibleIconSeed;
                }
            }
            if (req.query.c !== undefined) {
                cubeIconParams.contraband = {
                    use: true,
                    data: {
                        seed: cubeIconSeed
                    }
                }
            }
            if (req.query.b !== undefined) {
                cubeIconParams.bSide = {
                    use: true,
                    data: {}
                }
            }
            if (req.query.spritesheet !== undefined) {
                returnSpriteSheet = true;
            }
        }
        let imagePath = '';
        try {
            // Create the image (if needed) and get its path
            imagePath = await generateCubeIcon(cubeIconParams, requestedCubeID, cubeIconSeed, returnSpriteSheet);
        } catch (e) {
            console.log(e);
            res.status(403);
            res.send('Failed to get this image. Internal error: '+e)
        }
        // Finally, send the file.
        console.log(imagePath);
        let endIconGeneration = performance.now();
        console.log(`Icon generation took ${endIconGeneration - startIconGeneration}ms.`)
        let imageStats = fs.statSync(imagePath);
        res.set('cubeiconattributes', JSON.stringify({
            size: imageStats.size,
            generationTime: endIconGeneration - startIconGeneration
        }))
        res.sendFile(imagePath);
        return;
    }
}

export {
    route as cubeIconRoute
}