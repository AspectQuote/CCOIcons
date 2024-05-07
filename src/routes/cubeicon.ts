import * as CCOIcons from './../typedefs';
import * as fs from 'fs-extra';
import * as path from 'path';
import Jimp from 'jimp';
import * as gifwrap from 'gifwrap';
import { createBSideImage } from './../modules/bside';
import { fillRect, loadAnimatedCubeIcon, saveAnimatedCubeIcon, strokeImage } from './../modules/imageutils';
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

const divineFrames = 15;
const divineColor = 0xffffffff;
const divineIconName = `divine`;
const divineDelayCentisecs = 0.5;
const alwaysRegenerateDivineAnimation = false;

const slatedFrames = 15;
const slatedColor = 0x213047ff;
const slatedIconName = `slated`;
const slatedDelayCentisecs = 0.5;
const alwaysRegenerateSlatedAnimation = false;

const relativeRootDirectory = `${__dirname}/../../..`;
const sourceImagesDirectory = './sourceicons/cubes/';

if (!fs.existsSync(`${relativeRootDirectory}/ccicons/`)) fs.mkdirSync(`${relativeRootDirectory}/ccicons/`);
if (!fs.existsSync(`${relativeRootDirectory}/ccicons/attributespritesheets`)) fs.mkdirSync(`${relativeRootDirectory}/ccicons/attributespritesheets`);

if (alwaysRegenerateDivineAnimation || !fs.existsSync(`${relativeRootDirectory}/ccicons/attributespritesheets/${divineIconName}.png`)) {
    (async () => {
        let divineFlashMask = await Jimp.read(`${sourceImagesDirectory}/../attributeeffects/divine/flash.png`);
        let divinePatternMask = await Jimp.read(`${sourceImagesDirectory}/../attributeeffects/divine/pattern.png`);
        const baseDivineResolution = divineFlashMask.bitmap.width;
        let divineBaseImage = new Jimp(baseDivineResolution, baseDivineResolution, divineColor).mask(divineFlashMask, 0, 0);
        divineBaseImage._background = 0x00000000;
        let generatedDivineFrames: Jimp[] = [];

        let rotationIncrement = 90 / divineFrames;
        for (let frameIndex = 0; frameIndex < divineFrames; frameIndex++) {
            let newDivineFrame = divineBaseImage.clone().rotate((rotationIncrement * frameIndex) + 1, false);
            newDivineFrame.composite(divineBaseImage.clone().rotate(-(rotationIncrement * frameIndex), false), 0, 0);
            generatedDivineFrames.push(newDivineFrame.mask(divinePatternMask, 0, 0));
        }

        saveAnimatedCubeIcon(generatedDivineFrames, divineIconName, `${relativeRootDirectory}/ccicons/attributespritesheets`, divineDelayCentisecs);
    })()
}

