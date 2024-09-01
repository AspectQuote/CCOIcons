import * as CCOIcons from './../typedefs';
import * as fs from 'fs-extra';
import * as path from 'path';
import Jimp from 'jimp';
import * as gifwrap from 'gifwrap';
import { Response } from 'express';

import { createBSideImage } from './../modules/bside';
import { fillRect, loadAnimatedCubeIcon, saveAnimatedCubeIcon, strokeImage } from './../modules/imageutils';
import { prefixes, getNeededPaddingFromCompiledFrames, prefixIDApplicationOrder, sortPrefixesByApplicationOrder } from '../modules/schematics/prefixes';
import * as config from '../modules/schematics/config';
import * as maths from '../modules/maths';
let seedrandom = require('seedrandom');

const cubes: { [key in CCOIcons.cubeID]: CCOIcons.cubeDefinition } = fs.readJSONSync('./config/cubes.json');
const rarityConfig: { [key in CCOIcons.rarityID]: CCOIcons.rarityDefinition } = fs.readJSONSync('./config/rarityconfig.json');
const patternSchema: { [key in CCOIcons.patternedCubeID]: CCOIcons.patternedCubeDefinition } = fs.readJSONSync('./config/patterneditems.json');
const patternedCubeIDs: CCOIcons.patternedCubeID[] = Object.keys(patternSchema) as CCOIcons.patternedCubeID[];
const validPrefixIDs: CCOIcons.prefixID[] = Object.keys(prefixes) as CCOIcons.prefixID[];


// Create storage directories if they don't exist yet
if (!fs.existsSync(`${config.relativeRootDirectory}/ccicons/`)) fs.mkdirSync(`${config.relativeRootDirectory}/ccicons/`);
if (!fs.existsSync(`${config.relativeRootDirectory}/ccicons/attributespritesheets`)) fs.mkdirSync(`${config.relativeRootDirectory}/ccicons/attributespritesheets`);

// Generate the divine animation
if (config.divineConfig.alwaysRegenerate || !fs.existsSync(`${config.relativeRootDirectory}/ccicons/attributespritesheets/${config.divineConfig.iconName}.png`)) {
    (async () => {
        let divineFlashMask = await Jimp.read(`${config.sourceImagesDirectory}/cubes/../attributeeffects/divine/flash.png`);
        let divinePatternMask = await Jimp.read(`${config.sourceImagesDirectory}/cubes/../attributeeffects/divine/pattern.png`);
        const baseDivineResolution = divineFlashMask.bitmap.width;
        let divineBaseImage = new Jimp(baseDivineResolution, baseDivineResolution, config.divineConfig.color).mask(divineFlashMask, 0, 0);
        divineBaseImage._background = 0x00000000;
        let generatedDivineFrames: Jimp[] = [];

        let rotationIncrement = 90 / config.divineConfig.frames;
        for (let frameIndex = 0; frameIndex < config.divineConfig.frames; frameIndex++) {
            let newDivineFrame = divineBaseImage.clone().rotate((rotationIncrement * frameIndex) + 1, false);
            newDivineFrame.composite(divineBaseImage.clone().rotate(-(rotationIncrement * frameIndex), false), 0, 0);
            generatedDivineFrames.push(newDivineFrame.mask(divinePatternMask, 0, 0));
        }

        saveAnimatedCubeIcon(generatedDivineFrames, config.divineConfig.iconName, `${config.relativeRootDirectory}/ccicons/attributespritesheets`, config.divineConfig.delayCentisecs);
    })()
}

// Generate the slated animation
if (config.slatedConfig.alwaysRegenerate || !fs.existsSync(`${config.relativeRootDirectory}/ccicons/attributespritesheets/${config.slatedConfig.iconName}.png`)) {
    (async () => {
        let slatedBaseShape = await Jimp.read(`${config.sourceImagesDirectory}/cubes/../attributeeffects/slated/round.png`);
        let slatedBaseSquareSize = slatedBaseShape.bitmap.width;
        let slatedPadding = 15;
        let generatedSlatedFrames: Jimp[] = [];
        let slatedRNG = new seedrandom(`slatedseedaaalmaoidk`);
        let slatedPatternMask = await Jimp.read(`${config.sourceImagesDirectory}/cubes/../attributeeffects/slated/pattern.png`);

        function areaCoveredByRectangles(rectArray: typeof topRectangles) {
            return rectArray.reduce((prev, curr) => {
                return prev + curr.offset + curr.width;
            }, 0)
        }

        function populateSlatedRectangleArray(): { width: number, size: number, maxSize: number, minSize: number, offset: number, direction: boolean }[] {
            let rectangleArray: typeof topRectangles = [];
            while (areaCoveredByRectangles(rectangleArray) < slatedBaseSquareSize - 2) {
                let size = Math.ceil(slatedRNG() * (slatedPadding / 2));

                let maxSize = size + Math.round(config.slatedConfig.frames / 2) - 1;
                let minSize = size - Math.round(config.slatedConfig.frames / 2) + 1;

                rectangleArray.push({
                    width: Math.ceil(slatedRNG() * 2),
                    size,
                    maxSize,
                    minSize,
                    offset: Math.ceil(slatedRNG() * 2),
                    direction: (slatedRNG() > 0.5) ? true : false
                })
            }
            return rectangleArray;
        }

        let topRectangles = populateSlatedRectangleArray();
        let topUniversalRectangleOffset = Math.floor((slatedBaseSquareSize + 2 - areaCoveredByRectangles(topRectangles)) / 2);

        let leftRectangles = populateSlatedRectangleArray();
        let leftUniversalRectangleOffset = Math.floor((slatedBaseSquareSize + 2 - areaCoveredByRectangles(leftRectangles)) / 2);

        let bottomRectangles = populateSlatedRectangleArray();
        let bottomUniversalRectangleOffset = Math.floor((slatedBaseSquareSize + 2 - areaCoveredByRectangles(bottomRectangles)) / 2);

        let rightRectangles = populateSlatedRectangleArray();
        let rightUniversalRectangleOffset = Math.floor((slatedBaseSquareSize + 2 - areaCoveredByRectangles(rightRectangles)) / 2);

        for (let slatedFrameIndex = 0; slatedFrameIndex < config.slatedConfig.frames; slatedFrameIndex++) {
            let newSlatedFrame = new Jimp(slatedBaseSquareSize + slatedPadding * 2, slatedBaseSquareSize + slatedPadding * 2, 0x00000000);

            fillRect(newSlatedFrame, slatedPadding, slatedPadding, slatedBaseSquareSize, slatedBaseSquareSize, config.slatedConfig.color);
            newSlatedFrame.mask(slatedBaseShape, slatedPadding, slatedPadding)

            let topXPos = slatedPadding;
            topRectangles.forEach(rectangle => {
                fillRect(newSlatedFrame, topXPos + topUniversalRectangleOffset, slatedPadding - rectangle.size, rectangle.width, rectangle.size + (slatedBaseSquareSize/2), config.slatedConfig.color);
                topXPos += rectangle.width + rectangle.offset;
                rectangle.size += rectangle.direction ? 1 : -1;
                if (rectangle.size == rectangle.maxSize || rectangle.size == rectangle.minSize) rectangle.direction = !rectangle.direction;
            })

            let bottomXPos = slatedPadding;
            bottomRectangles.forEach(rectangle => {
                fillRect(newSlatedFrame, bottomXPos + bottomUniversalRectangleOffset, slatedPadding + slatedBaseSquareSize - (slatedBaseSquareSize / 2), rectangle.width, rectangle.size + (slatedBaseSquareSize / 2), config.slatedConfig.color);
                bottomXPos += rectangle.width + rectangle.offset;
                rectangle.size += rectangle.direction ? 1 : -1;
                if (rectangle.size == rectangle.maxSize || rectangle.size == rectangle.minSize) rectangle.direction = !rectangle.direction;
            })

            let leftYPos = slatedPadding;
            leftRectangles.forEach(rectangle => {
                fillRect(newSlatedFrame, slatedPadding - rectangle.size, leftYPos + leftUniversalRectangleOffset, rectangle.size + (slatedBaseSquareSize / 2), rectangle.width, config.slatedConfig.color);
                leftYPos += rectangle.width + rectangle.offset;
                rectangle.size += rectangle.direction ? 1 : -1;
                if (rectangle.size == rectangle.maxSize || rectangle.size == rectangle.minSize) rectangle.direction = !rectangle.direction;
            })

            let rightYPos = slatedPadding;
            rightRectangles.forEach(rectangle => {
                fillRect(newSlatedFrame, slatedPadding + slatedBaseSquareSize - (slatedBaseSquareSize / 2), rightYPos + rightUniversalRectangleOffset, rectangle.size + (slatedBaseSquareSize / 2), rectangle.width, config.slatedConfig.color);
                rightYPos += rectangle.width + rectangle.offset;
                rectangle.size += rectangle.direction ? 1 : -1;
                if (rectangle.size == rectangle.maxSize || rectangle.size == rectangle.minSize) rectangle.direction = !rectangle.direction;
            })

            generatedSlatedFrames.push(newSlatedFrame.mask(slatedPatternMask, 0, 0));
        }
        saveAnimatedCubeIcon(generatedSlatedFrames, config.slatedConfig.iconName, `${config.relativeRootDirectory}/ccicons/attributespritesheets`, config.slatedConfig.delayCentisecs);
    })()
}

