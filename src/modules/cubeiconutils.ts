import * as CCOIcons from './../typedefs';
import * as fs from 'fs-extra';
import * as path from 'path';
import Jimp from 'jimp';
import { loadAnimatedCubeIcon, saveAnimatedCubeIcon, strokeImage } from './../modules/imageutils';
import { prefixes, getNeededPaddingFromCompiledFrames, prefixIDApplicationOrder, sortPrefixesByApplicationOrder, prefixHasTag } from './../modules/schematics/prefixes';
import * as config from '../modules/schematics/config';
import * as maths from '../modules/maths';
import { createBSideV2Image } from './bsidev2';
import { createBSideImage } from './bside';
let seedrandom: new (seed: string) => () => number = require('seedrandom');
const cubes: { [key in CCOIcons.cubeID]: CCOIcons.cubeDefinition } = fs.readJSONSync('./config/cubes.json');
const rarityConfig: { [key in CCOIcons.rarityID]: CCOIcons.rarityDefinition } = fs.readJSONSync('./config/rarityconfig.json');
const patternSchema: { [key in CCOIcons.patternedCubeID]: CCOIcons.patternedCubeDefinition } = fs.readJSONSync('./config/patterneditems.json');
const patternedCubeIDs: CCOIcons.patternedCubeID[] = Object.keys(patternSchema) as CCOIcons.patternedCubeID[];
const validPrefixIDs: CCOIcons.prefixID[] = Object.keys(prefixes) as CCOIcons.prefixID[];
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

/**
 * Make sure a custom patterned item has a populated icon directory to draw from
 * @param info The property of a custom seeded icon object to use for icon generation
 * @param key The icon part that needs to be populated
 * @param seed The seed of the icon part
 * @param cubeID The ID of the custom seeded icon
 * @param outputDirectory Which directory should be populated
 */
async function populateCustomSeededIconPart(info: string | ((seed: number) => Promise<string>), key: ("base" | CCOIcons.cubeAnchorPoints), seed: number, cubeID: CCOIcons.cubeID, outputDirectory: string) {
    const sourcePath = (typeof info === "string") ? info : await info(seed);
    const customSeededIcon = await loadAnimatedCubeIcon(sourcePath);
    await saveAnimatedCubeIcon(customSeededIcon, (key === "base") ? "cube" : key, outputDirectory, config.getCubeAnimationDelay(cubeID));
    return true;
}

/**
 * Make sure a patterned cube and the associated parts of the cube are generated, if not, generate them. Returns the directory where the icon and parts are stored.
 * @param cubeID A patterned cube ID
 * @param patternIndex The index of the pattern you want to regenerate
 * @returns The path to the icon directory
 */