if (alwaysRegenerateSlatedAnimation || !fs.existsSync(`${relativeRootDirectory}/ccicons/attributespritesheets/${slatedIconName}.png`)) {
    (async () => {
        let slatedBaseShape = await Jimp.read(`${sourceImagesDirectory}/../attributeeffects/slated/round.png`);
        let slatedBaseSquareSize = slatedBaseShape.bitmap.width;
        let slatedPadding = 15;
        let generatedSlatedFrames: Jimp[] = [];
        let slatedRNG = new seedrandom(`slatedseedaaalmaoidk`);
        let slatedPatternMask = await Jimp.read(`${sourceImagesDirectory}/../attributeeffects/slated/pattern.png`);

        function areaCoveredByRectangles(rectArray: typeof topRectangles) {
            return rectArray.reduce((prev, curr) => {
                return prev + curr.offset + curr.width;
            }, 0)
        }

        function populateSlatedRectangleArray(): { width: number, size: number, maxSize: number, minSize: number, offset: number, direction: boolean }[] {
            let rectangleArray: typeof topRectangles = [];
            while (areaCoveredByRectangles(rectangleArray) < slatedBaseSquareSize - 2) {
                let size = Math.ceil(slatedRNG() * (slatedPadding / 2));

                let maxSize = size + Math.round(slatedFrames / 2) - 1;
                let minSize = size - Math.round(slatedFrames / 2) + 1;

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

        for (let slatedFrameIndex = 0; slatedFrameIndex < slatedFrames; slatedFrameIndex++) {
            let newSlatedFrame = new Jimp(slatedBaseSquareSize + slatedPadding * 2, slatedBaseSquareSize + slatedPadding * 2, 0x00000000);

            fillRect(newSlatedFrame, slatedPadding, slatedPadding, slatedBaseSquareSize, slatedBaseSquareSize, slatedColor);
            newSlatedFrame.mask(slatedBaseShape, slatedPadding, slatedPadding)

            let topXPos = slatedPadding;
            topRectangles.forEach(rectangle => {
                fillRect(newSlatedFrame, topXPos + topUniversalRectangleOffset, slatedPadding - rectangle.size, rectangle.width, rectangle.size + (slatedBaseSquareSize/2), slatedColor);
                topXPos += rectangle.width + rectangle.offset;
                rectangle.size += rectangle.direction ? 1 : -1;
                if (rectangle.size == rectangle.maxSize || rectangle.size == rectangle.minSize) rectangle.direction = !rectangle.direction;
            })

            let bottomXPos = slatedPadding;
            bottomRectangles.forEach(rectangle => {
                fillRect(newSlatedFrame, bottomXPos + bottomUniversalRectangleOffset, slatedPadding + slatedBaseSquareSize - (slatedBaseSquareSize / 2), rectangle.width, rectangle.size + (slatedBaseSquareSize / 2), slatedColor);
                bottomXPos += rectangle.width + rectangle.offset;
                rectangle.size += rectangle.direction ? 1 : -1;
                if (rectangle.size == rectangle.maxSize || rectangle.size == rectangle.minSize) rectangle.direction = !rectangle.direction;
            })

            let leftYPos = slatedPadding;
            leftRectangles.forEach(rectangle => {
                fillRect(newSlatedFrame, slatedPadding - rectangle.size, leftYPos + leftUniversalRectangleOffset, rectangle.size + (slatedBaseSquareSize / 2), rectangle.width, slatedColor);
                leftYPos += rectangle.width + rectangle.offset;
                rectangle.size += rectangle.direction ? 1 : -1;
                if (rectangle.size == rectangle.maxSize || rectangle.size == rectangle.minSize) rectangle.direction = !rectangle.direction;
            })

            let rightYPos = slatedPadding;
            rightRectangles.forEach(rectangle => {
                fillRect(newSlatedFrame, slatedPadding + slatedBaseSquareSize - (slatedBaseSquareSize / 2), rightYPos + rightUniversalRectangleOffset, rectangle.size + (slatedBaseSquareSize / 2), rectangle.width, slatedColor);
                rightYPos += rectangle.width + rectangle.offset;
                rectangle.size += rectangle.direction ? 1 : -1;
                if (rectangle.size == rectangle.maxSize || rectangle.size == rectangle.minSize) rectangle.direction = !rectangle.direction;
            })

            generatedSlatedFrames.push(newSlatedFrame.mask(slatedPatternMask, 0, 0));
        }
        saveAnimatedCubeIcon(generatedSlatedFrames, slatedIconName, `${relativeRootDirectory}/ccicons/attributespritesheets`, slatedDelayCentisecs);
    })()
}

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
                        const cubeDirectory = `${relativeRootDirectory}/CCOIcons/sourceicons/cubes/${newCubeID}`;
                        if (fs.existsSync(cubeDirectory)) {
                            let newCubeFrame = await loadAnimatedCubeIcon(`${cubeDirectory}/cube.png`);
                            allBadassFrames.push(newCubeFrame[Math.ceil(newCubeFrame.length * badassRNG()) - 1].resize(32, 32, Jimp.RESIZE_NEAREST_NEIGHBOR));
                        }
                    }
                    await saveAnimatedCubeIcon(allBadassFrames, `badass`, outcomePath, 0.1);
                }
            } else if (patternedCubeIDs.find(patternedCubeID => patternedCubeID === modifyingID) !== undefined) {
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
                    contrabandEffectClone = strokeImage(contrabandEffectClone, 0x000000ff);
                    contrabandEffectClone.crop(1, 1, contrabandEffectClone.bitmap.width-1, contrabandEffectClone.bitmap.height-1);
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
            const newImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}/divine`);
            if (!fs.existsSync(newImagePath)) fs.mkdirSync(newImagePath, { recursive: true });
            const newIconPath = path.resolve(`${newImagePath}/${fileName}`);
            if (!fs.existsSync(newIconPath)) {
                let divineFrameBase = await loadAnimatedCubeIcon(`${relativeRootDirectory}/ccicons/attributespritesheets/${divineIconName}.png`);
                let iconFrames = await loadAnimatedCubeIcon(originalImagePath);
                iconFrames.forEach((frame, index) => {
                    iconFrames[index] = strokeImage(frame, divineColor);
                })
                let neededIconFrames = 0;
                if (divineFrames % iconFrames.length === 0 || iconFrames.length % divineFrames === 0) {
                    neededIconFrames = Math.max(divineFrames, iconFrames.length);
                } else {
                    neededIconFrames = divineFrames * iconFrames.length;
                }
                let newIconFrames: Jimp[] = [];
                for (let frameIndex = 0; frameIndex < neededIconFrames; frameIndex++) {
                    let divineFrameBaseIndex = frameIndex % divineFrameBase.length;
                    let iconFrameIndex = frameIndex % iconFrames.length;
                    if (divineFrameBase[divineFrameBaseIndex].bitmap.width !== (iconFrames[iconFrameIndex].bitmap.width * 2)) {
                        divineFrameBase[divineFrameBaseIndex].resize(iconFrames[iconFrameIndex].bitmap.width * 2, iconFrames[0].bitmap.height * 2, Jimp.RESIZE_NEAREST_NEIGHBOR);
                    }
                    let iconFramePosition = (divineFrameBase[divineFrameBaseIndex].bitmap.width / 2) - (iconFrames[iconFrameIndex].bitmap.width / 2);
                    newIconFrames.push(divineFrameBase[divineFrameBaseIndex].clone().composite(iconFrames[iconFrameIndex], iconFramePosition, iconFramePosition));
                }
                await saveAnimatedCubeIcon(newIconFrames, fileName, `${newImagePath}/`);
            }
            return {
                directoryAddition: `/divine/`
            };
        }
    },
    slated: {
        directory: '/slated',
        modificationFunction: async function (modifyingPath, modifyingID, fileName, data: any) {
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${fileName}`);
            const newImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}/slated`);
            if (!fs.existsSync(newImagePath)) fs.mkdirSync(newImagePath, { recursive: true });
            const newIconPath = path.resolve(`${newImagePath}/${fileName}`);
            if (!fs.existsSync(newIconPath)) {
                let slatedFrameBase = await loadAnimatedCubeIcon(`${relativeRootDirectory}/ccicons/attributespritesheets/${slatedIconName}.png`);
                let iconFrames = await loadAnimatedCubeIcon(originalImagePath);
                iconFrames.forEach((frame, index) => {
                    iconFrames[index] = strokeImage(frame, slatedColor);
                })
                let neededIconFrames = 0;
                if (slatedFrames % iconFrames.length === 0 || iconFrames.length % slatedFrames === 0) {
                    neededIconFrames = Math.max(slatedFrames, iconFrames.length);
                } else {
                    neededIconFrames = slatedFrames * iconFrames.length;
                }
                let newIconFrames: Jimp[] = [];
                for (let frameIndex = 0; frameIndex < neededIconFrames; frameIndex++) {
                    let slatedFrameBaseIndex = frameIndex % slatedFrameBase.length;
                    let iconFrameIndex = frameIndex % iconFrames.length;
                    if (slatedFrameBase[slatedFrameBaseIndex].bitmap.width !== (iconFrames[iconFrameIndex].bitmap.width * 2)) {
                        slatedFrameBase[slatedFrameBaseIndex].resize(iconFrames[iconFrameIndex].bitmap.width * 2, iconFrames[0].bitmap.height * 2, Jimp.RESIZE_NEAREST_NEIGHBOR);
                    }
                    let iconFramePosition = (slatedFrameBase[slatedFrameBaseIndex].bitmap.width / 2) - (iconFrames[iconFrameIndex].bitmap.width / 2);
                    newIconFrames.push(slatedFrameBase[slatedFrameBaseIndex].clone().composite(iconFrames[iconFrameIndex], iconFramePosition, iconFramePosition));
                }
                await saveAnimatedCubeIcon(newIconFrames, fileName, `${newImagePath}/`);
            }
            return {
                directoryAddition: `/slated/`
            };
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
            example: "/cubeicon/green?size=512",
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
                query: 'size',
                name: "Icon Size",
                subtitle: "The desired size.",
                description: `The desired size of the requested icon in pixels. Must be a power of 2, with the minimum being ${resizeMin}, and the maximum being ${resizeMax}.`,
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
                ]
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
                ]
            },
            {
                query: 'contraband',
                name: "Contraband Attribute",
                subtitle: "Whether or not you want the contraband attribute modification to be applied.",
                description: "You don't have to include anything as part of this parameter, simply including 'contraband' as a query modifier in the URL is enough.",
                examples: [
                    {
                        name: "Contraband Green Cube Icon",
                        example: "/cubeicon?contraband",
                        description: "Will return the 'green' cubeID icon in its contraband variant."
                    },
                    {
                        name: "512x512 Contraband Red Cube Icon",
                        example: "/cubeicon/red?contraband&size=512",
                        description: "Will return the contraband red cube icon at a size of 512x512px. Note: 'contraband' is simply provided without any value in the URL."
                    }
                ]
            },
            {
                query: 'divine',
                name: "Divine Attribute",
                subtitle: "Whether or not you want the divine attribute modification to be applied.",
                description: "You don't have to include anything as part of this parameter, simply including 'divine' as a query modifier in the URL is enough.",
                examples: [
                    {
                        name: "Divine Cardboard Box Cube Icon",
                        example: "/cubeicon/cardboardbox?divine",
                        description: "Will return the 'cardboardbox' cubeID icon in its divine variant."
                    },
                    {
                        name: "512x512 Divine B-Side Red Cube Icon",
                        example: "/cubeicon/red?divine&bside",
                        description: "Will return the divine b-side red cube icon. Note: 'divine' is simply provided without any value in the URL."
                    }
                ]
            },
            {
                query: 'slated',
                name: "Slated Attribute",
                subtitle: "Whether or not you want the slated attribute modification to be applied.",
                description: "You don't have to include anything as part of this parameter, simply including 'slated' as a query modifier in the URL is enough.",
                examples: [
                    {
                        name: "Slated Medusa Cube Icon",
                        example: "/cubeicon/medusa?slated",
                        description: "Will return the 'medusa' cubeID icon in its slated variant."
                    },
                    {
                        name: "512x512 Slated B-Side Orange Cube Icon",
                        example: "/cubeicon/orange?slated&bside",
                        description: "Will return the slated b-side orange cube icon. Note: 'slated' is simply provided without any value in the URL."
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
                        example: "/cubeicon/sublime?contraband&spritesheet",
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
            if (req.query.contraband !== undefined) {
                cubeIconParams.contraband = {
                    use: true,
                    data: {
                        seed: cubeIconSeed
                    }
                }
            }
            if (req.query.bside !== undefined) {
                cubeIconParams.bSide = {
                    use: true,
                    data: {}
                }
            }
            if (req.query.divine !== undefined) {
                cubeIconParams.divine = {
                    use: true,
                    data: {}
                }
            }
            if (req.query.slated !== undefined) {
                cubeIconParams.slated = {
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