function clampRandomHiLo(low: number, high: number, seed: number) {
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

const seededIconKeys: ("base" | CCOIcons.cubeAnchorPoints)[] = ["base", "accents", "eyes", "heads", "mouths"] as const;

async function ensurePatternedIconsAreGenerated(cubeID: CCOIcons.patternedCubeID, patternIndex: number): Promise<string> {
    const patternInfo: undefined | CCOIcons.patternedCubeDefinition = patternSchema[cubeID];
    const patternAtlasDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/patternatlases/${cubeID}/${patternIndex}`);
    if (!fs.existsSync(`${patternAtlasDirectory}/cube.png`)) {
        console.log("Regenerating Pattern: "+patternIndex)
        fs.mkdirSync(patternAtlasDirectory, { recursive: true });
        // Image Directory
        const imageDirectory = `./sourceicons/seededcubetextures/${cubeID}`;
        // Load the base cube image from the seeded cube directory.
        const baseImage = await Jimp.read(`${imageDirectory}/base.png`)
        // Read overlay image and put that over the composite later
        const overlayImage = await Jimp.read(`${imageDirectory}/finaloverlay.png`);

        let staticPatternImageLayers: { [key in typeof seededIconKeys[number]]: Jimp | undefined } = {
            base: undefined,
            accents: undefined,
            eyes: undefined,
            mouths: undefined,
            heads: undefined
        }

        for (let staticPatternKeyIndex = 0; staticPatternKeyIndex < Object.keys(staticPatternImageLayers).length; staticPatternKeyIndex++) {
            const staticPatternKey: keyof typeof staticPatternImageLayers = Object.keys(staticPatternImageLayers)[staticPatternKeyIndex] as keyof typeof staticPatternImageLayers;
            if (staticPatternKey !== "base") {
                if (fs.existsSync(`${imageDirectory}/${staticPatternKey}.png`)) {
                    staticPatternImageLayers[staticPatternKey] = await Jimp.read(`${imageDirectory}/${staticPatternKey}.png`);
                }
            }
        }
        let patternImages: { [key in typeof seededIconKeys[number]]?: undefined | Jimp }[] = []
        const overallPatternSeedRNG = getSeededIconRNGValues(cubeID, patternIndex, 0);
        for (let patternImageIndex = 0; patternImageIndex < patternInfo.patternimages.length; patternImageIndex++) {
            const individualPatternSeedRNG = getSeededIconRNGValues(cubeID, patternIndex, patternImageIndex);
            const patternImageData = patternInfo.patternimages[patternImageIndex];

            let patternImageLayers: typeof staticPatternImageLayers = {
                base: undefined,
                accents: ((staticPatternImageLayers.accents === undefined) ? undefined : staticPatternImageLayers.accents.clone()),
                eyes: ((staticPatternImageLayers.eyes === undefined) ? undefined : staticPatternImageLayers.eyes.clone()),
                mouths: ((staticPatternImageLayers.mouths === undefined) ? undefined : staticPatternImageLayers.mouths.clone()),
                heads: ((staticPatternImageLayers.heads === undefined) ? undefined : staticPatternImageLayers.heads.clone())
            };
            for (let patternImageLayerIndex = 0; patternImageLayerIndex < Object.keys(patternImageLayers).length; patternImageLayerIndex++) {
                const key: keyof typeof patternImageLayers = Object.keys(patternImageLayers)[patternImageLayerIndex] as keyof typeof patternImageLayers;
                const imageFilePath = path.resolve(`./sourceicons/textures/${patternImageData.path}/${key}.png`);
                if (patternImageLayers[key] === undefined && fs.existsSync(imageFilePath)) {
                    patternImageLayers[key] = await Jimp.read(imageFilePath);
                    if (patternImageLayers[key] !== undefined) {
                        // I love typedefs!!!
                        let imageManipulations: CCOIcons.JimpImgMod[] = [];
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
                    const maskedImage = patternImages[maskInfo.patternimage][key].clone()
                    if (staticPatternImageLayers[key] === undefined) {
                        maskedImage.mask(maskImage, 0, 0);
                    }
                    if (key === "base") {
                        newBaseImage.composite(maskedImage, 0, 0);
                    } else {
                        await maskedImage.writeAsync(`${patternAtlasDirectory}/${key}.png`)
                    }
                }
            }
        }
        // console.log(`Generated atlas image for pattern index ${patternIndex} and cube ID ${cubeID}.`)
        newBaseImage.composite(overlayImage, 0, 0);
        await newBaseImage.writeAsync(`${patternAtlasDirectory}/cube.png`);
    }
    return patternAtlasDirectory;
}

async function getSeededCubeIconType(cubeID: CCOIcons.patternedCubeID, seed: number, type: typeof seededIconKeys[number]): Promise<Jimp> {
    const iconDirectory = await ensurePatternedIconsAreGenerated(cubeID, seed);
    return await Jimp.read(`${iconDirectory}/${((type === "base") ? "cube" : type)}.png`);
}

async function getCubeIconPart(cubeID: CCOIcons.cubeID, seed: number, type: typeof seededIconKeys[number]): Promise<Jimp[]> {
    if (patternedCubeIDs.find(patternedCubeID => patternedCubeID === cubeID) !== undefined) {
        return [await getSeededCubeIconType(cubeID as CCOIcons.patternedCubeID, seed, type)];
    } else {
        const customMaskImagePath = `${config.sourceImagesDirectory}/cubes/${cubeID}/${type}.png`;
        return await loadAnimatedCubeIcon((!fs.existsSync(customMaskImagePath)) ? `${config.sourceImagesDirectory}_DEFAULT_/${type}.png` : customMaskImagePath);
    }
}

function generateAndValidatePrefixDirectory(suppliedPrefixes: CCOIcons.prefixID[], prefixSeed: number): {shownPrefixes: CCOIcons.prefixID[], newDirectoryName: string} {
    let shownPrefixes = [...suppliedPrefixes].sort(sortPrefixesByApplicationOrder);
    if (shownPrefixes.filter(prefixID => prefixes[prefixID].countsTowardsPrefixCap === true).length > config.shownPrefixLimit) {
        let exemptedPrefixes = shownPrefixes.filter(prefixID => prefixes[prefixID].countsTowardsPrefixCap === false);
        let cutPrefixes = shownPrefixes.filter(prefixID => prefixes[prefixID].countsTowardsPrefixCap === true);
        shownPrefixes = [...exemptedPrefixes, ...cutPrefixes.slice(0, config.shownPrefixLimit)];
    }
    const usingSeed = shownPrefixes.findIndex(prefix => prefixes[prefix].seeded === true) != -1;

    let newDirectoryName = `prefix${usingSeed ? prefixSeed : ''}${shownPrefixes.join('').toLowerCase()}/`;

    return {shownPrefixes, newDirectoryName};
}

const iconModifiers = {
    baseIcon: {
        directory: '/ccicons',
        modificationFunction: async function (modifyingPath, modifyingID, fileName, data: { seed: number }) {
            // Get the path of the output of the previous modification 
            const originalImagePath = path.resolve(`${config.relativeRootDirectory}${modifyingPath.join('')}${fileName}`);
            // Create the directory path of the outcome of this modification
            const outcomePath = path.resolve(`${config.relativeRootDirectory}/ccicons`);
            // If the path to the directory doesn't exist, create it.
            if (!fs.pathExistsSync(outcomePath)) fs.mkdirSync(outcomePath, { recursive: true });

            let fileNameOverride: `${string}.png` = `${modifyingID}.png`;

            if (modifyingID === "badass") {
                // Create the outcome path of the file
                const outcomeFile = `${outcomePath}/${modifyingID}.png`;
                if (!fs.existsSync(outcomeFile)) {
                    let badassFrameCount = 100;
                    let badassRNG = new seedrandom(`badass`);
                    let usedIDs: CCOIcons.cubeID[] = [];
                    let allBadassFrames: Jimp[] = [];
                    while (usedIDs.length < badassFrameCount) {
                        let newID: CCOIcons.cubeID = Object.keys(cubes)[Math.round(badassRNG() * Object.keys(cubes).length)] as CCOIcons.cubeID;
                        if (!usedIDs.includes(newID) && !patternedCubeIDs.includes(newID as CCOIcons.patternedCubeID)) {
                            usedIDs.push(newID)
                        }
                    }
                    for (let badassFrameIndex = 0; badassFrameIndex < usedIDs.length; badassFrameIndex++) {
                        const newCubeID = usedIDs[badassFrameIndex];
                        const cubeDirectory = `${config.relativeRootDirectory}/CCOIcons/sourceicons/cubes/${newCubeID}`;
                        if (fs.existsSync(cubeDirectory)) {
                            let newCubeFrame = await loadAnimatedCubeIcon(`${cubeDirectory}/cube.png`);
                            allBadassFrames.push(newCubeFrame[Math.ceil(newCubeFrame.length * badassRNG()) - 1].resize(32, 32, Jimp.RESIZE_NEAREST_NEIGHBOR));
                        }
                    }
                    await saveAnimatedCubeIcon(allBadassFrames, `badass`, outcomePath, config.getCubeAnimationDelay(modifyingID));
                }
            } else if (patternedCubeIDs.find(patternedCubeID => patternedCubeID === modifyingID) !== undefined) {
                const cubeSeed = data.seed;
                // Create the outcome path of the file
                fileNameOverride = `${modifyingID}${cubeSeed}.png`;
                const outcomeFile = `${outcomePath}/${fileNameOverride}`;
                // getSeededIconAtlas(modifyingID as CCOIcons.patternedCubeID);
                if (!fs.existsSync(outcomeFile)) {
                    let iconFile = await getSeededCubeIconType(modifyingID as CCOIcons.patternedCubeID, cubeSeed, "base");
                    await saveAnimatedCubeIcon([iconFile], fileNameOverride, `${outcomePath}/`, config.getCubeAnimationDelay(modifyingID));
                }
            } else {
                // Create the outcome path of the file
                const outcomeFile = `${outcomePath}/${modifyingID}.png`;
                // If the icon hasn't been generated yet, then generate it (in this case, it's copying it to the generated icons directory to make sure the original image isn't accidentally modified)
                if (!fs.existsSync(outcomeFile) || !config.useBaseCubeCache) {
                    let iconFrames = await loadAnimatedCubeIcon(originalImagePath);
                    let savedIcon = await saveAnimatedCubeIcon(iconFrames, fileNameOverride, `${outcomePath}/`, config.getCubeAnimationDelay(modifyingID));
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
    bSide: {
        directory: '/bside',
        modificationFunction: async function (modifyingPath, modifyingID, fileName, data: any) {
            const originalImagePath = path.resolve(`${config.relativeRootDirectory}${modifyingPath.join('')}${fileName}`);
            const newImagePath = path.resolve(`${config.relativeRootDirectory}${modifyingPath.join('')}/bside`);
            if (!fs.existsSync(newImagePath)) fs.mkdirSync(newImagePath, { recursive: true });
            const newIconPath = path.resolve(`${newImagePath}/${fileName}`);
            if (!fs.existsSync(newIconPath) || !config.useBSideCache) {
                let iconFrames = await loadAnimatedCubeIcon(originalImagePath);
                for (let frameIndex = 0; frameIndex < iconFrames.length; frameIndex++) {
                    iconFrames[frameIndex] = await createBSideImage(iconFrames[frameIndex]);
                }
                await saveAnimatedCubeIcon(iconFrames, fileName, `${newImagePath}/`, config.getCubeAnimationDelay(modifyingID));
            }
            return {
                directoryAddition: `/bside/`
            };
        }
    },
    tallying: {
        directory: '/tallying',
        modificationFunction: async function (modifyingPath, modifyingID, fileName, data: { tallies: number }) {
            const originalImagePath = path.resolve(`${config.relativeRootDirectory}${modifyingPath.join('')}${fileName}`);
            // Create the directory path of the outcome of this modification
            const tallyNumber = Math.floor(Math.min(Math.abs(data.tallies), config.maxTallyPercent)).toString();
            const outcomeFolder = `/tallying${tallyNumber}`
            const outcomePath = path.resolve(`${config.relativeRootDirectory}${modifyingPath.join('')}${outcomeFolder}`);
            // Create the outcome path of the file
            const outcomeFile = `${outcomePath}/${fileName}`;
            // If the path to the directory doesn't exist, create it.
            if (!fs.pathExistsSync(outcomePath)) fs.mkdirSync(outcomePath, { recursive: true });
            // If the icon hasn't been generated yet, then generate it (in this case, it's just adding the tally flavor to the bottom right of the cube.)
            if (!fs.existsSync(outcomeFile) || !config.useTallyingImageCache) {
                let tallyNumberFrames = await loadAnimatedCubeIcon(`./sourceicons/attributeeffects/tallying/tallynumbers.png`);
                const tallyNumberWidth = tallyNumberFrames[0].bitmap.width;
                const tallyNumberPadding = 1;
                let tallyNumberImage = new Jimp(((tallyNumber.length + 1) * (tallyNumberWidth + tallyNumberPadding)) - tallyNumberPadding, tallyNumberWidth, 0x00000000);

                tallyNumber.split('').concat(['10']).forEach((numString, index) => {
                    let number = parseInt(numString);
                    tallyNumberImage.composite(tallyNumberFrames[number], ((tallyNumberWidth + tallyNumberPadding) * index), 0);
                })

                tallyNumberImage = strokeImage(strokeImage(tallyNumberImage, 0x000000ff, 1, false, [[1, 1, 1], [1, 0, 1], [1, 1, 1]]), 0x616161ff, 1, false, [[0, 0, 0], [0, 0, 0], [0, 0, 1]]);


                let iconFrames: Jimp[] = [];
                iconFrames = await loadAnimatedCubeIcon(`${originalImagePath}`);

                let tallyNumberX = iconFrames[0].bitmap.width - tallyNumberImage.bitmap.width - 1;
                let tallyNumberY = iconFrames[0].bitmap.height - tallyNumberImage.bitmap.height - 1;

                for (let frameIndex = 0; frameIndex < iconFrames.length; frameIndex++) {
                    if (tallyNumberImage.bitmap.width > iconFrames[frameIndex].bitmap.width) {
                        const newFrameSize = tallyNumberImage.bitmap.width;
                        let newFrame = new Jimp(newFrameSize, newFrameSize, 0x00000000);
                        const newIconPosition = Math.round((newFrameSize / 2) - (iconFrames[frameIndex].bitmap.width / 2));
                        newFrame.composite(iconFrames[frameIndex], newIconPosition, newIconPosition);
                        newFrame.composite(tallyNumberImage, 0, newFrame.bitmap.height-tallyNumberImage.bitmap.height-1);
                        iconFrames[frameIndex] = newFrame;
                    } else {
                        iconFrames[frameIndex].composite(tallyNumberImage, tallyNumberX, tallyNumberY);
                    }
                }
                await saveAnimatedCubeIcon(iconFrames, fileName, `${outcomePath}/`, config.getCubeAnimationDelay(modifyingID));
            }
            return {
                directoryAddition: `${outcomeFolder}/`
            }
        }
    },
    prefixes: {
        directory: '/prefix',
        modificationFunction: async function (modifyingPath, modifyingID, fileName, data: { prefixes: CCOIcons.prefixID[], prefixSeed: number, cubeSeed: number }) {
            const baseDirectory = path.resolve(`${config.relativeRootDirectory}${modifyingPath.join('')}`);
            const originalImagePath = path.resolve(`${baseDirectory}/${fileName}`);

            const validatedPrefixData = generateAndValidatePrefixDirectory(data.prefixes, data.prefixSeed);

            let targetOutputDirectory = path.resolve(`${baseDirectory}/${validatedPrefixData.newDirectoryName}`);

            if (!fs.existsSync(targetOutputDirectory)) fs.mkdirSync(targetOutputDirectory);

            let targetOutputFile = path.resolve(`${targetOutputDirectory}/${fileName}`);

            if (!fs.existsSync(targetOutputFile) || !config.usePrefixImageCache) {
                const neededParts: { [key in CCOIcons.cubeAnchorPoints]: boolean } = {
                    accents: validatedPrefixData.shownPrefixes.findIndex(prefix => prefixes[prefix].needs.accents === true) != -1,
                    eyes: validatedPrefixData.shownPrefixes.findIndex(prefix => prefixes[prefix].needs.eyes === true) != -1,
                    heads: validatedPrefixData.shownPrefixes.findIndex(prefix => prefixes[prefix].needs.heads === true) != -1,
                    mouths: validatedPrefixData.shownPrefixes.findIndex(prefix => prefixes[prefix].needs.mouths === true) != -1
                }
                const retrievedParts: CCOIcons.anchorPointSchema = {
                    accents: [],
                    eyes: [],
                    heads: [],
                    mouths: []
                }

                if (neededParts.accents) {
                    let accentFrames = await getCubeIconPart(modifyingID, data.cubeSeed, "accents");
                    for (let accentFrameIndex = 0; accentFrameIndex < accentFrames.length; accentFrameIndex++) {
                        const currentFrame = accentFrames[accentFrameIndex];
                        let accentCoordinates: CCOIcons.anchorPointSchema["accents"][number] = {
                            image: currentFrame
                        };
                        retrievedParts.accents.push(accentCoordinates);
                    }
                }

                if (neededParts.eyes) {
                    let eyeFrames = await getCubeIconPart(modifyingID, data.cubeSeed, "eyes");
                    for (let eyeFrameIndex = 0; eyeFrameIndex < eyeFrames.length; eyeFrameIndex++) {
                        const currentFrame = eyeFrames[eyeFrameIndex];
                        let eyeCoordinates: CCOIcons.anchorPointSchema["eyes"][number] = {
                            coordinates: []
                        };
                        currentFrame.scan(0, 0, currentFrame.bitmap.width, currentFrame.bitmap.height, function (x, y, idx) {
                            if (this.bitmap.data[idx + 3] > 0) {
                                eyeCoordinates.coordinates.push({ x, y });
                            }
                        });
                        retrievedParts.eyes.push(eyeCoordinates);
                    }
                }

                if (neededParts.mouths) {
                    let mouthFrames = await getCubeIconPart(modifyingID, data.cubeSeed, "mouths");
                    for (let mouthFrameIndex = 0; mouthFrameIndex < mouthFrames.length; mouthFrameIndex++) {
                        const currentFrame = mouthFrames[mouthFrameIndex];
                        let mouthsFound: CCOIcons.anchorPointSchema["mouths"][number] = {
                            positions: []
                        };
                        let onMouth = false;
                        let currentMouthSize = 0;
                        let currentMouthStartPosition: CCOIcons.coordinate = {x: 0, y: 0};
                        currentFrame.scan(0, 0, currentFrame.bitmap.width, currentFrame.bitmap.height, function (x, y, idx) {
                            if (this.bitmap.data[idx + 3] > 0 && y == currentMouthStartPosition.y) {
                                if (onMouth == true) {
                                    currentMouthSize++;
                                } else {
                                    onMouth = true;
                                    currentMouthStartPosition = {x, y};
                                    currentMouthSize = 1;
                                }
                            } else {
                                if (onMouth == true) {
                                    mouthsFound.positions.push(structuredClone({
                                        startPosition: currentMouthStartPosition,
                                        width: currentMouthSize
                                    }))
                                    onMouth = false;
                                }
                                currentMouthStartPosition.y = y;
                                if (this.bitmap.data[idx + 3] > 0) {
                                    onMouth = true;
                                    currentMouthStartPosition = { x, y };
                                    currentMouthSize = 1;
                                }
                            }
                        });
                        retrievedParts.mouths.push(mouthsFound);
                    }
                }

                if (neededParts.heads) {
                    let headFrames = await getCubeIconPart(modifyingID, data.cubeSeed, "heads");
                    for (let headFrameIndex = 0; headFrameIndex < headFrames.length; headFrameIndex++) {
                        const currentFrame = headFrames[headFrameIndex];
                        let headsFound: CCOIcons.anchorPointSchema["heads"][number] = {
                            positions: []
                        };
                        let onHead = false;
                        let currentHeadSize = 0;
                        let currentHeadStartPosition: CCOIcons.coordinate = { x: 0, y: 0 };
                        currentFrame.scan(0, 0, currentFrame.bitmap.width, currentFrame.bitmap.height, function (x, y, idx) {
                            if (this.bitmap.data[idx + 3] > 0 && y == currentHeadStartPosition.y) {
                                if (onHead == true) {
                                    currentHeadSize++;
                                } else {
                                    onHead = true;
                                    currentHeadStartPosition = { x, y };
                                    currentHeadSize = 1;
                                }
                            } else {
                                if (onHead == true) {
                                    headsFound.positions.push(structuredClone({
                                        startPosition: currentHeadStartPosition,
                                        width: currentHeadSize
                                    }))
                                    onHead = false;
                                }
                                currentHeadStartPosition.y = y;
                                if (this.bitmap.data[idx + 3] > 0) {
                                    onHead = true;
                                    currentHeadStartPosition = { x, y };
                                    currentHeadSize = 1;
                                }
                            }
                        });
                        retrievedParts.heads.push(headsFound);
                    }
                }

                let allPrefixFrames: CCOIcons.compiledPrefixFrames[] = [];
                let iconFrames = await loadAnimatedCubeIcon(originalImagePath);

                async function compilePrefixFrames(masks: boolean, sizeOverride?: {width: number, height: number}) {
                    for (let shownPrefixIndex = 0; shownPrefixIndex < validatedPrefixData.shownPrefixes.length; shownPrefixIndex++) {
                        const compilingPrefixID = validatedPrefixData.shownPrefixes[shownPrefixIndex];
                        if (prefixes[compilingPrefixID].appliesDirectlyAfterAllPrefixes === false) {
                            if (prefixes[compilingPrefixID].maskOnly === masks) {
                                if (sizeOverride) {
                                    allPrefixFrames.push(await prefixes[compilingPrefixID].compileFrames(retrievedParts, iconFrames.map(frame => frame.clone().resize(sizeOverride.width, sizeOverride.height, Jimp.RESIZE_NEAREST_NEIGHBOR)), data.prefixSeed, cubes[modifyingID]));
                                } else {
                                    allPrefixFrames.push(await prefixes[compilingPrefixID].compileFrames(retrievedParts, iconFrames.map(frame => frame.clone()), data.prefixSeed, cubes[modifyingID]));
                                }
                            }
                        }
                    }
                }

                await compilePrefixFrames(false);

                const paddingValues = getNeededPaddingFromCompiledFrames([...allPrefixFrames, {
                    frontFrames: iconFrames.map((frame): CCOIcons.compiledPrefixFrames["frontFrames"][number] => {
                        return [{
                            image: frame,
                            compositePosition: {
                                x: 0,
                                y: 0
                            }
                        }]
                    }),
                    backFrames: [],
                    frameModifiers: [],
                    outlineFrames: [],
                    maskFrames: [],
                    sourceID: "Sacred"
                }], iconFrames[0].bitmap.width, iconFrames[0].bitmap.height);
                
                await compilePrefixFrames(true, {
                    width: paddingValues.left + paddingValues.right + iconFrames[0].bitmap.width,
                    height: paddingValues.above + paddingValues.below + iconFrames[0].bitmap.height
                });

                const animationLengths = [
                    iconFrames.length,
                    ...allPrefixFrames.map(compiledFrames => (compiledFrames.frontFrames.length || 1)),
                    ...allPrefixFrames.map(compiledFrames => (compiledFrames.backFrames.length || 1)),
                    ...allPrefixFrames.map(compiledFrames => (compiledFrames.outlineFrames.length || 1)),
                    ...allPrefixFrames.map(compiledFrames => (compiledFrames.frameModifiers.length || 1)),
                    ...allPrefixFrames.map(compiledFrames => (compiledFrames.maskFrames.length || 1))
                ];
                if (animationLengths.find(animlength => animlength % 5 !== 0 && animlength !== 1)) {
                    console.log("An animation in this icon isn't a multiple of 5!", animationLengths);
                }
                const neededIconFrames = Math.min(config.maximumPrefixFramesPerIcon, maths.leastCommonMultipleOfArray(animationLengths));

                let newFrameBase = new Jimp(
                    paddingValues.left + iconFrames[0].bitmap.width + paddingValues.right, 
                    paddingValues.above + iconFrames[0].bitmap.height + paddingValues.below,
                    0x00000000
                );

                let newAnimation: Jimp[] = [];

                for (let newIconIndex = 0; newIconIndex < neededIconFrames; newIconIndex++) {
                    const oldIconIndex = newIconIndex % iconFrames.length;

                    let newFrame = newFrameBase.clone();

                    let frameOutlines: {
                        [key in ("front" | "back" | "icon")]: {
                            color: number,
                            width: number,
                            origin: CCOIcons.prefixID,
                            matrix: CCOIcons.strokeMatrix | undefined
                        }[]
                    } = {
                        front: [],
                        icon: [],
                        back: []
                    }

                    allPrefixFrames.forEach((compiledPrefixFrames) => {
                        if (compiledPrefixFrames.outlineFrames.length > 0) {
                            const outlineIndex = newIconIndex % compiledPrefixFrames.outlineFrames.length;
                            const outlineFrames = compiledPrefixFrames.outlineFrames[outlineIndex];
                            outlineFrames.forEach(outlinesOnFrame => {
                                outlinesOnFrame.layers.forEach(layerKey => {
                                    frameOutlines[layerKey].push({
                                        color: outlinesOnFrame.color,
                                        width: outlinesOnFrame.width,
                                        origin: compiledPrefixFrames.sourceID,
                                        matrix: outlinesOnFrame.matrix ?? undefined
                                    })
                                })
                            })
                        }
                    })

                    allPrefixFrames.forEach((compiledPrefixFrames) => {
                        if (compiledPrefixFrames.backFrames.length > 0) {
                            const backIndex = newIconIndex % compiledPrefixFrames.backFrames.length;
                            const backFrame = compiledPrefixFrames.backFrames[backIndex];
                            const outlinePadding = frameOutlines.back.reduce((prev, curr) => {return prev + ((curr.origin === compiledPrefixFrames.sourceID) ? 0 : curr.width)}, 0);
                            backFrame.forEach(partOfFrame => {
                                let strokedBackFrame = partOfFrame.image;
                                frameOutlines.back.forEach(outline => {
                                    if (outline.origin !== compiledPrefixFrames.sourceID) strokedBackFrame = strokeImage(strokedBackFrame, outline.color, outline.width, false, outline.matrix);
                                })
                                newFrame.composite(strokedBackFrame, paddingValues.left + partOfFrame.compositePosition.x - outlinePadding, paddingValues.above + partOfFrame.compositePosition.y - outlinePadding)
                            })
                        }
                    })

                    // Composite the icon in the 'center layer'
                    let strokedIconFrame = iconFrames[oldIconIndex];
                    const outlinePadding = frameOutlines.icon.reduce((prev, curr) => { return prev + curr.width }, 0);
                    frameOutlines.icon.forEach(outline => {
                        strokedIconFrame = strokeImage(strokedIconFrame, outline.color, outline.width, false, outline.matrix);
                    })
                    newFrame.composite(strokedIconFrame, paddingValues.left - outlinePadding, paddingValues.above - outlinePadding);

                    allPrefixFrames.forEach(compiledPrefixFrames => {
                        if (compiledPrefixFrames.frontFrames.length > 0) {
                            const frontIndex = newIconIndex % compiledPrefixFrames.frontFrames.length;
                            const frontFrame = compiledPrefixFrames.frontFrames[frontIndex];
                            const outlinePadding = frameOutlines.front.reduce((prev, curr) => { return prev + ((curr.origin === compiledPrefixFrames.sourceID) ? 0 : curr.width) }, 0);
                            frontFrame.forEach(partOfFrame => {
                                let strokedFrontFrame = partOfFrame.image;
                                frameOutlines.front.forEach(outline => {
                                    if (outline.origin !== compiledPrefixFrames.sourceID) strokedFrontFrame = strokeImage(strokedFrontFrame, outline.color, outline.width, false, outline.matrix);
                                })
                                newFrame.composite(strokedFrontFrame, paddingValues.left + partOfFrame.compositePosition.x - outlinePadding, paddingValues.above + partOfFrame.compositePosition.y - outlinePadding)
                            })
                        }
                    })

                    let doMask = false;
                    let compiledMask = new Jimp(newFrame.bitmap.width, newFrame.bitmap.height, 0x00000000);
                    allPrefixFrames.forEach(compiledPrefixFrames => {
                        if (compiledPrefixFrames.maskFrames.length > 0) {
                            const modifierIndex = newIconIndex % compiledPrefixFrames.maskFrames.length;
                            const modifierFrame = compiledPrefixFrames.maskFrames[modifierIndex].clone().resize(newFrame.bitmap.width, newFrame.bitmap.height, Jimp.RESIZE_NEAREST_NEIGHBOR);
                            compiledMask.composite(modifierFrame, 0, 0);
                            doMask = true;
                        }
                    })
                    if (doMask) newFrame.mask(compiledMask, 0, 0);

                    allPrefixFrames.forEach(compiledPrefixFrames => {
                        if (compiledPrefixFrames.frameModifiers.length > 0) {
                            const modifierIndex = newIconIndex % compiledPrefixFrames.frameModifiers.length;
                            const modifierFrame = compiledPrefixFrames.frameModifiers[modifierIndex];
                            newFrame.color(modifierFrame);
                        }
                    })

                    newAnimation.push(newFrame);
                }

                for (let shownPrefixIndex = 0; shownPrefixIndex < validatedPrefixData.shownPrefixes.length; shownPrefixIndex++) {
                    const compilingPrefixID = validatedPrefixData.shownPrefixes[shownPrefixIndex];
                    if (prefixes[compilingPrefixID].appliesDirectlyAfterAllPrefixes === true) {
                        newAnimation = (await prefixes[compilingPrefixID].compileFrames(retrievedParts, newAnimation, data.prefixSeed, cubes[modifyingID])).maskFrames;
                    }
                }

                await saveAnimatedCubeIcon(newAnimation, fileName, targetOutputDirectory, config.getCubeAnimationDelay(modifyingID));
            }
            return {
                directoryAddition: `${validatedPrefixData.newDirectoryName}`
            };
        }
    },
    size: {
        directory: '/size',
        modificationFunction: async function (modifyingPath, modifyingID, fileName, data: { size: number }) {
            // Check if the size is a power of 2, within the bounds of set above. If not, don't resize and don't return a new nested directory
            if (Number.isNaN(data.size) || data.size > config.resizeMax || data.size < config.resizeMin || (Math.log(data.size) / Math.log(2)) % 1 !== 0) return {directoryAddition: ''};

            // Get the path of the output of the previous modification
            const originalImagePath = path.resolve(`${config.relativeRootDirectory}${modifyingPath.join('')}${fileName}`);

            // Sizes can be in many forms, so let's create a separate directory for each size.
            const resizeDirectory = `/sizex${data.size}/`;

            // Create the directory path of the outcome of this modification
            const outcomeDirectory = path.resolve(`${config.relativeRootDirectory}${modifyingPath.join('')}${resizeDirectory}`);

            // Create the outcome path of the file
            const outcomeFile = `${outcomeDirectory}/${fileName}`;

            // If the path to the directory doesn't exist, create it.
            if (!fs.pathExistsSync(outcomeDirectory)) fs.mkdirSync(outcomeDirectory, { recursive: true });

            // If the icon hasn't been generated yet, then generate it (in this case, it's simply reading the original image then resizing it.)
            if (!fs.existsSync(outcomeFile) || !config.useResizeCache) {
                // Read the original icon

                let iconFrames = await loadAnimatedCubeIcon(originalImagePath);

                for (let frameIndex = 0; frameIndex < iconFrames.length; frameIndex++) {
                    // Resize the icon
                    iconFrames[frameIndex].resize(data.size, data.size, Jimp.RESIZE_NEAREST_NEIGHBOR)
                }

                // Write the icon
                await saveAnimatedCubeIcon(iconFrames, fileName, outcomeDirectory, config.getCubeAnimationDelay(modifyingID));
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
    bSide: {
        use: boolean,
            data: any
    },
    prefixes: {
        use: boolean,
        data: {
            prefixes: CCOIcons.prefixID[],
            prefixSeed: number,
            cubeSeed: number
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
        let beforePrefixes = performance.now();
        imageDirectories.push((await iconModifiers.prefixes.modificationFunction(imageDirectories, cubeID, fileName, iconAttributes.prefixes.data)).directoryAddition);
        if (config.devmode) console.log('Prefixes took '+(performance.now() - beforePrefixes)+ 'ms.');
    }

    if (iconAttributes.tallying !== undefined && iconAttributes.tallying.use === true) {
        let beforeTallying = performance.now();
        imageDirectories.push((await iconModifiers.tallying.modificationFunction(imageDirectories, cubeID, fileName, iconAttributes.tallying.data)).directoryAddition);
        if (config.devmode) console.log('Tallying took '+(performance.now() - beforeTallying)+ 'ms.');
    }

    if (iconAttributes.bSide !== undefined && iconAttributes.bSide.use === true) {
        let beforeBSide = performance.now();
        imageDirectories.push((await iconModifiers.bSide.modificationFunction(imageDirectories, cubeID, fileName, iconAttributes.bSide.data)).directoryAddition);
        if (config.devmode) console.log('B-Side took '+(performance.now() - beforeBSide)+ 'ms.');
    }

    if (iconAttributes.size !== undefined && iconAttributes.size.use === true) {
        let newBeforeResize = performance.now();
        imageDirectories.push((await iconModifiers.size.modificationFunction(imageDirectories, cubeID, fileName, iconAttributes.size.data)).directoryAddition);
        if (config.devmode) console.log('Resize took '+(performance.now() - newBeforeResize)+ 'ms.');
    }

    if (!returnSpriteSheet && fs.existsSync(`${config.relativeRootDirectory}${imageDirectories.join('')}${fileName.replace('.png', '.gif')}`)) {
        // @ts-ignore An override for a .gif, should be OK... probably
        fileName = fileName.replace('.png', '.gif');
    }

    return path.resolve(`${config.relativeRootDirectory}${imageDirectories.join('')}${fileName}`);
}

function determineFullOutputPath(params: Partial<cubeIconGenerationParameters>, cubeID: CCOIcons.cubeID, cubeIconSeed: number): {gifPath: string, pngPath: string} {
    let prefixString = ``;
    if (params?.prefixes?.use === true) {
        const prefixData = generateAndValidatePrefixDirectory(params.prefixes?.data.prefixes ?? [], params.prefixes?.data.prefixSeed ?? 1);
        prefixString = prefixData.newDirectoryName;
    }
    let bSideString = ``;
    if (params.bSide?.use === true) {
        bSideString = `bside/`;
    }
    let sizeString = ``;
    if (params.size?.use === true) {
        if (Number.isNaN(params.size.data.size) || params.size.data.size > config.resizeMax || params.size.data.size < config.resizeMin || (Math.log(params.size.data.size) / Math.log(2)) % 1 !== 0) {
            sizeString = ``;
        } else {
            sizeString = `sizex${params.size.data.size}/`
        }
    }
    let iconFileName = ``;

    if (patternedCubeIDs.find(patternedCubeID => patternedCubeID === cubeID) !== undefined) {
        iconFileName = `${cubeID}${cubeIconSeed}`
    } else {
        iconFileName = `${cubeID}`
    }
    
    const basePath = `./../ccicons/${prefixString}${bSideString}${sizeString}${iconFileName}`
    let pngPath = path.resolve(`${basePath}.png`);
    let gifPath = path.resolve(`${basePath}.gif`);

    return {gifPath, pngPath};
}

function finishServingIcon(res: Response, imagePath: string, predictedDirectory: string, genTime: number) {
    // Finally, send the file.
    if (config.devmode) console.log("Output Directory: ", imagePath);
    if (config.devmode) console.log("Predicted Output Directory: ", predictedDirectory);
    console.log(`Icon generation took ${genTime}ms.`)
    let imageStats = fs.statSync(imagePath);
    res.set('cubeiconattributes', JSON.stringify({
        size: imageStats.size,
        generationTime: genTime
    }));
    res.sendFile(imagePath);
}

const route: CCOIcons.documentedRoute = {
    routes: ['/cubeicon/:cubeid/', '/cubeicon/'],
    documentation: {
        title: "Cube Icon",
        subtitle: "GETs icons for cubes, generates them if needed.",
        resolves: "image",
        author: "AspectQuote",
        description: "Endpoint that returns a constructed cube icon based on given parameters.",
        examples: [{
            name: "Large Green Cube Icon",
            example: "/cubeicon/green?size=512",
            description: "Will resolve into a 512x512 version of the Green Cube icon."
        }],
        parameterDocs: [
            {
                parameter: ':cubeid',
                name: "Cube ID",
                subtitle: "ID of any Cube",
                description: "Accepts any cube ID. Changes the requested icon to that cube ID. For example, 'green' will give the green cube icon. Similarly, 'red' will return the Red Cube's icon, so on and so forth. If 'random' is supplied, a random cubeID will be used.",
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
                    },
                    {
                        name: "Random Cube Icon",
                        example: "/cubeicon/random",
                        description: "Will return the icon for a random cube."
                    }
                ],
                requestBuilderPossibs: Object.keys(cubes)
            }
        ],
        queryDocs: [
            {
                query: 'size',
                name: "Icon Size",
                subtitle: "The desired size.",
                description: `The desired size of the requested icon in pixels. Must be a power of 2, with the minimum being ${config.resizeMin}, and the maximum being ${config.resizeMax}.`,
                examples: [
                    {
                        name: "512x512 Cube Icon",
                        example: "/cubeicon?size=512",
                        description: "Will return the 'green' cubeID icon at a size of 512x512px."
                    },
                    {
                        name: "16x16 Cardboard Box Cube Icon",
                        example: "/cubeicon/cardboardbox?size=16",
                        description: "Will return the cardboard box icon at a size of 16x16px. Note: This is the smallest version of any icon you can request."
                    }
                ],
                requestBuilderPossibs: [1].map(() => {
                    let validArray: number[] = [Math.log2(config.resizeMin)];
                    while (2 ** validArray[validArray.length-1] < config.resizeMax) {
                        validArray.push(validArray[validArray.length - 1] + 1);
                    }
                    return validArray.map(power => String(2 ** power))
                }).flat(1)
            },
            {
                query: 'tallying',
                name: "Cube Tallies",
                subtitle: "The desired tallying completion percent.",
                description: `The desired tally completion percent, with the minimum being 0, and the maximum being ${config.maxTallyPercent}.`,
                examples: [
                    {
                        name: "Initial Tallying Cube Icon",
                        example: "/cubeicon?tallying=0",
                        description: "Will return the 'green' cubeID icon with 0% tally completion."
                    },
                    {
                        name: "High Percent Tallying Cube Icon",
                        example: "/cubeicon/orange?tallying=1182",
                        description: "Will return the 'orange' cubeID icon with 1182% tally completion."
                    },
                ],
                requestBuilderPossibs: [1].map(() => {
                    let validArray: string[] = [];
                    while (validArray.length < config.maxTallyPercent) {
                        validArray.push(`${validArray.length}`);
                    }
                    return validArray;
                }).flat(1)
            },
            {
                query: 'bside',
                name: "B-Side Icon",
                subtitle: "Whether or not you want the B-Side attribute modification to be applied.",
                description: "You don't have to include anything as part of this parameter, simply including 'bside' as a query modifier in the URL is enough.",
                examples: [
                    {
                        name: "B-Side Brimstone Cube Icon",
                        example: "/cubeicon/brimstone?bside",
                        description: "Will return the 'brimstone' icon with the B-Side attribute modifier applied."
                    },
                    {
                        name: "B-Side Perfect Eclipse Cube Icon",
                        example: "/cubeicon/eclipse?bside&pattern=45",
                        description: "Will return the 'eclipse' icon, with pattern ID 45, along with the B-Side attribute modifier applied."
                    }
                ],
                requestBuilderPossibs: ['true']
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
                        example: "/cubeicon/sublime?contraband&spritesheet",
                        description: "Will return the 'sublime' cubeID's contraband variant spritesheet image."
                    }
                ],
                requestBuilderPossibs: ['true']
            },
            {
                query: 'pattern',
                name: "Pattern Attribute",
                subtitle: "Request a specific pattern index from a cube.",
                description: `The pattern can be any number from 0 to ${config.cubePatternIndexLimit - 1}. This only affects cubes with seeded patterns. Supplying a number greater than ${config.cubePatternIndexLimit - 1} will simply have the modulus of ${config.cubePatternIndexLimit - 1} taken from that number. Supplying a number less than 0 will have its absolute value taken. Supplying 'random' as the parameter will make the server take a random seed. NOTE: If no 'pattern' is supplied then the server will default to pattern ID 1.`,
                examples: [
                    {
                        name: "Perfect Eclipse Cube Icon",
                        example: "/cubeicon/eclipse?pattern=45",
                        description: "Will return the 45th pattern index of the eclipse cube (the 'perfect' variant)."
                    },
                    {
                        name: "512x512 Random Chalkboard Cube Icon",
                        example: "/cubeicon/chalkboard?pattern=random",
                        description: "Will return a random Chalkboard Cube icon at a size of 512x512px. Note: 'pattern' is supplied 'random' instead of a pattern index."
                    }
                ],
                requestBuilderPossibs: [1].map(() => {
                    let validArray: string[] = [];
                    while (validArray.length < config.cubePatternIndexLimit) {
                        validArray.push(`${validArray.length}`);
                    }
                    return validArray;
                }).flat(1)
            },
            {
                query: 'prefixes',
                name: "Prefixes Attribute",
                subtitle: "Request cubes with specific prefixes.",
                description: `Can be any valid prefix ID, or a list of valid prefix IDs. Invalid IDs will be ignored. The server will generate up to ${config.shownPrefixLimit} different prefixes on one cube. If more than ${config.shownPrefixLimit} prefixes are supplied, the server will sort the prefixes in application order and use the first three of those to determine which to show.`,
                examples: [
                    {
                        name: "Sacred Green Cube Icon",
                        example: "/cubeicon/green?prefixes=Sacred",
                        description: "Will return the 'green' cube with the 'Sacred' prefix applied."
                    },
                    {
                        name: "Flaming Marvelous Red Cube Icon",
                        example: "/cubeicon/red?prefixes=Flaming,Marvelous",
                        description: "Will return the 'red' cube with the 'Flaming' and 'Marvelous' prefixes applied."
                    }
                ],
                requestBuilderPossibs: Object.keys(prefixes)
            },
            {
                query: 'prefixseed',
                name: "Prefix Pattern Attribute",
                subtitle: "Request prefixes with a specific pattern index.",
                description: `The pattern can be any number from 0 to ${config.prefixPatternIndexLimit - 1}. This only affects prefixes with seeded variants. Supplying a number greater than ${config.prefixPatternIndexLimit - 1} will simply have the modulus of ${config.prefixPatternIndexLimit - 1} taken from that number. Supplying a number less than 0 will have its absolute value taken. Supplying 'random' as the parameter will make the server take a random seed. NOTE: If no 'prefixseed' is supplied then the server will default to pattern ID 1.`,
                examples: [
                    {
                        name: "Perfect Eclipse Cube Icon",
                        example: "/cubeicon/eclipse?pattern=45&prefixseed=51&prefixes=Chained",
                        description: "Will return the 45th pattern index of the eclipse cube (the 'perfect' variant), with the Chained prefix applied with its 51st pattern index."
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
        let startIconGeneration = performance.now();
        // Set requested cube ID variable
        let requestedCubeID: CCOIcons.cubeID;
        if (cubes[(req.params?.cubeid ?? 'green').toLowerCase() as CCOIcons.cubeID] !== undefined) {
            requestedCubeID = ((req.params?.cubeid ?? 'green').toLowerCase() as CCOIcons.cubeID);
        } else if (req.params?.cubeid === 'random') {
            requestedCubeID = (Object.keys(cubes) as CCOIcons.cubeID[])[Math.floor(Math.random() * Object.keys(cubes).length)]
        } else {
            requestedCubeID = 'green';
        }

        console.log("Cube ID: ", requestedCubeID);
        // Cube icon generation parameters storer
        const cubeIconParams: Partial<cubeIconGenerationParameters> = {};

        let cubeIconSeed = 1;
        let returnSpriteSheet = false;
        if (Object.keys(req.query).length > 0) {
            if (typeof req.query.size === "string") { // Cube Icon Size query modifier
                cubeIconParams.size = {
                    use: true,
                    data: {
                        size: Number.parseInt(req.query.size)
                    }
                }
            }

            if (typeof req.query.prefixes === "string") {
                const suppliedPrefixes = req.query.prefixes.slice(0, 50).split(',');
                const validatedPrefixes = [...new Set(validPrefixIDs.filter(prefixID => suppliedPrefixes.includes(prefixID)))];
                if (validatedPrefixes.length > 0) {
                    cubeIconParams.prefixes = {
                        use: true,
                        data: {
                            prefixes: validatedPrefixes,
                            prefixSeed: 1,
                            cubeSeed: 1
                        }
                    }
                    if (typeof req.query.prefixseed === "string") {
                        if (req.query.prefixseed === "random") {
                            cubeIconParams.prefixes.data.prefixSeed = Math.floor(Math.random() * config.prefixPatternIndexLimit);
                        } else {
                            let possiblePrefixSeed = Number.parseInt(req.query.prefixseed);
                            if (Number.isNaN(possiblePrefixSeed)) {
                                possiblePrefixSeed = 1; // If an unparsable pattern was given
                            }
                            if (possiblePrefixSeed < 0) {
                                possiblePrefixSeed = Math.abs(possiblePrefixSeed); // If the seed is less than 0, then set it to the positive version of that number.
                            }
                            if (possiblePrefixSeed > (config.prefixPatternIndexLimit - 1)) {
                                possiblePrefixSeed = possiblePrefixSeed % (config.prefixPatternIndexLimit - 1); // If the number is greater than the pattern limit, then just take the modulus of the number.
                            }
                            cubeIconParams.prefixes.data.prefixSeed = possiblePrefixSeed;
                        }
                    }
                }
            }

            if (typeof req.query.pattern === "string") {
                if (req.query.pattern === "random") {
                    cubeIconSeed = Math.floor(Math.random() * config.cubePatternIndexLimit);
                } else {
                    let possibleIconSeed = Number.parseInt(req.query.pattern);
                    if (Number.isNaN(possibleIconSeed)) {
                        possibleIconSeed = 1; // If an unparsable pattern was given
                    }
                    if (possibleIconSeed < 0) {
                        possibleIconSeed = Math.abs(possibleIconSeed); // If the seed is less than 0, then set it to the positive version of that number.
                    }
                    if (possibleIconSeed > (config.cubePatternIndexLimit - 1)) {
                        possibleIconSeed = possibleIconSeed % (config.cubePatternIndexLimit - 1); // If the number is greater than the pattern limit, then just take the modulus of the number.
                    }
                    cubeIconSeed = possibleIconSeed;
                }
                if (cubeIconParams.prefixes?.use) {
                    cubeIconParams.prefixes.data.cubeSeed = cubeIconSeed;
                }
            }

            if (typeof req.query.tallying === "string") {
                let possibleIconTallies = Number.parseInt(req.query.tallying);
                if (Number.isNaN(possibleIconTallies)) {
                    possibleIconTallies = 0; // If an unparsable tally% was given
                }
                if (possibleIconTallies < 0) {
                    possibleIconTallies = Math.abs(possibleIconTallies); // If the tally% is less than 0, then set it to the positive version of that number.
                }
                cubeIconParams.tallying = {
                    use: true,
                    data: {
                        tallies: possibleIconTallies
                    }
                }
            }
            if (req.query.bside !== undefined) {
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
        if (config.devmode) console.log(cubeIconParams, requestedCubeID)
        const predictedDirectory = determineFullOutputPath(cubeIconParams, requestedCubeID, cubeIconSeed);
        if (!config.devmode && fs.existsSync(predictedDirectory.pngPath)) {
            if (fs.existsSync(predictedDirectory.gifPath) && !returnSpriteSheet) {
                imagePath = predictedDirectory.gifPath;
            } else {
                imagePath = predictedDirectory.pngPath;
            }
            console.log('Served using prediction.');
            return finishServingIcon(res, imagePath, predictedDirectory.pngPath, performance.now() - startIconGeneration);
        } else {
            console.log('Created waiting storage.');
            try {
                // Create the image (if needed) and get its path
                imagePath = await generateCubeIcon(cubeIconParams, requestedCubeID, cubeIconSeed, returnSpriteSheet);
            } catch (e) {
                console.log(e, requestedCubeID, cubeIconParams);
                res.status(403);
                return res.send('Failed to get this image. Internal error: ' + e.stack);
            }
            finishServingIcon(res, imagePath, predictedDirectory.pngPath, performance.now() - startIconGeneration);
            return;
        }
    }
}

export {
    route as cubeIconRoute
}