async function getPatternedIconAndPartDirectory(cubeID: CCOIcons.patternedCubeID, patternIndex: number): Promise<string> {
    const patternAtlasDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/patternatlases/${cubeID}/${patternIndex}/`);
    if (!fs.existsSync(`${patternAtlasDirectory}/cube.png`)) {
        if (config.devmode) console.log("Regenerating Pattern: " + patternIndex);
        fs.mkdirSync(patternAtlasDirectory, { recursive: true });
        if (cubeID in customSeededCubes && customSeededCubes[cubeID] !== undefined) {
            await populateCustomSeededIconPart(customSeededCubes[cubeID].accents, "accents", patternIndex, cubeID, patternAtlasDirectory);
            await populateCustomSeededIconPart(customSeededCubes[cubeID].mouths, "mouths", patternIndex, cubeID, patternAtlasDirectory);
            await populateCustomSeededIconPart(customSeededCubes[cubeID].eyes, "eyes", patternIndex, cubeID, patternAtlasDirectory);
            await populateCustomSeededIconPart(customSeededCubes[cubeID].heads, "heads", patternIndex, cubeID, patternAtlasDirectory);
            await populateCustomSeededIconPart(customSeededCubes[cubeID].base, "base", patternIndex, cubeID, patternAtlasDirectory);
        } else {
            const patternInfo: undefined | CCOIcons.patternedCubeDefinition = patternSchema[cubeID];
    
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
                                    const brightness = maths.clampRandomHiLo(patternImageData.seedbrightnessrange[0], patternImageData.seedbrightnessrange[1], individualPatternSeedRNG.brightness);
                                    const manipulationMethod = brightness > 0 ? "lighten" : "darken";
                                    imageManipulations.push({ apply: manipulationMethod, params: [Math.abs(brightness)] });
                                }
                                // Saturate the pattern image
                                if (patternImageData.seedsaturate) {
                                    const saturation = maths.clampRandomHiLo(patternImageData.seedsaturaterange[0], patternImageData.seedsaturaterange[1], individualPatternSeedRNG.saturation);
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
                                const scale = maths.clampRandomHiLo(patternImageData.seedscalerange[0], patternImageData.seedscalerange[1], individualPatternSeedRNG.scale);
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
    }
    return patternAtlasDirectory;
}

/**
 * Retrieves a part or icon of a patterned cube, returns the image of that icon or part.
 * @param cubeID A patterned cube ID
 * @param seed The seed index of the patterned cube
 * @param type What part of the cube to retrieve
 * @returns The icon associated with the part retrieved
 */
async function getSeededCubeIconType(cubeID: CCOIcons.patternedCubeID, seed: number, type: typeof seededIconKeys[number]): Promise<Jimp[]> {
    const iconPath = await getPatternedIconAndPartDirectory(cubeID, seed);
    if (config.devmode) console.log(`Cube icon type: `, iconPath)
    return await loadAnimatedCubeIcon(`${iconPath}/${(type === "base") ? "cube" : type}.png`);
}

/**
 * Retrieves a part or icon of a cube, returns each frame in the animation of that cube's icon or part.
 * @param cubeID The ID of any cube
 * @param seed The seed index of the cube (In case it's a patterned item)
 * @param type What part of the cube to retrieve
 * @returns An array of the icons in the animation of the cube
 */
async function getCubeIconPart(cubeID: CCOIcons.cubeID, seed: number, type: typeof seededIconKeys[number]): Promise<Jimp[]> {
    if (patternedCubeIDs.find(patternedCubeID => patternedCubeID === cubeID) !== undefined) {
        return await getSeededCubeIconType(cubeID as CCOIcons.patternedCubeID, seed, type);
    } else {
        const customMaskImagePath = `${config.sourceImagesDirectory}/cubes/${cubeID}/${type}.png`;
        return await loadAnimatedCubeIcon((!fs.existsSync(customMaskImagePath)) ? `${config.sourceImagesDirectory}_DEFAULT_/${type}.png` : customMaskImagePath);
    }
}

/**
 * Generates the directory in which supplied prefixes should be stored. Sorts and shortens the supplied prefixes to comply with the config.
 * @param suppliedPrefixes The prefixes to generate the directory for
 * @param prefixSeed The prefix seed, will be used if any of the supplied prefixes are seeded.
 * @returns The prefixes that should be shown, and the path to the directory where the output should be stored.
 */
function generateAndValidatePrefixDirectory(suppliedPrefixes: CCOIcons.prefixID[], prefixSeed: number): { shownPrefixes: CCOIcons.prefixID[], newDirectoryName: string } {
    let shownPrefixes = [...suppliedPrefixes].sort(sortPrefixesByApplicationOrder);
    if (shownPrefixes.filter(prefixID => prefixes[prefixID].tags.length > 0 && !prefixHasTag(prefixID, "ignoresPrefixCap")).length > config.shownPrefixLimit) {
        let exemptedPrefixes = shownPrefixes.filter(prefixID => prefixHasTag(prefixID, "ignoresPrefixCap"));
        let cutPrefixes = shownPrefixes.filter(prefixID => !prefixHasTag(prefixID, "ignoresPrefixCap"));
        shownPrefixes = [...exemptedPrefixes, ...cutPrefixes.slice(0, config.shownPrefixLimit)];
    }
    const usingSeed = shownPrefixes.findIndex(prefix => prefixHasTag(prefix, "seeded")) != -1;

    let newDirectoryName = `prefix${usingSeed ? prefixSeed : ''}${shownPrefixes.join('').toLowerCase()}/`;

    return { shownPrefixes, newDirectoryName };
}

/**
 * Generate a prefixed icon.
 * @param iconFrames The frames of the base cube
 * @param cubeID The ID of the base cube
 * @param shownPrefixes What prefixes should be applied to the cube
 * @param prefixSeed The seed of the prefixes that should be applied to the cube
 * @param cubeSeed The seed of the cube (if the cube is patterned)
 * @param showCubeIcon Whether or not the cube icon is needed for the output.
 * @returns The new animated icon with all the shownPrefixes applied.
 */
async function generatePrefixedCube(iconFrames: Jimp[], cubeID: CCOIcons.cubeID, shownPrefixes: CCOIcons.prefixID[], prefixSeed: number, cubeSeed: number, showCubeIcon: boolean): Promise<Jimp[]> {
    const neededParts: { [key in CCOIcons.cubeAnchorPoints]: boolean } = {
        accents: shownPrefixes.findIndex(prefix => prefixes[prefix].needs.accents === true) != -1,
        eyes: shownPrefixes.findIndex(prefix => prefixes[prefix].needs.eyes === true) != -1,
        heads: shownPrefixes.findIndex(prefix => prefixes[prefix].needs.heads === true) != -1,
        mouths: shownPrefixes.findIndex(prefix => prefixes[prefix].needs.mouths === true) != -1
    }
    const retrievedParts: CCOIcons.anchorPointSchema = {
        accents: [],
        eyes: [],
        heads: [],
        mouths: []
    }

    if (neededParts.accents) {
        let accentFrames = await getCubeIconPart(cubeID, cubeSeed, "accents");
        for (let accentFrameIndex = 0; accentFrameIndex < accentFrames.length; accentFrameIndex++) {
            const currentFrame = accentFrames[accentFrameIndex];
            let accentCoordinates: CCOIcons.anchorPointSchema["accents"][number] = {
                image: currentFrame
            };
            retrievedParts.accents.push(accentCoordinates);
        }
    }

    if (neededParts.eyes) {
        let eyeFrames = await getCubeIconPart(cubeID, cubeSeed, "eyes");
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
        let mouthFrames = await getCubeIconPart(cubeID, cubeSeed, "mouths");
        for (let mouthFrameIndex = 0; mouthFrameIndex < mouthFrames.length; mouthFrameIndex++) {
            const currentFrame = mouthFrames[mouthFrameIndex];
            let mouthsFound: CCOIcons.anchorPointSchema["mouths"][number] = {
                positions: []
            };
            let onMouth = false;
            let currentMouthSize = 0;
            let currentMouthStartPosition: CCOIcons.coordinate = { x: 0, y: 0 };
            currentFrame.scan(0, 0, currentFrame.bitmap.width, currentFrame.bitmap.height, function (x, y, idx) {
                if (this.bitmap.data[idx + 3] > 0 && y == currentMouthStartPosition.y) {
                    if (onMouth == true) {
                        currentMouthSize++;
                    } else {
                        onMouth = true;
                        currentMouthStartPosition = { x, y };
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
        let headFrames = await getCubeIconPart(cubeID, cubeSeed, "heads");
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

    const useCubeIcon = showCubeIcon || shownPrefixes.find(prefix => prefixHasTag(prefix, "appliesDirectlyAfterAllPrefixes") || prefixHasTag(prefix, "maskOnly"));

    let allPrefixFrames: CCOIcons.compiledPrefixFrames[] = [];

    async function compilePrefixFrames(masks: boolean, sizeOverride?: { width: number, height: number }) {
        for (let shownPrefixIndex = 0; shownPrefixIndex < shownPrefixes.length; shownPrefixIndex++) {
            const compilingPrefixID = shownPrefixes[shownPrefixIndex];
            if (!prefixHasTag(compilingPrefixID, "appliesDirectlyAfterAllPrefixes")) {
                if (prefixHasTag(compilingPrefixID, "maskOnly") === masks) {
                    if (sizeOverride) {
                        allPrefixFrames.push(await prefixes[compilingPrefixID].compileFrames(retrievedParts, iconFrames.map(frame => frame.clone().resize(sizeOverride.width, sizeOverride.height, Jimp.RESIZE_NEAREST_NEIGHBOR)), prefixSeed, cubes[cubeID], shownPrefixes));
                    } else {
                        allPrefixFrames.push(await prefixes[compilingPrefixID].compileFrames(retrievedParts, iconFrames.map(frame => frame.clone()), prefixSeed, cubes[cubeID], shownPrefixes));
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
        console.log("##### An animation in this icon isn't a multiple of 5!", animationLengths);
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

        let frameModifiers: {
            [key in ("front" | "back" | "icon")]: {
                mods: CCOIcons.JimpImgMod[],
                origin: CCOIcons.prefixID
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
            if (compiledPrefixFrames.frameModifiers.length > 0) {
                const frameModifierIndex = newIconIndex % compiledPrefixFrames.frameModifiers.length;
                const modifiersOnFrame = compiledPrefixFrames.frameModifiers[frameModifierIndex];
                modifiersOnFrame.forEach(modsOnFrame => {
                    modsOnFrame.layers.forEach(layerKey => {
                        frameModifiers[layerKey].push({
                            mods: modsOnFrame.modifiers,
                            origin: compiledPrefixFrames.sourceID
                        })
                    })
                })
            }
        })

        allPrefixFrames.forEach((compiledPrefixFrames) => {
            if (compiledPrefixFrames.backFrames.length > 0) {
                const backIndex = newIconIndex % compiledPrefixFrames.backFrames.length;
                const backFrame = compiledPrefixFrames.backFrames[backIndex];
                const outlinePadding = frameOutlines.back.reduce((prev, curr) => { return prev + ((curr.origin === compiledPrefixFrames.sourceID) ? 0 : curr.width) }, 0);
                backFrame.forEach(partOfFrame => {
                    let strokedBackFrame = partOfFrame.image;
                    let paddingOffset = 0;
                    frameOutlines.back.forEach(outline => {
                        if (outline.origin !== compiledPrefixFrames.sourceID) {
                            if (!partOfFrame.preventOutline) {
                                strokedBackFrame = strokeImage(strokedBackFrame, outline.color, outline.width, false, outline.matrix);
                            } else {
                                paddingOffset += outline.width;
                            }
                        }
                    });
                    frameModifiers.back.forEach(modifier => {
                        if (modifier.origin) {
                            strokedBackFrame.color(modifier.mods);
                        }
                    });
                    newFrame.composite(strokedBackFrame, paddingValues.left + partOfFrame.compositePosition.x - outlinePadding + paddingOffset, paddingValues.above + partOfFrame.compositePosition.y - outlinePadding + paddingOffset)
                })
            }
        })

        // Composite the icon in the 'center layer'
        if (useCubeIcon || frameOutlines.icon.length > 0) {
            let strokedIconFrame = iconFrames[oldIconIndex];
            const outlinePadding = frameOutlines.icon.reduce((prev, curr) => { return prev + curr.width }, 0);
            frameModifiers.icon.forEach(modifier => {
                if (modifier.origin) {
                    strokedIconFrame.color(modifier.mods);
                }
            });
            frameOutlines.icon.forEach(outline => {
                strokedIconFrame = strokeImage(strokedIconFrame, outline.color, outline.width, false, outline.matrix);
            });
            newFrame.composite(strokedIconFrame, paddingValues.left - outlinePadding, paddingValues.above - outlinePadding);
        }

        allPrefixFrames.forEach(compiledPrefixFrames => {
            if (compiledPrefixFrames.frontFrames.length > 0) {
                const frontIndex = newIconIndex % compiledPrefixFrames.frontFrames.length;
                const frontFrame = compiledPrefixFrames.frontFrames[frontIndex];
                const outlinePadding = frameOutlines.front.reduce((prev, curr) => { return prev + ((curr.origin === compiledPrefixFrames.sourceID) ? 0 : curr.width) }, 0);
                frontFrame.forEach(partOfFrame => {
                    let strokedFrontFrame = partOfFrame.image;
                    let paddingOffset = 0;
                    frameOutlines.front.forEach(outline => {
                        if (outline.origin !== compiledPrefixFrames.sourceID) {
                            if (!partOfFrame.preventOutline) {
                                strokedFrontFrame = strokeImage(strokedFrontFrame, outline.color, outline.width, false, outline.matrix);
                            } else {
                                paddingOffset += outline.width;
                            }
                        }
                    });
                    frameModifiers.front.forEach(modifier => {
                        if (modifier.origin) {
                            strokedFrontFrame.color(modifier.mods);
                        }
                    });
                    newFrame.composite(strokedFrontFrame, paddingValues.left + partOfFrame.compositePosition.x - outlinePadding + paddingOffset, paddingValues.above + partOfFrame.compositePosition.y - outlinePadding + paddingOffset)
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

        newAnimation.push(newFrame);
    }

    for (let shownPrefixIndex = 0; shownPrefixIndex < shownPrefixes.length; shownPrefixIndex++) {
        const compilingPrefixID = shownPrefixes[shownPrefixIndex];
        if (prefixHasTag(compilingPrefixID, "appliesDirectlyAfterAllPrefixes") === true) {
            newAnimation = (await prefixes[compilingPrefixID].compileFrames(retrievedParts, newAnimation, prefixSeed, cubes[cubeID], shownPrefixes)).maskFrames;
        }
    }

    return newAnimation;
}

const conwayGenerations = 30;
const conwayLivingChance = 0.2;
const customSeededCubes: { [key in CCOIcons.patternedCubeID]?: {
    [key in (CCOIcons.cubeAnchorPoints | "base")]: ((seed: number) => Promise<string>) | string
} } = {
    "conway": {
        heads: `${config.sourceImagesDirectory}/seededcubetextures/conway/heads.png`,
        eyes: `${config.sourceImagesDirectory}/seededcubetextures/conway/eyes.png`,
        mouths: `${config.sourceImagesDirectory}/seededcubetextures/conway/mouths.png`,
        accents: async (seed: number) => {
            const outputFrames: Jimp[] = [];
            const outputPath = `${config.relativeRootDirectory}/ccicons/`
            const conwayMask = await Jimp.read(`${config.sourceImagesDirectory}/seededcubetextures/conway/mask.png`);
            const GoLRNG = new seedrandom(`conway${seed}`);

            const livingColor = 0xffffffff;
            const deadColor = 0x00000000;

            // Run RNG function 2x to simulate generating the hue/brightness change
            GoLRNG(); 
            GoLRNG();

            const startingFrame = new Jimp(conwayMask.bitmap.width, conwayMask.bitmap.height, deadColor);
            startingFrame.scan(0, 0, startingFrame.bitmap.width, startingFrame.bitmap.height, function (x, y, idx) {
                if (GoLRNG() < conwayLivingChance) startingFrame.setPixelColor(livingColor, x, y);
            })

            for (let generationIndex = 0; generationIndex < conwayGenerations; generationIndex++) {
                const previousFrame = outputFrames[generationIndex - 1] ?? startingFrame;
                const product = performConwaySimulation(previousFrame, livingColor, deadColor).mask(conwayMask, 0, 0);
                outputFrames.splice(generationIndex, 0, ...[product, product]);
            }

            await saveAnimatedCubeIcon(outputFrames, `conwayaccents${seed}`, outputPath, config.getCubeAnimationDelay('conway'));
            return `${outputPath}/conwayaccents${seed}.png`;
        },
        base: async (seed: number) => {
            const outputFrames: Jimp[] = [];
            const outputPath = `${config.relativeRootDirectory}/ccicons/`
            const conwayMask = await Jimp.read(`${config.sourceImagesDirectory}/seededcubetextures/conway/mask.png`);
            const conwayOverlay = await Jimp.read(`${config.sourceImagesDirectory}/seededcubetextures/conway/overlay.png`);
            const GoLRNG = new seedrandom(`conway${seed}`);

            const livingPixel = new Jimp(1, 1, 0x000000ff).color([
                {
                    apply: "green",
                    params: [(100 * GoLRNG()) + 155]
                },
                {
                    apply: "hue",
                    params: [360 * GoLRNG()]
                }
            ]);
            const livingColor = livingPixel.getPixelColor(0, 0);
            const shadowColor = livingPixel.clone().color([{ apply: "darken", params: [15] }]).getPixelColor(0, 0);
            const deadColor = livingPixel.clone().color([{ apply: "darken", params: [25] }]).getPixelColor(0, 0);

            const startingFrame = new Jimp(conwayMask.bitmap.width, conwayMask.bitmap.height, deadColor);
            startingFrame.scan(0, 0, startingFrame.bitmap.width, startingFrame.bitmap.height, function (x, y, idx) {
                if (GoLRNG() < conwayLivingChance) startingFrame.setPixelColor(livingColor, x, y);
            })

            for (let generationIndex = 0; generationIndex < conwayGenerations; generationIndex++) {
                const previousFrame = outputFrames[generationIndex - 1] ?? startingFrame;
                const product = performConwaySimulation(previousFrame, livingColor, deadColor, shadowColor).mask(conwayMask, 0, 0);
                outputFrames.splice(generationIndex, 0, ...[product, product]);
            }
            outputFrames.forEach(frame => frame.composite(conwayOverlay, 0, 0));

            await saveAnimatedCubeIcon(outputFrames, `conway${seed}`, outputPath, config.getCubeAnimationDelay('conway'));
            return `${outputPath}/conway${seed}.png`;
        }
    }
};

function performConwaySimulation(previousFrame: Jimp, aliveColor: number, deadColor: number, shadowColor: number | false = false) {
    const newFrame = new Jimp(previousFrame.bitmap.width, previousFrame.bitmap.height, deadColor);
    newFrame.scan(0, 0, newFrame.bitmap.width, newFrame.bitmap.height, function (x, y, idx) {
        let neighborCount = 0;
        const wasAlive = previousFrame.getPixelColor(x, y) === aliveColor;
        if (previousFrame.getPixelColor(x - 1, y - 1) === aliveColor) neighborCount++;
        if (previousFrame.getPixelColor(x, y - 1) === aliveColor) neighborCount++;
        if (previousFrame.getPixelColor(x + 1, y - 1) === aliveColor) neighborCount++;

        if (previousFrame.getPixelColor(x - 1, y) === aliveColor) neighborCount++;
        if (previousFrame.getPixelColor(x + 1, y) === aliveColor) neighborCount++;

        if (previousFrame.getPixelColor(x - 1, y + 1) === aliveColor) neighborCount++;
        if (previousFrame.getPixelColor(x, y + 1) === aliveColor) neighborCount++;
        if (previousFrame.getPixelColor(x + 1, y + 1) === aliveColor) neighborCount++;

        if (neighborCount < 2) {
            // Cell is dead, underpopulated.
        } else if ((neighborCount === 2 || neighborCount === 3) && wasAlive) {
            newFrame.setPixelColor(aliveColor, x, y);
            if (y !== newFrame.bitmap.height - 1 && shadowColor !== false) newFrame.setPixelColor(shadowColor, x, y + 1);
        } else if (neighborCount < 3) {
            // Cell is dead, overpopulated.
        } else if (neighborCount === 3 && !wasAlive) {
            newFrame.setPixelColor(aliveColor, x, y);
            if (y !== newFrame.bitmap.height - 1 && shadowColor !== false) newFrame.setPixelColor(shadowColor, x, y + 1);
        }
    })
    return newFrame;
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
                if (!fs.existsSync(outcomeFile) || !config.useBaseCubeCache) {
                    let badassFrameCount = 60;
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
                            allBadassFrames.push(newCubeFrame[Math.floor(newCubeFrame.length * badassRNG())].resize(32, 32, Jimp.RESIZE_NEAREST_NEIGHBOR));
                        }
                    }
                    await saveAnimatedCubeIcon(allBadassFrames, `badass`, outcomePath, config.getCubeAnimationDelay(modifyingID));
                }
            } else if (patternedCubeIDs.find(patternedCubeID => patternedCubeID === modifyingID) !== undefined) {
                const cubeSeed = data.seed;
                // Create the outcome path of the file
                fileNameOverride = `${modifyingID}${cubeSeed}.png`;
                const outcomeFile = `${outcomePath}/${fileNameOverride}`;
                if (!fs.existsSync(outcomeFile) || !config.useBaseCubeCache) {
                    let iconFile = await getSeededCubeIconType(modifyingID as CCOIcons.patternedCubeID, cubeSeed, "base");
                    await saveAnimatedCubeIcon(iconFile, fileNameOverride, `${outcomePath}/`, config.getCubeAnimationDelay(modifyingID));
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
        modificationFunction: async function (modifyingPath, modifyingID, fileName, data: { algorithm: "V1" | "V2" }) {
            const originalImagePath = path.resolve(`${config.relativeRootDirectory}${modifyingPath.join('')}${fileName}`);
            const newImagePath = path.resolve(`${config.relativeRootDirectory}${modifyingPath.join('')}/bside`);
            if (!fs.existsSync(newImagePath)) fs.mkdirSync(newImagePath, { recursive: true });
            const newIconPath = path.resolve(`${newImagePath}/${fileName}`);
            if (!fs.existsSync(newIconPath) || !config.useBSideCache) {
                let iconFrames = await loadAnimatedCubeIcon(originalImagePath);
                if (iconFrames.length > config.bSideAnimationLimit) {
                    iconFrames = iconFrames.slice(0, config.bSideAnimationLimit);
                }
                for (let frameIndex = 0; frameIndex < iconFrames.length; frameIndex++) {
                    if (data.algorithm === "V1") {
                        iconFrames[frameIndex] = await createBSideImage(iconFrames[frameIndex]);
                    } else {
                        iconFrames[frameIndex] = await createBSideV2Image(iconFrames[frameIndex]);
                    }
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
                        newFrame.composite(tallyNumberImage, 0, newFrame.bitmap.height - tallyNumberImage.bitmap.height - 1);
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
                const newAnimation = await generatePrefixedCube(await loadAnimatedCubeIcon(originalImagePath), modifyingID, validatedPrefixData.shownPrefixes, data.prefixSeed, data.cubeSeed, true);

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
            if (Number.isNaN(data.size) || data.size > config.resizeMax || data.size < config.resizeMin || (Math.log(data.size) / Math.log(2)) % 1 !== 0) return { directoryAddition: '' };

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
    },
    flip: {
        directory: '/flipped',
        modificationFunction: async function (modifyingPath, modifyingID, fileName, data: { flipX: boolean, flipY: boolean }) {

            // Get the path of the output of the previous modification
            const originalImagePath = path.resolve(`${config.relativeRootDirectory}${modifyingPath.join('')}${fileName}`);
            const flipDirectory = `/flip/`;

            // Create the directory path of the outcome of this modification
            const outcomeDirectory = path.resolve(`${config.relativeRootDirectory}${modifyingPath.join('')}${flipDirectory}`);

            // Create the outcome path of the file
            const outcomeFile = `${outcomeDirectory}/${fileName}`;

            // If the path to the directory doesn't exist, create it.
            if (!fs.pathExistsSync(outcomeDirectory)) fs.mkdirSync(outcomeDirectory, { recursive: true });

            // If the icon hasn't been generated yet, then generate it (in this case, it's simply reading the original image then resizing it.)
            if (!fs.existsSync(outcomeFile)) {
                // Read the original icon
                let iconFrames = await loadAnimatedCubeIcon(originalImagePath);

                for (let frameIndex = 0; frameIndex < iconFrames.length; frameIndex++) {
                    iconFrames[frameIndex].flip(data.flipX, data.flipY);
                }

                // Write the icon
                await saveAnimatedCubeIcon(iconFrames, fileName, outcomeDirectory, config.getCubeAnimationDelay(modifyingID));
            }

            // Return the directory to add to the icon generation function.
            return {
                directoryAddition: flipDirectory
            };
        }
    }
} satisfies {
    [key: string]: {
        directory: string,
        modificationFunction: (modifyingPath: string[], modifyingID: CCOIcons.cubeID, modifyingFileName: `${string}.png`, data: any) => Promise<{ directoryAddition: string, newFileName?: string }>
    }
}

interface cubeIconGenerationParameters {
    bSide: {
        use: boolean,
        data: {
            algorithm: "V1" | "V2"
        }
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
        if (config.devmode) console.log(`B-Side (${iconAttributes.bSide.data.algorithm}) took ${performance.now() - beforeBSide}ms.`);
    }

    if (iconAttributes.size !== undefined && iconAttributes.size.use === true) {
        let newBeforeResize = performance.now();
        imageDirectories.push((await iconModifiers.size.modificationFunction(imageDirectories, cubeID, fileName, iconAttributes.size.data)).directoryAddition);
        if (config.devmode) console.log('Resize took '+(performance.now() - newBeforeResize)+ 'ms.');
    }

    if (!!cubes[cubeID].flipY || !!cubes[cubeID].flipX) {
        let beforeFlipY = performance.now();
        imageDirectories.push((await iconModifiers.flip.modificationFunction(imageDirectories, cubeID, fileName, { flipX: cubes[cubeID]?.flipX === true, flipY: cubes[cubeID]?.flipY === true })).directoryAddition);
        if (config.devmode) console.log('Flipping took ' + (performance.now() - beforeFlipY) + 'ms.');
    }

    if (!returnSpriteSheet && fs.existsSync(`${config.relativeRootDirectory}${imageDirectories.join('')}${fileName.replace('.png', '.gif')}`)) {
        // @ts-ignore An override for a .gif, should be OK... probably
        fileName = fileName.replace('.png', '.gif');
    }

    return path.resolve(`${config.relativeRootDirectory}${imageDirectories.join('')}${fileName}`);
}

export {
    getSeededIconRNGValues,
    getPatternedIconAndPartDirectory,
    getSeededCubeIconType,
    getCubeIconPart,
    generateAndValidatePrefixDirectory,
    generatePrefixedCube,
    customSeededCubes,
    type cubeIconGenerationParameters,
    generateCubeIcon
}