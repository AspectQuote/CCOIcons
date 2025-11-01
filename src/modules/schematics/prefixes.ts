import * as CCOIcons from './../../typedefs';
import * as config from './config';
import * as path from 'path';
import * as fs from 'fs-extra';
import Jimp from 'jimp';
import * as maths from '../maths';
import { fillHollowRect, fillRect, generateSmallWordImage, loadAnimatedCubeIcon, parseHorizontalSpriteSheet, saveAnimatedCubeIcon, strokeImage } from '../imageutils';
let seedrandom: new (seed: string) => () => number = require('seedrandom');

/**
 * Get the padding needed for each prefix to be displayed on the image.
 * @param frames An array of all the compiled frames from each prefix
 * @param baseWidth How wide the base icon is
 * @param baseHeight How tall the base icon is
 * @returns How much padding needs to be added to all sides of the icon to make sure each prefix has space to be composited on the image.
 */
function getNeededPaddingFromCompiledFrames(frames: CCOIcons.compiledPrefixFrames[], baseWidth: number, baseHeight: number): {above: number, right: number, below: number, left: number} {
    
    // Store the resizes needed in an aux variable; will be returned later.
    let resizeTarget = {
        above: 0,
        below: 0,
        left: 0,
        right: 0
    };

    const strokeOffset = frames.reduce((prev: number, curr) => {
        return prev + (curr.outlineFrames.reduce((prev: number, curr) => {
            return curr.reduce((previous, current) => {
                return current.width
            }, 0);
        }, 0))
    }, 0);

    // Compile all of the composite positions' top-leftmost needed pixels into an array
    let allBasePositions = frames.reduce((prev: CCOIcons.coordinate[], curr) => {
        return prev.concat(...curr.frontFrames.map(frameDataArray => {
            return frameDataArray.map(frameData => {
                return {
                    x: frameData.compositePosition.x - strokeOffset,
                    y: frameData.compositePosition.y - strokeOffset
                }
            })
        })).concat(...curr.backFrames.map(frameDataArray => {
            return frameDataArray.map(frameData => {
                return {
                    x: frameData.compositePosition.x - strokeOffset,
                    y: frameData.compositePosition.y - strokeOffset
                }
            })
        }))
    }, []);

    // Compile all of the composite positions' bottom-rightmost needed pixels into an array
    let allOffsetPositions = frames.reduce((prev: CCOIcons.coordinate[], curr) => {
        return prev.concat(...curr.frontFrames.map(frameDataArray => {
            return frameDataArray.map(frameData => {
                return {
                    x: frameData.compositePosition.x + frameData.image.bitmap.width + strokeOffset,
                    y: frameData.compositePosition.y + frameData.image.bitmap.height + strokeOffset
                }
            })
        })).concat(...curr.backFrames.map(frameDataArray => {
            return frameDataArray.map(frameData => {
                return {
                    x: frameData.compositePosition.x + frameData.image.bitmap.width + strokeOffset,
                    y: frameData.compositePosition.y + frameData.image.bitmap.height + strokeOffset
                }
            })
        }))
    }, []);

    // Use the lowest X and Y positions to determine how much padding is needed above and to the left
    let minXPosition = Math.min(...allBasePositions.map(coord => coord.x));
    let minYPosition = Math.min(...allBasePositions.map(coord => coord.y));
    
    // Use the highest X and Y positions to determine how much padding is needed below and to the right
    let maxXPosition = Math.max(...allOffsetPositions.map(coord => coord.x));
    let maxYPosition = Math.max(...allOffsetPositions.map(coord => coord.y));

    // If the lowest X position needs to be composited below the origin, then add the needed amount of padding past the origin to accommodate.
    if (minXPosition < 0) {
        resizeTarget.left = Math.abs(minXPosition);
    }

    // If the lowest Y position needs to be composited below the origin, then add the needed amount of padding past the origin to accommodate.
    if (minYPosition < 0) {
        resizeTarget.above = Math.abs(minYPosition);
    }

    // If the highest X position needs to be composited past the width, then add the needed amount of padding past the width to accommodate.
    if (maxXPosition > baseWidth) {
        resizeTarget.right = maxXPosition - baseWidth;
    }

    // If the highest Y position needs to be composited past the height, then add the needed amount of padding past the height to accommodate.
    if (maxYPosition > baseHeight) {
        resizeTarget.below = maxYPosition - baseHeight;
    }

    // console.log("Resize Target: ", resizeTarget)

    // If we are no longer at a 1:1 aspect ratio, then add padding to each side evenly to reach it.
    if ((resizeTarget.left + resizeTarget.right) !== (resizeTarget.above + resizeTarget.below)) {
        let inlineSize = 0;
        let blockSize = 1;
        //                                 These modulus 2's here are to make sure the icon keeps vertical/horizontal padding symmetry
        while (inlineSize !== blockSize || inlineSize % 2 !== baseWidth % 2 || blockSize % 2 !== baseHeight % 2) {
            if (inlineSize < blockSize) {
                if (resizeTarget.left <= resizeTarget.right) {
                    resizeTarget.left++;
                } else {
                    resizeTarget.right++;
                }
            } else {
                if (resizeTarget.above <= resizeTarget.below) {
                    resizeTarget.above++;
                } else {
                    resizeTarget.below++;
                }
            }
            inlineSize = resizeTarget.left + resizeTarget.right;
            blockSize = resizeTarget.above + resizeTarget.below;
        }
    }

    return resizeTarget;
}

/**
 * Get a prefix animation resized, usually used to scale prefix images to smaller cubes or body parts.
 * @param targetWidth The desired width of the prefix icon
 * @param targetHeight The desired height of the prefix icon
 * @param cachePath The folder where the cached icon is stored, or should be saved to when  it is generated
 * @param originalAnimation The animation that needs to be resized
 * @param performCaching Whether or not to cache the resized prefix animation
 * @returns The resized prefix animation frames
 */
async function getResizedPrefixAnimation(targetWidth: number, targetHeight: number, cachePath: string, originalAnimation: Jimp[], performCaching: boolean = true): Promise<Jimp[]> {
    let targetFilePath = `${cachePath}/`;
    let targetFileName = `${targetWidth}x${targetHeight}.png`;

    // If we don't already have an image cached at this path, then we create it and save it at that path.
    if (!fs.existsSync(`${targetFilePath}${targetFileName}`) || !performCaching || !config.usePrefixImageCache) {
        let newAnimation: Jimp[] = [];
        for (let originalAnimationFrameIndex = 0; originalAnimationFrameIndex < originalAnimation.length; originalAnimationFrameIndex++) {
            const originalAnimationFrame = originalAnimation[originalAnimationFrameIndex];
            newAnimation.push(originalAnimationFrame.clone());
            if (targetWidth !== originalAnimationFrame.bitmap.width || targetHeight !== originalAnimationFrame.bitmap.height) {
                newAnimation[newAnimation.length - 1].resize(targetWidth, targetHeight, Jimp.RESIZE_NEAREST_NEIGHBOR);
            }
        }
        if (performCaching) await saveAnimatedCubeIcon(newAnimation, targetFileName, targetFilePath, 10);
        return newAnimation;
    } else {
        // If we do have an image stored at this path, then we can just read it and return that.
        return await loadAnimatedCubeIcon(`${targetFilePath}${targetFileName}`);
    }
}

/**
 * Pastes images bound to the icon heads, this is a specialized aux function because several prefixes are bound to the heads of icons and just need to be pasted on at the proper positions/sizes.
 * @param prefixImage The image to place on each head in the frame
 * @param cachePath The path where the image should be retrieved or cached to if it needs to be resized
 * @param allHeads All the heads in the animation frame
 * @param targetedHeadData What the image is built for, this is the X, Y, and width of the head which was used as a reference for the prefix
 * @param performCaching Whether or not to cache resized heads
 * @returns A single compiled prefix frame layer
 */
async function compileHeadsForFrame(prefixImage: Jimp, cachePath: string, allHeads: CCOIcons.anchorPointSchema["heads"][number], targetedHeadData: { x: number, y: number, width: number }, performCaching: boolean = true): Promise<CCOIcons.compiledPrefixFrames["frontFrames"][number]> {
    let returnArray: CCOIcons.compiledPrefixFrames["frontFrames"][number] = [];
    for (let frameHeadIndex = 0; frameHeadIndex < allHeads.positions.length; frameHeadIndex++) {
        const head = allHeads.positions[frameHeadIndex];

        const headSizeResizeFactor = head.width / targetedHeadData.width;
        let headFrameImage = new Jimp(1, 1, 0x000000ff);

        let targetWidth = Math.ceil(prefixImage.bitmap.width * headSizeResizeFactor);
        let targetHeight = Math.ceil(prefixImage.bitmap.height * headSizeResizeFactor);
        headFrameImage = (await getResizedPrefixAnimation(targetWidth, targetHeight, cachePath, [prefixImage], performCaching))[0];

        const compositePosition = {
            x: head.startPosition.x - Math.ceil((targetedHeadData.x / prefixImage.bitmap.width) * headFrameImage.bitmap.width),
            y: head.startPosition.y - Math.ceil((targetedHeadData.y / prefixImage.bitmap.height) * headFrameImage.bitmap.height)
        }
        returnArray.push({
            image: headFrameImage,
            compositePosition
        })
    }
    return returnArray
}

/**
 * Pastes images bound to the icon mouths, this is a specialized aux function because several prefixes are bound to the mouths of icons and just need to be pasted on at the proper positions/sizes.
 * @param prefixImage The image to place on each mouth in the frame
 * @param cachePath The path where the image should be retrieved or cached if it needs to be resized
 * @param allMouths All the mouths in the animation frame
 * @param targetedMouthData What the iamge is built for, this is the X, Y, and width of the mouth which was used as a reference for the prefix.
 * @param performCaching Whether or not to cache resized mouths
 * @returns A single compiled prefix frame layer
 * 
 * @note This just calls {@link compileHeadsForFrame} because the mouths and heads share the same data scheme, however this is declared separately just in case I need to change the scheme of the mouths or heads.
 */
async function compileMouthsForFrame(prefixImage: Jimp, cachePath: string, allMouths: CCOIcons.anchorPointSchema["mouths"][number], targetedMouthData: { x: number, y: number, width: number }, performCaching: boolean = true): Promise<CCOIcons.compiledPrefixFrames["frontFrames"][number]> {
    return await compileHeadsForFrame(prefixImage, cachePath, allMouths, targetedMouthData, performCaching);
}

/**
 * Pastes images bound to the icon eyes, this is a specialized aux function because several prefixes are bound to the eyes of icons and just need to be pasted on at the proper positions. No resizing like the mouths or heads because eyes are always just 1x1 pixels
 * @param prefixImage Image to paste on each eye in the frame
 * @param allEyes Each eye in the frame
 * @returns A single compiled prefix frame layer
 */
async function compileEyesForFrame(prefixImage: Jimp, allEyes: CCOIcons.anchorPointSchema["eyes"][number]): Promise<CCOIcons.compiledPrefixFrames["frontFrames"][number]> {
    let returnArray: CCOIcons.compiledPrefixFrames["frontFrames"][number] = [];
    for (let frameEyePositionIndex = 0; frameEyePositionIndex < allEyes.coordinates.length; frameEyePositionIndex++) {
        const eye = allEyes.coordinates[frameEyePositionIndex];
        returnArray.push({
            image: prefixImage.clone(),
            compositePosition: {
                x: eye.x - Math.floor(prefixImage.bitmap.width / 2),
                y: eye.y - Math.floor(prefixImage.bitmap.height / 2),
            }
        })
    }
    return returnArray
}

/**
 * Check for a tag on a prefix
 * - NOTE: I would have just used an Array.includes() statement inline whenever I needed to check for a tag, but TypeScript thinks never[] is a possible error with Array.includes() (it's not)
 * @param prefixID ID of any prefix
 * @param tag The tag to check the prefix for
 * @returns true/false whether the prefix has that tag
 */
function prefixHasTag(prefixID: CCOIcons.prefixID, tag: CCOIcons.prefixTags): boolean {
    return (prefixes[prefixID].tags as CCOIcons.prefixTags[]).includes(tag);
}

/**
 * Brute-Force generate distanced positions
 * @param maxPositions The number of positions the function needs to generate
 * @param minDistance The minimum distance between each position
 * @param seedGen A function that returns a random number
 */
function generateSparsePositions(maxPositions: number, minDistance: number, seedGen: () => number, fieldSize: {width: number, height: number}): CCOIcons.coordinate[] {
    let coordArray: CCOIcons.coordinate[] = [];

    let failsafe = 0;
    let currentCoordinateIndex = 0;
    const failsafeMax = 9;
    while (coordArray.length < maxPositions && failsafe < failsafeMax) {
        const newPositionRotation = 6.28319 * seedGen(); // Magic Number here is 360 degrees in radians.
        const newPositionDistance = minDistance + (minDistance * seedGen());
        const currentPosition = {
            x: coordArray[currentCoordinateIndex]?.x ?? Math.round(fieldSize.width/2),
            y: coordArray[currentCoordinateIndex]?.y ?? Math.round(fieldSize.height/2)
        }
        const newPosition: CCOIcons.coordinate = {
            x: currentPosition.x + (Math.cos(newPositionRotation) * newPositionDistance),
            y: currentPosition.y + (Math.sin(newPositionRotation) * newPositionDistance)
        }
        failsafe++;
        if (newPosition.x < fieldSize.width && newPosition.y < fieldSize.height && newPosition.x > 0 && newPosition.y > 0 && !coordArray.find(coordinate => maths.distanceBetweenPoints(coordinate, newPosition) < minDistance)) {
            coordArray.splice(currentCoordinateIndex, 0, newPosition);
            currentCoordinateIndex++;
        } else if (failsafe === failsafeMax && currentCoordinateIndex > 0) {
            failsafe = 0;
            currentCoordinateIndex--;
        }
    }

    if (failsafe == failsafeMax) {
        console.log("---- Failsafe hit :(")
    }

    console.log(coordArray)
    return coordArray;
}

type animationKeyFrame = {
    x: number,
    y: number,
    layer: "front" | "back"
}

/**
 * Generate interpolated keyframes for an animation
 * @param desiredFrameCount How many frames to get for this animation
 * @param keyFrames The keyframes to interpolate
 * @param speed How fast the animation should be. This should only ever be 1, 2, -1 or -2.
 * @param extraStartingPercent A number from 0-100 determining which part of the animation should be the starting point.
 * @returns An array of the interpolated keyframes, the length is equal to the passed {@link desiredFrameCount}
 */
function generateInterpolatedFramesFromKeyFrames(desiredFrameCount: number, keyFrames: animationKeyFrame[], speed: number, extraStartingPercent: number = 0): animationKeyFrame[] {
    let generatedCoordinates: animationKeyFrame[] = [];
    const keyFrameStepThereshold = 1 / keyFrames.length;
    for (let animationFrameIndex = 0; animationFrameIndex < desiredFrameCount; animationFrameIndex++) {
        // The next 3 lines are to calculate frame progress on-the-fly becasuse I don't know how to do differentials
        let currentKeyFramePercentage = ((animationFrameIndex * speed) / desiredFrameCount) + (extraStartingPercent / 100);
        if (currentKeyFramePercentage < 0) currentKeyFramePercentage = 1 - (Math.abs(currentKeyFramePercentage) % 1);
        currentKeyFramePercentage = currentKeyFramePercentage % 1;

        const keyFrameProgress = (currentKeyFramePercentage % keyFrameStepThereshold) / keyFrameStepThereshold;
        const previousKeyFrameIndex = Math.floor(currentKeyFramePercentage / keyFrameStepThereshold);

        const nextKeyFrameIndex = (previousKeyFrameIndex + 1) % keyFrames.length
        const previousKeyFrame = keyFrames[previousKeyFrameIndex];
        const nextKeyFrame = keyFrames[nextKeyFrameIndex];

        const interpolatedPosition: animationKeyFrame = {
            x: Math.round((nextKeyFrame.x - previousKeyFrame.x) * keyFrameProgress) + previousKeyFrame.x,
            y: Math.round((nextKeyFrame.y - previousKeyFrame.y) * keyFrameProgress) + previousKeyFrame.y,
            layer: ((previousKeyFrame.layer === "back" || nextKeyFrame.layer === "back") ? "back" : "front")
        };
        generatedCoordinates.push(interpolatedPosition);
    }
    return generatedCoordinates;
}

/**
 * Where prefixes will be sourced from, so I don't have to type this repeatedly whilst programming prefixes
 */
const prefixSourceDirectory = `${config.relativeRootDirectory}/CCOIcons/${config.sourceImagesDirectory}/prefixes`;

/**
 * A dummy return object, this is cloned inside of the prefix functions to ensure type integrity if I need to change how the return structure looks.
 */
const basePrefixReturnObject: CCOIcons.compiledPrefixFrames = {
    frontFrames: [],
    backFrames: [],
    frameModifiers: [],
    outlineFrames: [],
    maskFrames: [],
    sourceID: "Sacred"
};

const prefixes = {
    "noprefix": {
        name: "No Prefix",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "noprefix";
            prefixFrames.frontFrames.push([
                {
                    compositePosition: {
                        x: 0,
                        y: 0
                    },
                    image: await Jimp.read(`${prefixSourceDirectory}/noprefix/noprefix.png`)
                }
            ])

            return prefixFrames;
        }
    },
    "Divine": {
        name: "Divine",
        tags: ["ignoresPrefixCap"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Divine";
            let divineFrames = await loadAnimatedCubeIcon(`${config.relativeRootDirectory}/ccicons/attributespritesheets/${config.divineConfig.iconName}.png`);
            prefixFrames.outlineFrames.push([{width: 1, color: config.divineConfig.color, layers: ["icon"]}])
            let neededIconFrames = maths.leastCommonMultiple(config.divineConfig.frames, iconFrames.length);
            const targetDivineFrameSize = iconFrames[0].bitmap.width * 2;
            if (divineFrames[0].bitmap.width !== targetDivineFrameSize) {
                divineFrames.forEach(divineFrame => {
                    divineFrame.resize(targetDivineFrameSize, targetDivineFrameSize, Jimp.RESIZE_NEAREST_NEIGHBOR);
                })
            }
            const frameCompositePosition = Math.round(divineFrames[0].bitmap.width / 4);
            for (let frameIndex = 0; frameIndex < neededIconFrames; frameIndex++) {
                const divineFrame = divineFrames[frameIndex % divineFrames.length];
                prefixFrames.backFrames.push([
                    {
                        image: divineFrame,
                        compositePosition: {
                            x: -frameCompositePosition,
                            y: -frameCompositePosition
                        }
                    }
                ]);
            }

            return prefixFrames;
        }
    },
    "Slated": {
        name: "Slated",
        tags: ["ignoresPrefixCap"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Slated";
            let slatedFrames = await loadAnimatedCubeIcon(`${config.relativeRootDirectory}/ccicons/attributespritesheets/${config.slatedConfig.iconName}.png`);
            prefixFrames.outlineFrames.push([{ width: 1, color: config.slatedConfig.color, layers: ["icon"] }])
            let neededIconFrames = maths.leastCommonMultiple(config.slatedConfig.frames, iconFrames.length);
            const targetSlatedFrameSize = iconFrames[0].bitmap.width * 2;
            if (slatedFrames[0].bitmap.width !== targetSlatedFrameSize) {
                slatedFrames.forEach(slatedFrame => {
                    slatedFrame.resize(targetSlatedFrameSize, targetSlatedFrameSize, Jimp.RESIZE_NEAREST_NEIGHBOR);
                })
            }
            const frameCompositePosition = Math.round(slatedFrames[0].bitmap.width / 4);
            for (let frameIndex = 0; frameIndex < neededIconFrames; frameIndex++) {
                const slatedFrame = slatedFrames[frameIndex % slatedFrames.length];
                prefixFrames.backFrames.push([
                    {
                        image: slatedFrame,
                        compositePosition: {
                            x: -frameCompositePosition,
                            y: -frameCompositePosition
                        }
                    }
                ]);
            }

            return prefixFrames;
        }
    },
    "Contraband": {
        name: "Contraband",
        tags: ["ignoresPrefixCap"],
        needs: {
            heads: false,
            eyes: false,
            accents: true,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed, cubeData) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Contraband";
            let accentFrames = anchorPoints.accents;
            let patternRNG = new seedrandom(`${cubeData.name}`);

            const contrabandEffectImage = await Jimp.read(`./sourceicons/attributeeffects/contraband.png`);
            const cropX = Math.ceil(patternRNG() * (contrabandEffectImage.bitmap.width - iconFrames[0].bitmap.width));
            const cropY = Math.ceil(patternRNG() * (contrabandEffectImage.bitmap.height - iconFrames[0].bitmap.height));
            contrabandEffectImage.crop(cropX, cropY, iconFrames[0].bitmap.width, iconFrames[0].bitmap.height);

            for (let frameIndex = 0; frameIndex < iconFrames.length; frameIndex++) {
                let contrabandEffectClone = contrabandEffectImage.clone();
                const iconFrame = iconFrames[frameIndex];
                const accentImage = accentFrames[frameIndex % accentFrames.length].image;
                contrabandEffectClone.scan(0, 0, contrabandEffectClone.bitmap.width, contrabandEffectClone.bitmap.height, (x, y) => {
                    if (accentImage.bitmap.data[accentImage.getPixelIndex(x, y) + 3] === 0) {
                        if (accentImage.bitmap.data[accentImage.getPixelIndex(x, Math.max(0, y - 1)) + 3] !== 0 && iconFrame.bitmap.data[iconFrame.getPixelIndex(x, y) + 3] !== 0) {
                            contrabandEffectClone.setPixelColor(0x00000046, x, y);
                        } else {
                            contrabandEffectClone.setPixelColor(0x00000000, x, y);
                        }
                    }
                })
                prefixFrames.frontFrames.push([{
                    image: contrabandEffectClone,
                    compositePosition: {
                        x: 0,
                        y: 0,
                    }
                }]);
            }

            return prefixFrames;
        }
    },
    "Collectors": {
        name: "Collectors",
        tags: ["ignoresPrefixCap"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed, cubeData) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Collectors";

            const collectorsOutlineThickness = 1;
            const collectorsColor = 0x660808ff;
            const collectorsStrokeColor = 0xa50d0dff;
            
            prefixFrames.outlineFrames.push([{
                width: collectorsOutlineThickness,
                color: collectorsColor,
                layers: ['icon'],
                matrix: [
                    [0, 1, 0],
                    [1, 0, 1],
                    [0, 1, 0]
                ]
            }]);

            const cornerSize = Math.ceil(iconFrames[0].bitmap.width * 0.55);
            const baseCollectorsCornerImage = new Jimp(cornerSize, cornerSize, 0x00000000);
            const cornerDistance = Math.ceil(iconFrames[0].bitmap.width * 0.2);
            const cornerOffset = Math.ceil(cornerSize * 0.5)

            fillRect(baseCollectorsCornerImage, 0, 0, cornerSize, 1, collectorsColor);
            fillRect(baseCollectorsCornerImage, 0, 0, 1, cornerSize, collectorsColor);

            const additionalCollectorsStrokeWidth = 1;
            const collectorsCornerImage = strokeImage(baseCollectorsCornerImage, collectorsStrokeColor, additionalCollectorsStrokeWidth, false, [
                [0, 0, 0],
                [0, 0, 1],
                [0, 1, 0]
            ]);

            prefixFrames.frontFrames.push([
                { // Top-Left
                    image: collectorsCornerImage,
                    compositePosition: {
                        x: -cornerDistance - cornerOffset,
                        y: -cornerDistance - cornerOffset
                    }
                },
                { // Top-Right
                    image: collectorsCornerImage.clone().flip(true, false),
                    compositePosition: {
                        x: iconFrames[0].bitmap.width + cornerDistance - cornerOffset,
                        y: -cornerDistance - cornerOffset
                    }
                },
                { // Bottom-Left
                    image: collectorsCornerImage.clone().flip(false, true),
                    compositePosition: {
                        x: -cornerDistance - cornerOffset,
                        y: iconFrames[0].bitmap.height + cornerDistance - cornerOffset
                    }
                },
                { // Bottom-Right
                    image: collectorsCornerImage.clone().flip(true, true),
                    compositePosition: {
                        x: iconFrames[0].bitmap.width + cornerDistance - cornerOffset,
                        y: iconFrames[0].bitmap.height + cornerDistance - cornerOffset
                    }
                }
            ])

            return prefixFrames;
        }
    },
    "Sacred": {
        name: "Sacred",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed, cubeData) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Sacred";

            let sacredHeadImage = await Jimp.read(`${prefixSourceDirectory}/sacred/halo.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/sacred/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(sacredHeadImage, cacheDirectory, frameHeadPosition, {x: 16, y: 35, width: 32});
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Bugged": {
        name: "Bugged",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Bugged";
            const prefixScale = 0.25;
            const targetAnimationSize = Math.floor(iconFrames[0].bitmap.width * (1 + (prefixScale * 2)));
            const compositePosition = Math.floor(iconFrames[0].bitmap.width * (prefixScale));
            const cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/bugged/`);

            const baseAnimation = await loadAnimatedCubeIcon(`${prefixSourceDirectory}/bugged/source.png`);
            const finalAnimation = await getResizedPrefixAnimation(targetAnimationSize, targetAnimationSize, cacheDirectory, baseAnimation);
            
            prefixFrames.frontFrames = finalAnimation.map((frame) => {
                return [
                    {
                        image: frame,
                        compositePosition: {
                            x: -compositePosition,
                            y: -compositePosition
                        }
                    }
                ]
            })

            return prefixFrames;
        }
    },
    "Based": {
        name: "Based",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: true,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let eyePositions = anchorPoints.eyes;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Based";

            let seedGen = new seedrandom(`based${seed}`);
            let iconManipulations: CCOIcons.JimpImgMod[] = [
                {apply: "hue", params: [360 * seedGen()]}
            ];

            let eyeAnimation = await loadAnimatedCubeIcon(`${prefixSourceDirectory}/based/source.png`);
            eyeAnimation.forEach(frame => {
                frame.color(iconManipulations);
            });

            const neededIconFrames = maths.leastCommonMultiple(eyeAnimation.length, iconFrames.length);

            for (let neededIconFrameIndex = 0; neededIconFrameIndex < neededIconFrames; neededIconFrameIndex++) {
                let eyeFrameIndex = neededIconFrameIndex % eyePositions.length;
                let prefixFrameIndex = neededIconFrameIndex % eyeAnimation.length;

                const frameEyePositions = eyePositions[eyeFrameIndex];
                const prefixFrame = eyeAnimation[prefixFrameIndex];

                const eyeImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileEyesForFrame(prefixFrame, frameEyePositions);
                prefixFrames.frontFrames.push(eyeImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Glitchy": {
        name: "Glitchy",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: true,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let accentFrames = anchorPoints.accents;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Glitchy";

            let seedGen = new seedrandom(`glitchy${seed}`);
            const animationFrameCount = 10;
            
            const accentMaskImage = await Jimp.read(`${prefixSourceDirectory}/glitchy/mask.png`);
            const rainingFlavorImages = [
                await Jimp.read(`${prefixSourceDirectory}/glitchy/0.png`),
                await Jimp.read(`${prefixSourceDirectory}/glitchy/1.png`)
            ];
            const maskColor = 0x045610b3;

            const neededIconFrames = maths.leastCommonMultiple(animationFrameCount, iconFrames.length);

            const numberOfBinaryIcons = 4 + Math.round(seedGen() * 4);
            let binaryIcons: {
                iconIndex: number,
                x: number,
                y: number
            }[] = [];

            while (binaryIcons.length < numberOfBinaryIcons) {
                binaryIcons.push({
                    iconIndex: Math.floor(seedGen() * rainingFlavorImages.length),
                    x: Math.floor(seedGen() * iconFrames[0].bitmap.width),
                    y: Math.floor(seedGen() * iconFrames[0].bitmap.height),
                })
            }

            for (let neededIconFrameIndex = 0; neededIconFrameIndex < neededIconFrames; neededIconFrameIndex++) {
                let iconFrameIndex = neededIconFrameIndex % iconFrames.length;
                let prefixFrameIndex = neededIconFrameIndex % animationFrameCount;
                let accentFrameIndex = neededIconFrameIndex % accentFrames.length;

                const iconFrame = iconFrames[iconFrameIndex];

                const prefixFrame = new Jimp(iconFrame.bitmap.width, iconFrame.bitmap.height, maskColor);

                accentFrames[accentFrameIndex].image.scan(0, 0, accentFrames[accentFrameIndex].image.bitmap.width, accentFrames[accentFrameIndex].image.bitmap.height, function(x, y, idx) {
                    prefixFrame.setPixelColor(accentMaskImage.getPixelColor(x % accentMaskImage.bitmap.width, y % accentMaskImage.bitmap.height), x, y)
                });

                const fallingFrame = new Jimp(iconFrame.bitmap.width, iconFrame.bitmap.height, 0x00000000);

                for (let binaryIconIndex = 0; binaryIconIndex < binaryIcons.length; binaryIconIndex++) {
                    const binaryIcon = binaryIcons[binaryIconIndex];
                    const fallOffset = (iconFrame.bitmap.height / animationFrameCount) * prefixFrameIndex;
                    fallingFrame.composite(rainingFlavorImages[binaryIcon.iconIndex], binaryIcon.x, binaryIcon.y + fallOffset);
                    fallingFrame.composite(rainingFlavorImages[binaryIcon.iconIndex], binaryIcon.x, (binaryIcon.y - iconFrame.bitmap.height) + fallOffset);
                }

                prefixFrame.composite(strokeImage(fallingFrame, 0x000000ff, 1), -1, -1);

                prefixFrames.frontFrames.push([
                    {
                        image: prefixFrame.mask(iconFrame, 0, 0),
                        compositePosition: {x: 0, y: 0}
                    }
                ]);
            }

            return prefixFrames;
        }
    },
    "Bushy": {
        name: "Bushy",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: true
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let mouthPositions = anchorPoints.mouths;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Bushy";

            let seedGen = new seedrandom(`bushy${seed}`);
            const beardCount = 6;
            const usedBeard = Math.floor(seedGen() * beardCount);

            let seededBeardImage = await Jimp.read(`${prefixSourceDirectory}/bushy/${usedBeard}.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/bushy${usedBeard}/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let mouthFrameIndex = 0; mouthFrameIndex < mouthPositions.length; mouthFrameIndex++) {
                const frameMouthPosition = mouthPositions[mouthFrameIndex];
                const mouthImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileMouthsForFrame(seededBeardImage, cacheDirectory, frameMouthPosition, { x: 16, y: 27, width: 4 });
                prefixFrames.frontFrames.push(mouthImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Leafy": {
        name: "Leafy",
        tags: ["seeded", "appliesDirectlyAfterAllPrefixes"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Leafy";
            
            let seedGen = new seedrandom(`leafy${seed}`);
            const animationFrameCount = 15; // Yes, there are 16 frames in the animation. However, 16 is not divisible by 5... I'm trying to keep prefix animation frame counts at intervals of 5 to make sure their least common multiple is more manageable.
            const possibleLeafImages = await loadAnimatedCubeIcon(`${prefixSourceDirectory}/leafy/source.png`);
            const targetFrameSize = {
                width: iconFrames[0].bitmap.width,
                height: iconFrames[0].bitmap.height
            }

            const numberOfLeaves = 7 + Math.round(seedGen() * 2);
            let fallingLeaves: {
                iconIndexOffset: number,
                x: number,
                y: number
            }[] = [];

            const possibleRotations = [162, 326, 326, 326, 326, 34, 34, 34, 34, 0, 0, 0, 0, 0, 0, 0, 0];
            const universalHueRotation: CCOIcons.JimpImgMod[] = [{ apply: "hue", params: [possibleRotations[Math.floor(possibleRotations.length * seedGen())]] }];

            while (fallingLeaves.length < numberOfLeaves) {
                fallingLeaves.push({
                    iconIndexOffset: Math.floor(seedGen() * possibleLeafImages.length),
                    x: Math.floor(seedGen() * (targetFrameSize.width - possibleLeafImages[0].bitmap.width)) + possibleLeafImages[0].bitmap.width,
                    y: Math.floor(seedGen() * targetFrameSize.height)
                })
            }

            const neededFrames = maths.leastCommonMultiple(iconFrames.length, animationFrameCount);
            for (let animationFrameIndex = 0; animationFrameIndex < neededFrames; animationFrameIndex++) {
                const newAnimationFrame = new Jimp(targetFrameSize.width, targetFrameSize.height, 0x00000000);
                const iconIndex = animationFrameIndex % iconFrames.length;
                for (let leafIconIndex = 0; leafIconIndex < fallingLeaves.length; leafIconIndex++) {
                    const leafIcon = fallingLeaves[leafIconIndex];
                    const fallOffset = (targetFrameSize.height / neededFrames) * animationFrameIndex;
                    const leafAnimationIndex = (leafIcon.iconIndexOffset + animationFrameIndex) % animationFrameCount;
                    newAnimationFrame.composite(possibleLeafImages[leafAnimationIndex].clone().color(universalHueRotation), leafIcon.x, leafIcon.y + fallOffset);
                    newAnimationFrame.composite(possibleLeafImages[leafAnimationIndex].clone().color(universalHueRotation), leafIcon.x, (leafIcon.y - targetFrameSize.height) + fallOffset);
                }
                prefixFrames.maskFrames.push(iconFrames[iconIndex].clone().composite(newAnimationFrame, Math.floor((iconFrames[0].bitmap.width - targetFrameSize.width) / 2), 0))
                // prefixFrames.frontFrames.push([{
                //         image: newAnimationFrame,
                //         compositePosition: {
                //             x: Math.floor((iconFrames[0].bitmap.width - targetFrameSize.width) / 2),
                //             y: 0
                //         }
                //     }]
                // )
            }
            
            return prefixFrames;
        }
    },
    "Cruel": {
        name: "Cruel",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Cruel";

            let seedGen = new seedrandom(`cruel${seed}`);
            let backImage = await Jimp.read(`${prefixSourceDirectory}/cruel/back.png`);
            let frontImage = await Jimp.read(`${prefixSourceDirectory}/cruel/front.png`);
            const glassesHueRotation: CCOIcons.JimpImgMod[] = [{ apply: "hue", params: [360 * seedGen()] }];
            backImage.color(glassesHueRotation);
            frontImage.color(glassesHueRotation);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/cruel${seed}/`);

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const backHeadImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(backImage, `${cacheDirectory}/back`, frameHeadPosition, { x: 4, y: 8, width: 32 });
                prefixFrames.backFrames.push(backHeadImagesThisFrame);
                const frontHeadImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(frontImage, `${cacheDirectory}/front`, frameHeadPosition, { x: 4, y: 8, width: 32 });
                prefixFrames.frontFrames.push(frontHeadImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Orbital": {
        name: "Orbital",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let seedGen = new seedrandom(`orbital${seed}`);
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Orbital";
            let allPlanets: {
                name: string,
                color: Jimp,
                mask: Jimp,
                shading: Jimp,
                startingPercent: number,
                speed: number,
                generatedKeyFrames: animationKeyFrame[]
            }[] = [];

            const orbitingKeyFrames: animationKeyFrame[] = [
                {
                    x: 7,
                    y: 31,
                    layer: "front"
                },
                {
                    x: 32,
                    y: 42,
                    layer: "front"
                },
                {
                    x: 56,
                    y: 31,
                    layer: "front"
                },
                {
                    x: 32,
                    y: 21,
                    layer: "back"
                }
            ]
            if (seedGen() < 0.25) {
                allPlanets.push({
                    name: "Jupiter",
                    color: await Jimp.read(`${prefixSourceDirectory}/orbital/jupiter/planet.png`),
                    mask: await Jimp.read(`${prefixSourceDirectory}/orbital/jupiter/mask.png`),
                    shading: await Jimp.read(`${prefixSourceDirectory}/orbital/jupiter/shading.png`),
                    startingPercent: seedGen() * 100,
                    speed: ((seedGen() > 0.5) ? 1 : -1) * (1 + ((seedGen() < 0.33) ? 1 : 0)),
                    generatedKeyFrames: []
                })
            }
            if (seedGen() < 0.33) {
                allPlanets.push({
                    name: "Mars",
                    color: await Jimp.read(`${prefixSourceDirectory}/orbital/mars/planet.png`),
                    mask: await Jimp.read(`${prefixSourceDirectory}/orbital/mars/mask.png`),
                    shading: await Jimp.read(`${prefixSourceDirectory}/orbital/mars/shading.png`),
                    startingPercent: seedGen() * 100,
                    speed: ((seedGen() > 0.5) ? 1 : -1) * (1 + ((seedGen() < 0.33) ? 1 : 0)),
                    generatedKeyFrames: []
                })
            }
            if (seedGen() < 0.20) {
                allPlanets.push({
                    name: "Eris",
                    color: await Jimp.read(`${prefixSourceDirectory}/orbital/eris/planet.png`),
                    mask: await Jimp.read(`${prefixSourceDirectory}/orbital/eris/mask.png`),
                    shading: await Jimp.read(`${prefixSourceDirectory}/orbital/eris/shading.png`),
                    startingPercent: seedGen() * 100,
                    speed: ((seedGen() > 0.5) ? 1 : -1) * (1 + ((seedGen() < 0.33) ? 1 : 0)),
                    generatedKeyFrames: []
                })
            }
            if (seedGen() < 0.25 || allPlanets.length === 0) {
                allPlanets.push({
                    name: "Earth",
                    color: await Jimp.read(`${prefixSourceDirectory}/orbital/earth/planet.png`),
                    mask: await Jimp.read(`${prefixSourceDirectory}/orbital/earth/mask.png`),
                    shading: await Jimp.read(`${prefixSourceDirectory}/orbital/earth/shading.png`),
                    startingPercent: seedGen() * 100,
                    speed: ((seedGen() > 0.5) ? 1 : -1) * (1 + ((seedGen() < 0.33) ? 1 : 0)),
                    generatedKeyFrames: []
                })
            }
            // const neededAnimationFrameCount = maths.leastCommonMultipleOfArray(allPlanets.map(planetData => {
            //     return planetData.color.bitmap.width
            // })) * 2;
            const neededAnimationFrameCount = 60;

            allPlanets.forEach((planetData) => {
                planetData.generatedKeyFrames = generateInterpolatedFramesFromKeyFrames(neededAnimationFrameCount, orbitingKeyFrames, planetData.speed, planetData.startingPercent);
            })

            function generatePlanetAnimationFrame(maskImage: Jimp, colorImage: Jimp, shadingImage: Jimp, frameIndex: number): Jimp {
                const generatedImage = new Jimp(maskImage.bitmap.width, maskImage.bitmap.height, 0x00000000);
                const xPosition = (frameIndex % colorImage.bitmap.width);

                if (xPosition > colorImage.bitmap.width - maskImage.bitmap.width) {
                    let neededOffset = colorImage.bitmap.width - xPosition;
                    generatedImage.composite(colorImage.clone(), neededOffset, 0);
                }

                generatedImage.composite(colorImage.clone(), -xPosition, 0);

                generatedImage.mask(maskImage, 0, 0);
                generatedImage.composite(shadingImage, 0, 0);

                return generatedImage;
            }

            const orbitingIntendedDimensions = {
                width: 64,
                height: 64
            }
            const dimensionsConversionRate = {
                x: (iconFrames[0].bitmap.width / orbitingIntendedDimensions.width) * 2,
                y: (iconFrames[0].bitmap.height / orbitingIntendedDimensions.height) * 2
            }

            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrameCount; animationFrameIndex++) {
                let generatedFrame: {
                    front: CCOIcons.compiledPrefixFrames["frontFrames"][number],
                    back: CCOIcons.compiledPrefixFrames["backFrames"][number],
                } = {
                    front: [],
                    back: []
                }
                for (let planetIndex = 0; planetIndex < allPlanets.length; planetIndex++) {
                    const planetData = allPlanets[planetIndex];
                    const currentAnimationFrame = planetData.generatedKeyFrames[animationFrameIndex];
                    const compositePosition = {
                        x: Math.round(planetData.generatedKeyFrames[animationFrameIndex].x * dimensionsConversionRate.x) - (iconFrames[0].bitmap.width/2) - (planetData.mask.bitmap.width/2),
                        y: Math.round(planetData.generatedKeyFrames[animationFrameIndex].y * dimensionsConversionRate.y) - (iconFrames[0].bitmap.height/2) - (planetData.mask.bitmap.height/2)
                    };

                    const planetAnimationFrame = generatePlanetAnimationFrame(planetData.mask, planetData.color, planetData.shading, animationFrameIndex);

                    generatedFrame[currentAnimationFrame.layer].push({
                        compositePosition,
                        image: planetAnimationFrame
                    })
                }

                prefixFrames.frontFrames.push(generatedFrame.front);
                prefixFrames.backFrames.push(generatedFrame.back);
            }

            return prefixFrames;
        }
    },
    "Flaming": {
        name: "Flaming",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Flaming";

            let seedGen = new seedrandom(`flaming${seed}`);
            let flamingFrames = await loadAnimatedCubeIcon(`${prefixSourceDirectory}/flaming/fire.png`);
            let flamingOutlineImage = new Jimp(1, 1, 0xff5722ff);

            let decentFireColors: CCOIcons.JimpImgMod[][] = [
                [
                    {apply: "hue", params: [150]}, // Frost Blue
                    {apply: "lighten", params: [30]}
                ],
                [], // Normal Color
                [], // Normal Color
                [], // Normal Color
                [], // Normal Color
                [
                    { apply: "hue", params: [-138] }, // Dark Purple
                    { apply: "darken", params: [30] }
                ]
            ]
            
            const fireColorIndex = Math.floor(decentFireColors.length * seedGen());

            flamingOutlineImage.color(decentFireColors[fireColorIndex]);

            flamingFrames.forEach(frame => {
                frame.color(decentFireColors[fireColorIndex]);
            })

            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/fire/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });
            // We don't cache this prefix, but we'll make a cache directory just in case we need to in the future

            let neededAnimationFrames = maths.leastCommonMultiple(flamingFrames.length, iconFrames.length);

            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrames; animationFrameIndex++) {
                const flamingFrame = flamingFrames[animationFrameIndex % flamingFrames.length];
                const frameHeadData = headPositions[animationFrameIndex % headPositions.length];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(flamingFrame, cacheDirectory, frameHeadData, { x: 16, y: 38, width: 32 }, false);
                prefixFrames.backFrames.push(headImagesThisFrame);
            }
            prefixFrames.outlineFrames.push([
                {
                    width: 1,
                    color: flamingOutlineImage.getPixelColor(0, 0),
                    layers: ["back", "icon", "front"]
                }
            ])

            return prefixFrames;
        }
    },
    "Foolish": {
        name: "Foolish",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Foolish";

            let jestersHatImage = await Jimp.read(`${prefixSourceDirectory}/foolish/hat.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/foolish/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(jestersHatImage, cacheDirectory, frameHeadPosition, { x: 16, y: 24, width: 32 });
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Cursed": {
        name: "Cursed",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let seedGen = new seedrandom(`cursed${seed}`);
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Cursed";
            const baseImage = await Jimp.read(`${prefixSourceDirectory}/cursed/pentagram.png`);
            baseImage.color([{
                apply: "hue",
                params: [360 * seedGen()]
            }])
            const cursedFrames = 15;
            const frameRotation = 72/cursedFrames;
            const rotationSpeed = ((seedGen() > 0.5) ? 1 : -1) * 1;
            const dummyBackground = new Jimp(iconFrames[0].bitmap.width * 2, iconFrames[0].bitmap.height * 2, 0x00000000);
            
            for (let cursedFrameIndex = 0; cursedFrameIndex < cursedFrames; cursedFrameIndex++) {
                const rotationDegrees = (frameRotation * cursedFrameIndex * rotationSpeed)
                const newFrame = baseImage.clone().rotate(1 + (rotationDegrees), false);
                newFrame.resize(dummyBackground.bitmap.width+1, Math.round(dummyBackground.bitmap.height / 2), Jimp.RESIZE_NEAREST_NEIGHBOR);
                prefixFrames.backFrames.push([{
                    image: dummyBackground.clone().composite(newFrame, 0, Math.floor(dummyBackground.bitmap.height * 0.4)),
                    compositePosition: {
                        x: -Math.round(iconFrames[0].bitmap.width / 2),
                        y: -Math.round(iconFrames[0].bitmap.height / 2)
                    }
                }])
            }

            return prefixFrames;
        }
    },
    "Emburdening": {
        name: "Emburdening",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            const frontLayer = await Jimp.read(`${prefixSourceDirectory}/emburdening/front.png`);
            const backLayer = await Jimp.read(`${prefixSourceDirectory}/emburdening/back.png`);
            const headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Emburdening";

            const frontCacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/emburdening/front/`);
            const backCacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/emburdening/back/`);
            if (!fs.existsSync(frontCacheDirectory)) fs.mkdirSync(frontCacheDirectory, { recursive: true });
            if (!fs.existsSync(backCacheDirectory)) fs.mkdirSync(backCacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const mainStatueImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(frontLayer, frontCacheDirectory, frameHeadPosition, { x: 0, y: 8, width: 32 });
                const statueArmImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(backLayer, backCacheDirectory, frameHeadPosition, { x: 0, y: 8, width: 32 });
                prefixFrames.frontFrames.push(mainStatueImagesThisFrame);
                prefixFrames.backFrames.push(statueArmImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Cuffed": {
        name: "Cuffed",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            const frontLayer = await Jimp.read(`${prefixSourceDirectory}/cuffed/front.png`);
            const backLayer = await Jimp.read(`${prefixSourceDirectory}/cuffed/back.png`);
            const headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Cuffed";

            const frontCacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/cuffed/front/`);
            const backCacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/cuffed/back/`);
            if (!fs.existsSync(frontCacheDirectory)) fs.mkdirSync(frontCacheDirectory, { recursive: true });
            if (!fs.existsSync(backCacheDirectory)) fs.mkdirSync(backCacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const frontOfCuffThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(frontLayer, frontCacheDirectory, frameHeadPosition, { x: 0, y: 21, width: 32 });
                const backOfCuffThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(backLayer, backCacheDirectory, frameHeadPosition, { x: 0, y: 21, width: 32 });
                prefixFrames.frontFrames.push(frontOfCuffThisFrame);
                prefixFrames.backFrames.push(backOfCuffThisFrame);
            }

            return prefixFrames;
        }
    },
    "Endangered": {
        name: "Endangered",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Endangered";
            const swordImage = await Jimp.read(`${prefixSourceDirectory}/endangered/sword.png`);
            const cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/endangered/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            const headPositions = anchorPoints.heads;

            for (let newAnimationIndex = 0; newAnimationIndex < headPositions.length; newAnimationIndex++) {
                const headFrame = headPositions[newAnimationIndex % headPositions.length];
                const swordsThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(swordImage, cacheDirectory, headFrame, { x: 0, y: 104, width: 32 });
                
                prefixFrames.frontFrames.push([...swordsThisFrame]);
            }

            return prefixFrames;
        }
    },
    "Marvelous": {
        name: "Marvelous",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            const frontLayer = await Jimp.read(`${prefixSourceDirectory}/marvelous/front.png`);
            const backLayer = await Jimp.read(`${prefixSourceDirectory}/marvelous/back.png`);
            const headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Marvelous";

            const frontCacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/marvelous/front/`);
            const backCacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/marvelous/back/`);
            if (!fs.existsSync(frontCacheDirectory)) fs.mkdirSync(frontCacheDirectory, { recursive: true });
            if (!fs.existsSync(backCacheDirectory)) fs.mkdirSync(backCacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const frontFingersThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(frontLayer, frontCacheDirectory, frameHeadPosition, { x: 23, y: 3, width: 32 });
                const backPalmsThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(backLayer, backCacheDirectory, frameHeadPosition, { x: 23, y: 3, width: 32 });
                prefixFrames.frontFrames.push(frontFingersThisFrame);
                prefixFrames.backFrames.push(backPalmsThisFrame);
            }

            return prefixFrames;
        }
    },
    "Phasing": {
        name: "Phasing",
        tags: ["seeded", "maskOnly"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed) {
            const phasingFrames = 20;
            let seedGen = new seedrandom(`phasing${seed}`);
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Phasing";
            const frameOffset = phasingFrames * seedGen();

            const animationBounds = (5 + (seedGen() * 10)) * (iconFrames[0].bitmap.width / 32);

            function getAnimationProgress(frameNum: number) {
                const animationOffset = (animationBounds * 2)/phasingFrames;
                if (frameNum > phasingFrames / 2) {
                    frameNum -= phasingFrames;
                }
                return (animationOffset * (frameNum % phasingFrames)) / 10;
            }

            const graphResolution = iconFrames[0].bitmap.height * 2;
            const graphTransform = Math.round(iconFrames[0].bitmap.width/2);

            for (let phasingFrameIndex = 0; phasingFrameIndex < phasingFrames; phasingFrameIndex++) {
                let maskImage = new Jimp(iconFrames[0].bitmap.width, iconFrames[0].bitmap.height, 0x00000000);
                const animationMultiplier = getAnimationProgress(phasingFrameIndex + frameOffset);
                for (let graphXInput = 0; graphXInput < maskImage.bitmap.width*graphResolution; graphXInput++) {
                    const xInput = graphXInput/graphResolution;
                    const yOutput = ((Math.sin((xInput - graphTransform))*Math.tan(animationMultiplier*(xInput - graphTransform)))*animationMultiplier) + graphTransform;
                    maskImage.setPixelColor(0xffffffff, Math.round(xInput), Math.round(yOutput));
                }
                prefixFrames.maskFrames.push(maskImage);
            }

            return prefixFrames;
        }
    },
    "Evanescent": {
        name: "Evanescent",
        tags: ["seeded", "maskOnly"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            const phasingFrames = 20;
            let seedGen = new seedrandom(`evanescent${seed}`);
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Evanescent";
            const frameOffset = phasingFrames * seedGen();

            const animationBounds = (5 + (seedGen() * 10)) * (iconFrames[0].bitmap.height / 32);

            function getAnimationProgress(frameNum: number) {
                const animationOffset = (animationBounds * 2) / phasingFrames;
                if (frameNum > phasingFrames / 2) {
                    frameNum -= phasingFrames;
                }
                return (animationOffset * (frameNum % phasingFrames)) / 10;
            }

            const graphResolution = iconFrames[0].bitmap.height * 2;
            const graphTransform = Math.round(iconFrames[0].bitmap.width / 2);

            for (let evanescentFrameIndex = 0; evanescentFrameIndex < phasingFrames; evanescentFrameIndex++) {
                let maskImage = new Jimp(iconFrames[0].bitmap.width, iconFrames[0].bitmap.height, 0x00000000);
                const animationMultiplier = getAnimationProgress(evanescentFrameIndex + frameOffset);
                for (let graphYInput = 0; graphYInput < maskImage.bitmap.width * graphResolution; graphYInput++) {
                    const yInput = graphYInput / graphResolution;
                    const xOutput = ((Math.sin((yInput - graphTransform)) * Math.tan(animationMultiplier * (yInput - graphTransform))) * animationMultiplier) + graphTransform;
                    maskImage.setPixelColor(0xffffffff, Math.round(xOutput), Math.round(yInput));
                }
                prefixFrames.maskFrames.push(maskImage);
            }

            return prefixFrames;
        }
    },
    "Raving": {
        name: "Raving",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            const ravingFrames = 15;
            let seedGen = new seedrandom(`raving${seed}`);
            const frameOffset = ravingFrames * seedGen();
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Raving";

            for (let ravingFrameIndex = 0; ravingFrameIndex < ravingFrames; ravingFrameIndex++) {
                prefixFrames.frameModifiers.push([
                    {
                        layers: ["front", "icon", "back"],
                        modifiers: [
                            { apply: "hue", params: [(360 / ravingFrames) * (ravingFrameIndex + frameOffset)] },
                            { apply: "darken", params: [10] }
                        ]
                    }
                ])
            }

            return prefixFrames;
        }
    },
    "Royal": {
        name: "Royal",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let seedGen = new seedrandom(`royal${seed}`);
            let crownType = Math.ceil(2*seedGen());
            prefixFrames.sourceID = "Royal";
            const crownImage = await Jimp.read(`${prefixSourceDirectory}/royal/crown${crownType}.png`);
            const crownGemMask = await Jimp.read(`${prefixSourceDirectory}/royal/crown${crownType}gemmasks.png`);
            const crownGems = crownImage.clone().mask(crownGemMask, 0, 0);
            crownGems.color([{
                apply: "hue",
                params: [360 * seedGen()]
            }, {
                apply: "brighten",
                params: [20 * seedGen()]
            }])
            crownImage.composite(crownGems, 0, 0);
            const cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/royal${seed}/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            const headPositions = anchorPoints.heads;

            for (let newAnimationIndex = 0; newAnimationIndex < headPositions.length; newAnimationIndex++) {
                const headFrame = headPositions[newAnimationIndex % headPositions.length];
                const crownsThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(crownImage, cacheDirectory, headFrame, { x: 2, y: 17, width: 32 });

                prefixFrames.frontFrames.push([...crownsThisFrame])
            }

            return prefixFrames;
        }
    },
    "Captain": {
        name: "Captain",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Captain";
            const teamCaptainHatImage = await Jimp.read(`${prefixSourceDirectory}/captain/hat.png`);
            const cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/captain/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            const headPositions = anchorPoints.heads;

            for (let newAnimationIndex = 0; newAnimationIndex < headPositions.length; newAnimationIndex++) {
                const headFrame = headPositions[newAnimationIndex % headPositions.length];
                const hatsThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(teamCaptainHatImage, cacheDirectory, headFrame, { x: 5, y: 13, width: 32 });

                prefixFrames.frontFrames.push([...hatsThisFrame])
            }

            return prefixFrames;
        }
    },
    "Insignificant": {
        name: "Insignificant",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Insignificant";
            const wingsImage = await Jimp.read(`${prefixSourceDirectory}/insignificant/wings.png`);
            const haloImage = await Jimp.read(`${prefixSourceDirectory}/insignificant/halo.png`);
            const haloCacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/insignificant/halo/`);
            if (!fs.existsSync(haloCacheDirectory)) fs.mkdirSync(haloCacheDirectory, { recursive: true });
            const wingsCacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/insignificant/wings/`);
            if (!fs.existsSync(wingsCacheDirectory)) fs.mkdirSync(wingsCacheDirectory, { recursive: true });

            const headPositions = anchorPoints.heads;

            for (let newAnimationIndex = 0; newAnimationIndex < headPositions.length; newAnimationIndex++) {
                const headFrame = headPositions[newAnimationIndex % headPositions.length];
                const halosThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(haloImage, haloCacheDirectory, headFrame, { x: 74, y: 54, width: 32 });
                const wingsThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(wingsImage, wingsCacheDirectory, headFrame, { x: 74, y: 54, width: 32 });

                prefixFrames.frontFrames.push([...halosThisFrame]);
                prefixFrames.backFrames.push([...wingsThisFrame]);
            }

            return prefixFrames;
        }
    },
    "95in'": {
        name: "95in'",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);

            const topLeftBorderColor = 0xc3c3c3ff;
            const topLeftShineColor = 0xffffffff;
            const bottomRightBorderColor = 0x828282ff;
            const baseColor = 0xc3c3c3ff;
            const topBarColor = 0x000082ff;

            const toolBarImage = await Jimp.read(`${prefixSourceDirectory}/95in/toolbar.png`);
            const toolBarNameImage = await Jimp.read(`${prefixSourceDirectory}/95in/toolbarname.png`);

            const windowPadding = 10;

            const shadowDistance = 3;
            const shadowColor = 0xa1a1a1ff;

            let basePrefixFrame = new Jimp(iconFrames[0].bitmap.width + 4 + (windowPadding*2), iconFrames[0].bitmap.width + 4 + (windowPadding*2) + toolBarImage.bitmap.height, baseColor);

            fillRect(basePrefixFrame, 0, 0, basePrefixFrame.bitmap.width, 1, topLeftBorderColor);
            fillRect(basePrefixFrame, 0, 0, 1, basePrefixFrame.bitmap.height, topLeftBorderColor);

            fillRect(basePrefixFrame, 1, 1, basePrefixFrame.bitmap.width - 2, 1, topLeftShineColor);
            fillRect(basePrefixFrame, 1, 1, 1, basePrefixFrame.bitmap.height - 2, topLeftShineColor);

            fillRect(basePrefixFrame, basePrefixFrame.bitmap.width - 1, 1, 1, basePrefixFrame.bitmap.height - 1, bottomRightBorderColor);
            fillRect(basePrefixFrame, 1, basePrefixFrame.bitmap.height - 1, basePrefixFrame.bitmap.width - 1, 1, bottomRightBorderColor);

            fillRect(basePrefixFrame, 4, 4, basePrefixFrame.bitmap.width - 8, 10, topBarColor);
            basePrefixFrame.composite(toolBarNameImage, 4, 4);
            basePrefixFrame.composite(toolBarImage, basePrefixFrame.bitmap.width - 4 - toolBarImage.bitmap.width, 4);

            for (let iconFrameIndex = 0; iconFrameIndex < iconFrames.length; iconFrameIndex++) {
                const iconFrame = iconFrames[iconFrameIndex];

                let newPrefixFrame = basePrefixFrame.clone();

                let frameShadow = new Jimp(iconFrame.bitmap.width, iconFrame.bitmap.height, shadowColor);
                frameShadow.mask(iconFrame, 0, 0);
                frameShadow.scan(0, 0, frameShadow.bitmap.width, frameShadow.bitmap.height, function(x, y, idx) {
                    if (this.bitmap.data[idx + 3] > 0) {
                        this.setPixelColor(shadowColor, x, y);
                    }
                })

                newPrefixFrame.composite(frameShadow, 2 + windowPadding + shadowDistance, 4 + windowPadding + toolBarImage.bitmap.height + shadowDistance)

                prefixFrames.backFrames.push([{
                    image: newPrefixFrame,
                    compositePosition: {
                        x: - 2 - windowPadding,
                        y: - 4 - windowPadding - toolBarImage.bitmap.height
                    }
                }])
            }

            return prefixFrames;
        }
    },
    "Snowy": {
        name: "Snowy",
        tags: ["seeded", "appliesDirectlyAfterAllPrefixes"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Snowy";

            let seedGen = new seedrandom(`snowy${seed}`);
            const animationFrameCount = 15;
            const possibleSnowflakeImages = await loadAnimatedCubeIcon(`${prefixSourceDirectory}/snowy/source.png`);
            const largeSnowflakeImages = await loadAnimatedCubeIcon(`${prefixSourceDirectory}/snowy/large.png`);
            const targetFrameSize = {
                width: iconFrames[0].bitmap.width,
                height: iconFrames[0].bitmap.height
            }

            const numberOfSnowflakes = 7 + Math.round(seedGen() * 2);
            let fallingSnowflakes: {
                iconIndexOffset: number,
                x: number,
                y: number,
                large: boolean
            }[] = [];

            while (fallingSnowflakes.length < numberOfSnowflakes) {
                fallingSnowflakes.push({
                    iconIndexOffset: Math.floor(seedGen() * possibleSnowflakeImages.length),
                    x: Math.floor(seedGen() * (targetFrameSize.width - possibleSnowflakeImages[0].bitmap.width)),
                    y: Math.floor(seedGen() * targetFrameSize.height),
                    large: seedGen() > 0.8
                })
            }

            const neededFrames = maths.leastCommonMultiple(animationFrameCount, iconFrames.length);
            for (let animationFrameIndex = 0; animationFrameIndex < neededFrames; animationFrameIndex++) {
                const newAnimationFrame = new Jimp(targetFrameSize.width, targetFrameSize.height, 0x00000000);
                const iconIndex = animationFrameIndex % iconFrames.length;
                for (let snowflakeIconIndex = 0; snowflakeIconIndex < fallingSnowflakes.length; snowflakeIconIndex++) {
                    const snowflakeIcon = fallingSnowflakes[snowflakeIconIndex];
                    const fallOffset = (targetFrameSize.height / neededFrames) * animationFrameIndex;
                    const snowflakeAnimationIndex = (snowflakeIcon.iconIndexOffset + animationFrameIndex) % animationFrameCount;
                    const imageUsed = (snowflakeIcon.large) ? largeSnowflakeImages[snowflakeAnimationIndex]  : possibleSnowflakeImages[snowflakeAnimationIndex]
                    newAnimationFrame.composite(imageUsed, snowflakeIcon.x, snowflakeIcon.y + fallOffset);
                    newAnimationFrame.composite(imageUsed, snowflakeIcon.x, (snowflakeIcon.y - targetFrameSize.height) + fallOffset);
                }
                prefixFrames.maskFrames.push(iconFrames[iconIndex].clone().composite(newAnimationFrame, Math.floor((iconFrames[0].bitmap.width - targetFrameSize.width) / 2), 0))
                // prefixFrames.frontFrames.push([{
                //     image: newAnimationFrame,
                //     compositePosition: {
                //         x: Math.floor((iconFrames[0].bitmap.width - targetFrameSize.width) / 2),
                //         y: 0
                //     }
                // }])
            }

            return prefixFrames;
        }
    },
    "Tentacular": {
        name: "Tentacular",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed) {
            const prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Tentacular";
            let seedGen = new seedrandom(`tentacular${seed}`);

            let iconHeight = iconFrames[0].bitmap.height;
            let iconWidth = iconFrames[0].bitmap.width;

            let tentacleCount = Math.round(seedGen() * 2) + 2;
            let tentacleImage = await Jimp.read(`${prefixSourceDirectory}/tentacular/tentacle.png`);
            const desiredFrames = 15;

            let tentacleHeadFrontImage = await Jimp.read(`${prefixSourceDirectory}/tentacular/front.png`);
            let frontCacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/tentacular/front/`);
            if (!fs.existsSync(frontCacheDirectory)) fs.mkdirSync(frontCacheDirectory, { recursive: true });

            let frontHeadFrames: CCOIcons.compiledPrefixFrames["frontFrames"][number][] = [];

            for (let headFrameIndex = 0; headFrameIndex < anchorPoints.heads.length; headFrameIndex++) {
                const frameHeadPosition = anchorPoints.heads[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(tentacleHeadFrontImage, frontCacheDirectory, frameHeadPosition, { x: 8, y: 16, width: 32 });
                frontHeadFrames.push(headImagesThisFrame);
            }

            let tentacleHeadBackImage = await Jimp.read(`${prefixSourceDirectory}/tentacular/back.png`);
            let backCacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/tentacular/back/`);
            if (!fs.existsSync(backCacheDirectory)) fs.mkdirSync(backCacheDirectory, { recursive: true });

            let backHeadFrames: CCOIcons.compiledPrefixFrames["frontFrames"][number][] = [];

            for (let headFrameIndex = 0; headFrameIndex < anchorPoints.heads.length; headFrameIndex++) {
                const frameHeadPosition = anchorPoints.heads[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(tentacleHeadBackImage, backCacheDirectory, frameHeadPosition, { x: 8, y: 16, width: 32 });
                backHeadFrames.push(headImagesThisFrame);
            }

            let tentacleSlopeVariance = 0.2;

            let tentacleLines: {
                start: {
                    x: number,
                    y: number
                },
                end: {
                    x: number,
                    y: number
                },
                offset: number,
                flipX: boolean,
                flipY: boolean,
                direction: number,
                slope: number,
                lineImage: Jimp,
                lineImagesPerFrame: Jimp[]
            }[] = [];

            const maskThickness = Math.ceil(tentacleImage.bitmap.height / 2);

            while (tentacleLines.length < tentacleCount) {
                let newTentacle: typeof tentacleLines[number] = {
                    start: {
                        x: 0,
                        y: 0
                    },
                    end: {
                        x: 0,
                        y: 0
                    },
                    offset: Math.round(seedGen() * tentacleImage.bitmap.width),
                    flipX: seedGen() > 0.5,
                    flipY: seedGen() > 0.5,
                    direction: ((seedGen() > 0.5) ? -1 : 1),
                    slope: 0,
                    lineImage: new Jimp(0, 0, 0),
                    lineImagesPerFrame: []
                }
                newTentacle.start.y = Math.round((seedGen() * ((iconHeight + (maskThickness * 2)) * (1 - (tentacleSlopeVariance * 2)))) + ((iconHeight + (maskThickness * 2)) * tentacleSlopeVariance));
                newTentacle.end.x = iconWidth+maskThickness-1;
                newTentacle.end.y = Math.round(newTentacle.start.y + (seedGen() * (iconHeight + (maskThickness * 2)) * tentacleSlopeVariance * ((seedGen() > 0.5) ? -1 : 1)));
                newTentacle.slope = (newTentacle.start.y - newTentacle.end.y) / (newTentacle.start.x - newTentacle.end.x);
                newTentacle.lineImage = new Jimp(iconFrames[0].bitmap.width + (maskThickness * 2), iconFrames[0].bitmap.height + (maskThickness * 2), 0x00000000);
                for (let lineImageX = 0; lineImageX < newTentacle.lineImage.bitmap.width; lineImageX++) {
                    newTentacle.lineImage.setPixelColor(0xffffffff, lineImageX, newTentacle.start.y + Math.round(lineImageX * newTentacle.slope));
                }
                tentacleLines.push(newTentacle);
            }

            const tentacleMovementPerFrame = tentacleImage.bitmap.width/desiredFrames;
            const tentacleImageCenterOffset = Math.round(tentacleImage.bitmap.height/2);
            iconFrames.forEach((frame, index) => {
                iconFrames[index] = strokeImage(frame, 0x00000000, maskThickness);
                tentacleLines.forEach((tentacleLine) => {
                    tentacleLine.lineImagesPerFrame.push(strokeImage(tentacleLine.lineImage.clone().mask(iconFrames[index], 0, 0), 0xffffffff, maskThickness));
                })
            })
            const neededFrames = maths.leastCommonMultipleOfArray([desiredFrames, iconFrames.length]);
            for (let neededIconFrameIndex = 0; neededIconFrameIndex < neededFrames; neededIconFrameIndex++) {
                let newPrefixImage = new Jimp(iconWidth + (maskThickness * 2), iconHeight + (maskThickness * 2), 0x00000000);
                const iconFrameIndex = neededIconFrameIndex % iconFrames.length;
                const frontHeadIndex = neededIconFrameIndex % frontHeadFrames.length;
                const backHeadIndex = neededIconFrameIndex % backHeadFrames.length;

                for (let tentacleLineIndex = 0; tentacleLineIndex < tentacleLines.length; tentacleLineIndex++) {
                    const tentacleLine = tentacleLines[tentacleLineIndex];
                    const lineImageThisFrame = tentacleLine.lineImagesPerFrame[iconFrameIndex];

                    let newTentacleFrame = new Jimp(newPrefixImage.bitmap.width, newPrefixImage.bitmap.height, 0x00000000);

                    for (let newTentacleFrameX = 0; newTentacleFrameX < newTentacleFrame.bitmap.width; newTentacleFrameX++) {
                        const newCenterPoint = { 
                            x: newTentacleFrameX,
                            y: tentacleLine.start.y + Math.round(newTentacleFrameX * tentacleLine.slope)
                        }
                        for (let newTentacleFrameY = 0; newTentacleFrameY < tentacleImage.bitmap.height; newTentacleFrameY++) {
                            let sourceX = (((newCenterPoint.x + (tentacleLine.offset + tentacleImage.bitmap.width-1)) + Math.round((tentacleLine.direction * neededIconFrameIndex) * tentacleMovementPerFrame)) % tentacleImage.bitmap.width);
                            if (tentacleLine.flipX) {
                                sourceX = tentacleImage.bitmap.width - 1 - sourceX;
                            }
                            let sourceY = newTentacleFrameY;
                            if (tentacleLine.flipY) {
                                sourceY = tentacleImage.bitmap.height - 1 - sourceY;
                            }
                            const sourceCoordinates = {
                                x: sourceX,
                                y: sourceY
                            }
                            const destinationCoordinates = {
                                x: newTentacleFrameX,
                                y: newCenterPoint.y - tentacleImageCenterOffset + newTentacleFrameY + 1
                            }
                            newTentacleFrame.setPixelColor(tentacleImage.getPixelColor(sourceCoordinates.x, sourceCoordinates.y), destinationCoordinates.x, destinationCoordinates.y);
                        }
                    }
                    // newPrefixImage.composite(lineImageThisFrame, -maskThickness, -maskThickness);
                    newPrefixImage.composite(newTentacleFrame.mask(lineImageThisFrame, -maskThickness, -maskThickness), 0, 0);
                }

                prefixFrames.frontFrames.push([{
                    image: newPrefixImage,
                    compositePosition: {
                        x: -maskThickness,
                        y: -maskThickness
                    }
                }, ...frontHeadFrames[frontHeadIndex]]);
                prefixFrames.backFrames.push([...backHeadFrames[backHeadIndex]]);
            }

            return prefixFrames;
        }
    },
    "Summoning": {
        name: "Summoning",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let seedGen = new seedrandom(`summoning${seed}`);
            prefixFrames.sourceID = "Summoning";

            const desiredFrames = 30;
            const rainbowFrames = 30;
            const summoningCount = Math.ceil(seedGen() * 4) * 2;
            const globalOffset = Math.ceil(desiredFrames * seedGen());
            const centerPoint = Math.ceil(iconFrames[0].bitmap.width/2);
            const radius = centerPoint * ((1.2 * seedGen()) + 1);

            let allKeyFrames: animationKeyFrame[] = [];

            const angleIncrement = 360/desiredFrames;
            for (let frameIndex = 0; frameIndex < desiredFrames; frameIndex++) {
                const trigInput = ((frameIndex * angleIncrement)/180) * Math.PI;
                allKeyFrames.push({
                    layer: "front",
                    x: (radius * Math.cos(trigInput)) + centerPoint,
                    y: (radius * Math.sin(trigInput)) + centerPoint
                });
            }

            const summoningFrames = await loadAnimatedCubeIcon(`${prefixSourceDirectory}/summoning/cube.png`)

            const neededFrames = maths.leastCommonMultipleOfArray([rainbowFrames, desiredFrames, summoningFrames.length]);

            for (let desiredFrameIndex = 0; desiredFrameIndex < neededFrames; desiredFrameIndex++) {
                let constructedFrame: typeof prefixFrames.frontFrames[number] = [];
                for (let summoningCountIndex = 0; summoningCountIndex < summoningCount; summoningCountIndex++) {
                    const offset = (summoningCountIndex * Math.ceil(desiredFrames/summoningCount)) + globalOffset;
                    const rainbowMod: CCOIcons.JimpImgMod[] = [{ apply: "hue", params: [(desiredFrameIndex + offset) *(360/rainbowFrames)]}]
                    const keyFrame = allKeyFrames[(desiredFrameIndex + offset) % allKeyFrames.length];
                    const summoningFrame = summoningFrames[(desiredFrameIndex + offset) % summoningFrames.length];
                    constructedFrame.push({
                        image: summoningFrame.clone().color(rainbowMod),
                        compositePosition: {
                            x: Math.round(keyFrame.x) - Math.ceil(summoningFrame.bitmap.width/2),
                            y: Math.round(keyFrame.y) - Math.ceil(summoningFrame.bitmap.height/2)
                        }
                    })
                }
                prefixFrames.frontFrames.push(constructedFrame);
            }

            return prefixFrames;
        }
    },
    "Swarming": {
        name: "Swarming",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let seedGen = new seedrandom(`swarming${seed}`);
            prefixFrames.sourceID = "Swarming";

            const possibleSummoningCounts = [1, 2, 2, 2, 3, 3, 3, 5, 5, 5, 6, 6, 10];
            const summoningCount = possibleSummoningCounts[Math.floor(possibleSummoningCounts.length*seedGen())];
            const desiredFrames = 30;
            const globalOffset = Math.ceil(desiredFrames * seedGen());
            const centerPoint = Math.round(iconFrames[0].bitmap.width / 2);
            const radius = Math.round(iconFrames[0].bitmap.width * 0.9);

            let allKeyFrames: animationKeyFrame[] = [];

            const angleIncrement = (360) / desiredFrames;
            for (let frameIndex = 0; frameIndex < desiredFrames; frameIndex++) {
                const trigInput = (((frameIndex * angleIncrement) / 180) * Math.PI);
                allKeyFrames.push({
                    layer: "front",
                    x: (radius * Math.cos(trigInput)) + centerPoint,
                    y: (radius * Math.sin(trigInput)) + centerPoint
                });
            }

            const neededFrames = maths.leastCommonMultipleOfArray([desiredFrames, iconFrames.length]);

            const compiledFrames: Jimp[] = []; 
            iconFrames.forEach(frame => {
                compiledFrames.push(strokeImage(frame.resize(Math.round(iconFrames[iconFrames.length-1].bitmap.width/2.5), Math.round(iconFrames[iconFrames.length-1].bitmap.width/2.5), Jimp.RESIZE_NEAREST_NEIGHBOR), 0x000000ff, 1));
            })

            let reverse = 0;
            if (seedGen() > 0.5) reverse = allKeyFrames.length;

            for (let desiredFrameIndex = 0; desiredFrameIndex < neededFrames; desiredFrameIndex++) {
                let constructedFrame: typeof prefixFrames.frontFrames[number] = [];
                for (let summoningCountIndex = 0; summoningCountIndex < summoningCount; summoningCountIndex++) {
                    const offset = (summoningCountIndex * Math.ceil(desiredFrames / summoningCount));
                    const keyFrame = allKeyFrames[(Math.abs(reverse - desiredFrameIndex) + offset) % allKeyFrames.length];
                    const summoningFrame = compiledFrames[(desiredFrameIndex + offset) % compiledFrames.length];
                    constructedFrame.push({
                        image: summoningFrame,
                        compositePosition: {
                            x: Math.round(keyFrame.x) - Math.ceil(summoningFrame.bitmap.width / 2),
                            y: Math.round(keyFrame.y) - Math.ceil(summoningFrame.bitmap.height / 2)
                        }
                    })
                }
                prefixFrames.frontFrames.push(constructedFrame);
            }

            return prefixFrames;
        }
    },
    "Kramped": {
        name: "Kramped",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Kramped";

            let krampedHornsImage = await Jimp.read(`${prefixSourceDirectory}/kramped/horns.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/kramped/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(krampedHornsImage, cacheDirectory, frameHeadPosition, { x: 16, y: 24, width: 32 });
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Dandy": {
        name: "Dandy",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Dandy";

            let dandyHairImage = await Jimp.read(`${prefixSourceDirectory}/dandy/hair.png`);
            let dandyBackofHairImage = await Jimp.read(`${prefixSourceDirectory}/dandy/hairback.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/dandy/front/`);
            let backCacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/dandy/back/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });
            if (!fs.existsSync(backCacheDirectory)) fs.mkdirSync(backCacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(dandyHairImage, cacheDirectory, frameHeadPosition, { x: 8, y: 16, width: 32 });
                prefixFrames.frontFrames.push(headImagesThisFrame);
                const backImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(dandyBackofHairImage, backCacheDirectory, frameHeadPosition, { x: 8, y: 16, width: 32 });
                prefixFrames.backFrames.push(backImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Incarcerated": {
        name: "Incarcerated",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Incarcerated";

            let jailLidImage = await Jimp.read(`${prefixSourceDirectory}/incarcerated/top.png`);
            let jailFloorImage = await Jimp.read(`${prefixSourceDirectory}/incarcerated/bottom.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/incarcerated/front/`);
            let backCacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/incarcerated/back/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });
            if (!fs.existsSync(backCacheDirectory)) fs.mkdirSync(backCacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(jailLidImage, cacheDirectory, frameHeadPosition, { x: 8, y: 16, width: 32 });
                prefixFrames.frontFrames.push(headImagesThisFrame);
                const backImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(jailFloorImage, backCacheDirectory, frameHeadPosition, { x: 8, y: 16, width: 32 });
                prefixFrames.backFrames.push(backImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Rippling": {
        name: "Rippling",
        tags: ["appliesDirectlyAfterAllPrefixes"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let desiredFrames = 30;
            const maxSinMovement = 2;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Rippling";

            function yOffset(x: number, frame: number) {
                return Math.round(Math.sin((x-((frame/desiredFrames) * (Math.PI * 2 * maxSinMovement)))/(maxSinMovement/2))*maxSinMovement)
            }

            const neededFrames = maths.leastCommonMultiple(desiredFrames, iconFrames.length);

            for (let outputFrameIndex = 0; outputFrameIndex < neededFrames; outputFrameIndex++) {
                const currentIconFrame = iconFrames[outputFrameIndex % iconFrames.length];
                const sinWaveFrameIdx = outputFrameIndex % desiredFrames;
                const outputFrame = new Jimp(currentIconFrame.bitmap.width + (maxSinMovement * 2), currentIconFrame.bitmap.height + (maxSinMovement * 2), 0x00000000)

                for (let iconFrameXPosition = 0; iconFrameXPosition < currentIconFrame.bitmap.width; iconFrameXPosition++) {
                    const iconFrameYOffset = yOffset(iconFrameXPosition, sinWaveFrameIdx);
                    for (let iconFrameYPosition = 0; iconFrameYPosition < currentIconFrame.bitmap.height; iconFrameYPosition++) {
                        // console.log(currentIconFrame.getPixelColor(iconFrameXPosition, iconFrameYPosition), iconFrameXPosition, iconFrameYPosition)
                        outputFrame.setPixelColor(currentIconFrame.getPixelColor(iconFrameXPosition, iconFrameYPosition), iconFrameXPosition + maxSinMovement, iconFrameYPosition + iconFrameYOffset + maxSinMovement)
                    }
                }
                prefixFrames.maskFrames.push(outputFrame);
            }

            return prefixFrames;
        }
    },
    "Runic": {
        name: "Runic",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Runic";
            let seedGen = new seedrandom(`runic${seed}`);
            const allRunes = await loadAnimatedCubeIcon(`${prefixSourceDirectory}/runic/runes.png`)

            const floatingFramesYOffsets = [
                -1,
                -1,
                -1,
                -1,
                0,
                0,
                0,
                1,
                1,
                0,
            ];

            const possibleColorShifts: CCOIcons.JimpImgMod[][] = [
                [], [], [], [], [],
                [
                    { apply: "hue", params: [100] },
                    { apply: "desaturate", params: [30] }
                ],
                [
                    { apply: "hue", params: [180] },
                    { apply: "desaturate", params: [30] }
                ],
                [
                    { apply: "hue", params: [-120] },
                    { apply: "saturate", params: [60] }
                ]
            ];

            const colorShift = possibleColorShifts[Math.floor(seedGen() * possibleColorShifts.length)];
            allRunes.forEach(image => image.color(colorShift));

            const runeCount = Math.round(seedGen() * 3) + 1;
            let runes: {
                runeIndex: number,
                animationOffset: number,
                position: CCOIcons.coordinate
            }[] = [];
            const runePadding = allRunes[0].bitmap.width;
            while (runes.length < runeCount) {
                runes.push({
                    runeIndex: Math.floor(allRunes.length * seedGen()),
                    animationOffset: Math.floor(floatingFramesYOffsets.length * seedGen()),
                    position: {
                        x: Math.floor((iconFrames[0].bitmap.width - runePadding) * seedGen()) + Math.round(runePadding /2),
                        y: Math.floor((iconFrames[0].bitmap.height - runePadding) * seedGen()) + Math.round(runePadding /2),
                    }
                })
            }

            for (let floatingFramesYOffsetIndex = 0; floatingFramesYOffsetIndex < floatingFramesYOffsets.length; floatingFramesYOffsetIndex++) {
                let newFrame: typeof prefixFrames.frontFrames[number][number][] = []
                for (let generatedRuneIndex = 0; generatedRuneIndex < runes.length; generatedRuneIndex++) {
                    const rune = runes[generatedRuneIndex];
                    const yOffset = floatingFramesYOffsets[(floatingFramesYOffsetIndex + rune.animationOffset) % floatingFramesYOffsets.length];
                    newFrame.push({
                        image: allRunes[rune.runeIndex],
                        compositePosition: {
                            x: rune.position.x - Math.ceil(allRunes[rune.runeIndex].bitmap.width/2),
                            y: (rune.position.y + yOffset) - Math.ceil(allRunes[rune.runeIndex].bitmap.height/2)
                        }
                    })
                }
                prefixFrames.frontFrames.push(newFrame);
            }

            prefixFrames.outlineFrames.push([{width: 1, color: allRunes[0].getPixelColor(6, 1), layers: ["back", "front", "icon"]}])

            return prefixFrames;
        }
    },
    "Emphasized": {
        name: "Emphasized",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Emphasized";
            let seedGen = new seedrandom(`emphasized${seed}`);

            let arrowImages = await loadAnimatedCubeIcon(`${prefixSourceDirectory}/emphasized/arrows.png`);
            let constructedArrowFrame = new Jimp(arrowImages[0].bitmap.width, arrowImages[0].bitmap.height, 0x00000000);

            let usedArrows: number[] = [];
            const arrowCount = Math.ceil(arrowImages.length * (2 ** (5 * (seedGen() - 1)))); // \operatorname{ceil}\left(\left(8\right)2^{5\left(x-1\right)}\right) 
            while (usedArrows.length < arrowCount) {
                const newIndex = Math.floor(seedGen() * arrowImages.length);
                if (!usedArrows.includes(newIndex)) {
                    usedArrows.push(newIndex)
                }
            }
            usedArrows.forEach(arrowIndex => {
                constructedArrowFrame.composite(arrowImages[arrowIndex], 0, 0);
            })

            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/emphasized${seed}/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(constructedArrowFrame, cacheDirectory, frameHeadPosition, { x: 32, y: 40, width: 32 });
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Chained": {
        name: "Chained",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed) {
            const prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Chained";
            let seedGen = new seedrandom(`chained${seed}`);

            let iconHeight = iconFrames[0].bitmap.height;
            let iconWidth = iconFrames[0].bitmap.width;

            let chainCount = Math.round(seedGen() * 2) + 1;
            let chainImage = await Jimp.read(`${prefixSourceDirectory}/chained/chain.png`);
            const desiredFrames = 15;

            let chainSlopeVariance = 0.3;

            let chainLines: {
                start: {
                    x: number,
                    y: number
                },
                end: {
                    x: number,
                    y: number
                },
                offset: number,
                flipX: boolean,
                direction: number,
                slope: number,
                lineImage: Jimp,
                lineImagesPerFrame: Jimp[]
            }[] = [];

            const maskThickness = 1;

            while (chainLines.length < chainCount) {
                let newChain: typeof chainLines[number] = {
                    start: {
                        x: 0,
                        y: 0
                    },
                    end: {
                        x: 0,
                        y: 0
                    },
                    offset: Math.round(seedGen() * chainImage.bitmap.width),
                    flipX: seedGen() > 0.5,
                    direction: ((seedGen() > 0.5) ? -1 : 1),
                    slope: 0,
                    lineImage: new Jimp(0, 0, 0),
                    lineImagesPerFrame: []
                }
                newChain.start.y = Math.round((seedGen() * ((iconHeight + (maskThickness * 2)) * (1 - (chainSlopeVariance * 2)))) + ((iconHeight + (maskThickness * 2)) * chainSlopeVariance));
                newChain.end.x = iconWidth + maskThickness - 1;
                newChain.end.y = Math.round(newChain.start.y + (seedGen() * (iconHeight + (maskThickness * 2)) * chainSlopeVariance * ((seedGen() > 0.5) ? -1 : 1)));
                newChain.slope = (newChain.start.y - newChain.end.y) / (newChain.start.x - newChain.end.x);
                newChain.lineImage = new Jimp(iconFrames[0].bitmap.width + (maskThickness * 2), iconFrames[0].bitmap.height + (maskThickness * 2), 0x00000000);
                for (let lineImageX = 0; lineImageX < newChain.lineImage.bitmap.width; lineImageX++) {
                    for (let chainImageYPosition = 0; chainImageYPosition < chainImage.bitmap.height; chainImageYPosition++) {
                        const yOffset = chainImageYPosition - Math.ceil(chainImage.bitmap.height/2);
                        newChain.lineImage.setPixelColor(0xffffffff, lineImageX, newChain.start.y + Math.round(lineImageX * newChain.slope) + yOffset);
                    }
                }
                chainLines.push(newChain);
            }

            const chainMovementPerFrame = chainImage.bitmap.width / desiredFrames;
            const chainImageCenterOffset = Math.round(chainImage.bitmap.height / 2);
            iconFrames.forEach((frame, index) => {
                iconFrames[index] = strokeImage(frame, 0x00000000, maskThickness);
                chainLines.forEach((chainLine) => {
                    chainLine.lineImagesPerFrame.push(strokeImage(chainLine.lineImage.clone().mask(iconFrames[index], 0, 0), 0xffffffff, maskThickness));
                })
            })
            const neededFrames = maths.leastCommonMultipleOfArray([desiredFrames, iconFrames.length]);
            for (let neededIconFrameIndex = 0; neededIconFrameIndex < neededFrames; neededIconFrameIndex++) {
                let newPrefixImage = new Jimp(iconWidth + (maskThickness * 2), iconHeight + (maskThickness * 2), 0x00000000);
                const iconFrameIndex = neededIconFrameIndex % iconFrames.length;

                for (let chainLineIndex = 0; chainLineIndex < chainLines.length; chainLineIndex++) {
                    const chainLine = chainLines[chainLineIndex];
                    const lineImageThisFrame = chainLine.lineImagesPerFrame[iconFrameIndex];

                    let newChainFrame = new Jimp(newPrefixImage.bitmap.width, newPrefixImage.bitmap.height, 0x00000000);

                    for (let newChainFrameX = 0; newChainFrameX < newChainFrame.bitmap.width; newChainFrameX++) {
                        const newCenterPoint = {
                            x: newChainFrameX,
                            y: chainLine.start.y + Math.round(newChainFrameX * chainLine.slope)
                        }
                        for (let newChainFrameY = 0; newChainFrameY < chainImage.bitmap.height; newChainFrameY++) {
                            let sourceX = (((newCenterPoint.x + (chainLine.offset + chainImage.bitmap.width - 1)) + Math.round((chainLine.direction * neededIconFrameIndex) * chainMovementPerFrame)) % chainImage.bitmap.width);
                            if (chainLine.flipX) {
                                sourceX = chainImage.bitmap.width - 1 - sourceX;
                            }
                            let sourceY = newChainFrameY;
                            const sourceCoordinates = {
                                x: sourceX,
                                y: sourceY
                            }
                            const destinationCoordinates = {
                                x: newChainFrameX,
                                y: newCenterPoint.y - chainImageCenterOffset + newChainFrameY + 1
                            }
                            newChainFrame.setPixelColor(chainImage.getPixelColor(sourceCoordinates.x, sourceCoordinates.y), destinationCoordinates.x, destinationCoordinates.y);
                        }
                    }
                    // newPrefixImage.composite(lineImageThisFrame, -maskThickness, -maskThickness);
                    newPrefixImage.composite(newChainFrame.mask(lineImageThisFrame, -maskThickness, -maskThickness), 0, 0);
                }

                prefixFrames.frontFrames.push([{
                    image: newPrefixImage,
                    compositePosition: {
                        x: -maskThickness,
                        y: -maskThickness
                    }
                }]);
            }

            return prefixFrames;
        }
    },
    "Adduced": {
        name: "Adduced",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            const prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Adduced";
            let seedGen = new seedrandom(`adduced${seed}`);

            let iconHeight = iconFrames[0].bitmap.height;
            let iconWidth = iconFrames[0].bitmap.width;

            let tapeCount = Math.round(seedGen() * 2) + 1;
            let tapeImage = await Jimp.read(`${prefixSourceDirectory}/adduced/cautiontape.png`);
            const desiredFrames = 15;

            let tapeSlopeVariance = 0.3;

            let tapeLines: {
                start: {
                    x: number,
                    y: number
                },
                end: {
                    x: number,
                    y: number
                },
                offset: number,
                direction: number,
                slope: number,
                lineImage: Jimp,
                lineImagesPerFrame: Jimp[]
            }[] = [];

            const maskThickness = 1;

            while (tapeLines.length < tapeCount) {
                let newTape: typeof tapeLines[number] = {
                    start: {
                        x: 0,
                        y: 0
                    },
                    end: {
                        x: 0,
                        y: 0
                    },
                    offset: Math.round(seedGen() * tapeImage.bitmap.width),
                    direction: ((seedGen() > 0.5) ? -1 : 1),
                    slope: 0,
                    lineImage: new Jimp(0, 0, 0),
                    lineImagesPerFrame: []
                }
                newTape.start.y = Math.round((seedGen() * ((iconHeight + (maskThickness * 2)) * (1 - (tapeSlopeVariance * 2)))) + ((iconHeight + (maskThickness * 2)) * tapeSlopeVariance));
                newTape.end.x = iconWidth + maskThickness - 1;
                newTape.end.y = Math.round(newTape.start.y + (seedGen() * (iconHeight + (maskThickness * 2)) * tapeSlopeVariance * ((seedGen() > 0.5) ? -1 : 1)));
                newTape.slope = (newTape.start.y - newTape.end.y) / (newTape.start.x - newTape.end.x);
                newTape.lineImage = new Jimp(iconFrames[0].bitmap.width + (maskThickness * 2), iconFrames[0].bitmap.height + (maskThickness * 2), 0x00000000);
                for (let lineImageX = 0; lineImageX < newTape.lineImage.bitmap.width; lineImageX++) {
                    for (let tapeImageYPosition = 0; tapeImageYPosition < tapeImage.bitmap.height; tapeImageYPosition++) {
                        const yOffset = tapeImageYPosition - Math.ceil(tapeImage.bitmap.height / 2);
                        newTape.lineImage.setPixelColor(0xffffffff, lineImageX, newTape.start.y + Math.round(lineImageX * newTape.slope) + yOffset);
                    }
                }
                tapeLines.push(newTape);
            }

            const tapeMovementPerFrame = tapeImage.bitmap.width / desiredFrames;
            const tapeImageCenterOffset = Math.round(tapeImage.bitmap.height / 2);
            iconFrames.forEach((frame, index) => {
                iconFrames[index] = strokeImage(frame, 0x00000000, maskThickness);
                tapeLines.forEach((tapeLine) => {
                    tapeLine.lineImagesPerFrame.push(strokeImage(tapeLine.lineImage.clone().mask(iconFrames[index], 0, 0), 0xffffffff, maskThickness));
                })
            })
            const neededFrames = maths.leastCommonMultipleOfArray([desiredFrames, iconFrames.length]);
            for (let neededIconFrameIndex = 0; neededIconFrameIndex < neededFrames; neededIconFrameIndex++) {
                let newPrefixImage = new Jimp(iconWidth + (maskThickness * 2), iconHeight + (maskThickness * 2), 0x00000000);
                const iconFrameIndex = neededIconFrameIndex % iconFrames.length;

                for (let tapeLineIndex = 0; tapeLineIndex < tapeLines.length; tapeLineIndex++) {
                    const tapeLine = tapeLines[tapeLineIndex];
                    const lineImageThisFrame = tapeLine.lineImagesPerFrame[iconFrameIndex];

                    let newChainFrame = new Jimp(newPrefixImage.bitmap.width, newPrefixImage.bitmap.height, 0x00000000);

                    for (let newChainFrameX = 0; newChainFrameX < newChainFrame.bitmap.width; newChainFrameX++) {
                        const newCenterPoint = {
                            x: newChainFrameX,
                            y: tapeLine.start.y + Math.round(newChainFrameX * tapeLine.slope)
                        }
                        for (let newTapeFrameY = 0; newTapeFrameY < tapeImage.bitmap.height; newTapeFrameY++) {
                            let sourceX = (((newCenterPoint.x + (tapeLine.offset + tapeImage.bitmap.width - 1)) + Math.round((tapeLine.direction * neededIconFrameIndex) * tapeMovementPerFrame)) % tapeImage.bitmap.width);
                            let sourceY = newTapeFrameY;
                            const sourceCoordinates = {
                                x: sourceX,
                                y: sourceY
                            }
                            const destinationCoordinates = {
                                x: newChainFrameX,
                                y: newCenterPoint.y - tapeImageCenterOffset + newTapeFrameY + 1
                            }
                            newChainFrame.setPixelColor(tapeImage.getPixelColor(sourceCoordinates.x, sourceCoordinates.y), destinationCoordinates.x, destinationCoordinates.y);
                        }
                    }
                    // newPrefixImage.composite(lineImageThisFrame, -maskThickness, -maskThickness);
                    newPrefixImage.composite(newChainFrame.mask(lineImageThisFrame, -maskThickness, -maskThickness), 0, 0);
                }

                prefixFrames.frontFrames.push([{
                    image: newPrefixImage,
                    compositePosition: {
                        x: -maskThickness,
                        y: -maskThickness
                    }
                }]);
            }

            return prefixFrames;
        }
    },
    "Angelic": {
        name: "Angelic",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Angelic";

            let haloFrames = await loadAnimatedCubeIcon(`${prefixSourceDirectory}/angelic/halo.png`);

            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/angelic/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });
            // We don't cache this prefix, but we'll make a cache directory just in case we need to in the future

            let neededAnimationFrames = maths.leastCommonMultiple(haloFrames.length, iconFrames.length);

            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrames; animationFrameIndex++) {
                const haloMovementFrame = haloFrames[animationFrameIndex % haloFrames.length];
                const frameHeadData = headPositions[animationFrameIndex % headPositions.length];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(haloMovementFrame, cacheDirectory, frameHeadData, { x: 3, y: 14, width: 32 }, false);
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Menacing": {
        name: "Menacing",
        tags: ["appliesDirectlyAfterAllPrefixes"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Menacing";

            let menacingFrames = await loadAnimatedCubeIcon(`${prefixSourceDirectory}/menacing/menacing.png`);

            let desiredFrames = 30;

            const padding = 5;
            const newFrameBase = new Jimp(iconFrames[0].bitmap.width + (padding * 2), iconFrames[0].bitmap.height + (padding * 2), 0x00000000);

            let baseKeyFrames: animationKeyFrame[] = [
                {
                    x: Math.round(newFrameBase.bitmap.width * 0.7),
                    y: newFrameBase.bitmap.height + Math.round(1.2 * menacingFrames[0].bitmap.height),
                    layer: "front"
                },
                {
                    x: Math.round(newFrameBase.bitmap.width * 1.1),
                    y: -Math.round(menacingFrames[0].bitmap.height * 2.2),
                    layer: "front"
                }
            ]

            const menacingCount = Math.max(5, Math.floor(iconFrames[0].bitmap.height/50)*6);

            const finalKeyFrames = generateInterpolatedFramesFromKeyFrames(desiredFrames * 2, baseKeyFrames, 1, 0).slice(0, desiredFrames);

            const neededFrames = maths.leastCommonMultipleOfArray([desiredFrames, menacingFrames.length, iconFrames.length]);

            const menacingFrameOffset = Math.round(menacingFrames[0].bitmap.width/2);
            for (let newFrameIndex = 0; newFrameIndex < neededFrames; newFrameIndex++) {
                const iconFrame = iconFrames[newFrameIndex % iconFrames.length];
                let newFrame = newFrameBase.clone().composite(iconFrame, padding, padding);
                for (let menacingIndex = 0; menacingIndex < menacingCount; menacingIndex++) {
                    const keyFrameOffset = menacingIndex*Math.round(finalKeyFrames.length / menacingCount);
                    const keyFrame = finalKeyFrames[(newFrameIndex + keyFrameOffset) % finalKeyFrames.length];
                    const animationOffset = menacingIndex * Math.round(menacingFrames.length / menacingCount);
                    const menacingFrame = menacingFrames[(newFrameIndex + animationOffset) % menacingFrames.length];
                    
                    newFrame.composite(menacingFrame, keyFrame.x - menacingFrameOffset, keyFrame.y - menacingFrameOffset);
                }
                prefixFrames.maskFrames.push(newFrame);
            }

            return prefixFrames;
        }
    },
    "Serving": {
        name: "Serving",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let headPositions = anchorPoints.heads;
            prefixFrames.sourceID = "Serving";

            let maidBonnetImage = await Jimp.read(`${prefixSourceDirectory}/serving/bonnet.png`);
            let maidSkirtImage = await Jimp.read(`${prefixSourceDirectory}/serving/skirt.png`);
            let maidSkirtBackImage = await Jimp.read(`${prefixSourceDirectory}/serving/skirtback.png`);

            let skirtDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/serving/skirtfront/`);
            if (!fs.existsSync(skirtDirectory)) fs.mkdirSync(skirtDirectory, { recursive: true });
            let bonnetDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/serving/bonnet/`);
            if (!fs.existsSync(bonnetDirectory)) fs.mkdirSync(bonnetDirectory, { recursive: true });
            let backSkirtDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/serving/skirtback/`);
            if (!fs.existsSync(backSkirtDirectory)) fs.mkdirSync(backSkirtDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];

                const bonnetImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(maidBonnetImage, bonnetDirectory, frameHeadPosition, { x: 8, y: 16, width: 32 });
                const skirtImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(maidSkirtImage, skirtDirectory, frameHeadPosition, { x: 8, y: 16, width: 32 });
                prefixFrames.frontFrames.push([...bonnetImagesThisFrame, ...skirtImagesThisFrame]);

                const backSkirtImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(maidSkirtBackImage, backSkirtDirectory, frameHeadPosition, { x: 8, y: 16, width: 32 });
                prefixFrames.backFrames.push(backSkirtImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Holy": {
        name: "Holy",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Holy";
            let seedGen = new seedrandom(`holy${seed}`);

            let allGlowFrames = await loadAnimatedCubeIcon(`${prefixSourceDirectory}/holy/glows.png`);

            let animationLength = allGlowFrames.length;
            let constructedGlowAnimation: Jimp[] = allGlowFrames.slice(-animationLength, animationLength);
            for (let newAnimationIndex = 0; newAnimationIndex < animationLength; newAnimationIndex++) {
                const sourceIndex = animationLength - newAnimationIndex - 1;
                constructedGlowAnimation.push(constructedGlowAnimation[sourceIndex]);
            }

            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/holy/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });
            // We don't cache this prefix, but we'll make a cache directory just in case we need to in the future

            let neededAnimationFrames = maths.leastCommonMultiple(constructedGlowAnimation.length, iconFrames.length);

            const animationOffset = Math.floor(constructedGlowAnimation.length * seedGen())
            
            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrames; animationFrameIndex++) {
                const haloFrame = constructedGlowAnimation[(animationFrameIndex + animationOffset) % constructedGlowAnimation.length];
                const frameHeadData = headPositions[animationFrameIndex % headPositions.length];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(haloFrame, cacheDirectory, frameHeadData, { x: 24, y: 32, width: 32 }, false);
                prefixFrames.backFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Unholy": {
        name: "Unholy",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Unholy";
            let seedGen = new seedrandom(`unholy${seed}`);

            let allGlowFrames = await loadAnimatedCubeIcon(`${prefixSourceDirectory}/unholy/glows.png`);
            let animationLength = allGlowFrames.length;
            let constructedGlowAnimation: Jimp[] = allGlowFrames.slice(-animationLength, animationLength);
            for (let newAnimationIndex = 0; newAnimationIndex < animationLength; newAnimationIndex++) {
                const sourceIndex = animationLength - newAnimationIndex - 1;
                constructedGlowAnimation.push(constructedGlowAnimation[sourceIndex]);
            }

            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/unholy/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });
            // We don't cache this prefix, but we'll make a cache directory just in case we need to in the future

            let neededAnimationFrames = maths.leastCommonMultiple(constructedGlowAnimation.length, iconFrames.length);

            const animationOffset = Math.floor(constructedGlowAnimation.length * seedGen())

            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrames; animationFrameIndex++) {
                const haloFrame = constructedGlowAnimation[(animationOffset + animationFrameIndex) % constructedGlowAnimation.length];
                const frameHeadData = headPositions[animationFrameIndex % headPositions.length];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(haloFrame, cacheDirectory, frameHeadData, { x: 24, y: 32, width: 32 }, false);
                prefixFrames.backFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Contaminated": {
        name: "Contaminated",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Contaminated";
            let seedGen = new seedrandom(`contaminated${seed}`);
            let dropFrames = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/contaminated/drip.png`), 20);

            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/contaminated/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });
            // We don't cache this prefix, but we'll make a cache directory just in case we need to in the future

            let dripPixels: {position: CCOIcons.coordinate, animationOffset: number}[] = [];
            const eligibilityFunction = function(frame: Jimp, x: number, y: number): boolean {
                return frame.bitmap.data[frame.getPixelIndex(x, y) + 3] > 0 && frame.bitmap.data[frame.getPixelIndex(x, y + 1) + 3] === 0
            }
            iconFrames[0].scan(0, 0, iconFrames[0].bitmap.width, iconFrames[0].bitmap.height, function(x, y, idx) {
                if (y < this.bitmap.height-1) {
                    if (eligibilityFunction(this, x, y)) {
                        if (seedGen() > 0.8) {
                            dripPixels.push({position: {x, y}, animationOffset: Math.floor(seedGen() * dropFrames.length)});
                        }
                    }
                }
            })
            iconFrames.forEach((frame, index) => {
                if (index !== 0) {
                    dripPixels = dripPixels.filter((dripPixel) => {
                        return eligibilityFunction(frame, dripPixel.position.x, dripPixel.position.y);
                    })
                }
            })

            const padding = 5;

            let neededAnimationFrames = maths.leastCommonMultiple(dropFrames.length, iconFrames.length);

            for (let newAnimationFrameIndex = 0; newAnimationFrameIndex < neededAnimationFrames; newAnimationFrameIndex++) {
                let newFrame = new Jimp(iconFrames[0].bitmap.width + (padding * 2), iconFrames[0].bitmap.height + (padding * 2), 0x00000000);
                for (let dripIndex = 0; dripIndex < dripPixels.length; dripIndex++) {
                    const dripPixel = dripPixels[dripIndex];
                    const dripPixelAnimationFrame = dropFrames[(newAnimationFrameIndex + dripPixel.animationOffset) % dropFrames.length];
                    newFrame.composite(dripPixelAnimationFrame, dripPixel.position.x + padding, dripPixel.position.y + 1 + padding);
                }
                prefixFrames.backFrames.push([{
                    image: newFrame,
                    compositePosition: {
                        x: -padding,
                        y: -padding
                    }
                }])
            }

            prefixFrames.outlineFrames.push([{ width: 1, color: 0x17f215ff, layers: ["icon", "front", "back"]}])

            return prefixFrames;
        }
    },
    "Neko": {
        name: "Neko",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Neko";
            let seedGen = new seedrandom(`contaminated${seed}`);

            
            let allCatEars = await loadAnimatedCubeIcon(`${prefixSourceDirectory}/neko/ears.png`);
            let allCatTails = await loadAnimatedCubeIcon(`${prefixSourceDirectory}/neko/tails.png`);
            
            const catVariation = Math.floor(seedGen() * allCatEars.length);

            let catEarImage = allCatEars[catVariation];
            let catTailImage = allCatTails[catVariation];

            let earDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/neko/ears/`);
            if (!fs.existsSync(earDirectory)) fs.mkdirSync(earDirectory, { recursive: true });
            let tailDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/neko/tail/`);
            if (!fs.existsSync(tailDirectory)) fs.mkdirSync(tailDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];

                const catEarsThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(catEarImage, earDirectory, frameHeadPosition, { x: 16, y: 24, width: 32 });
                prefixFrames.frontFrames.push(catEarsThisFrame);

                const catTailsThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(catTailImage, tailDirectory, frameHeadPosition, { x: 16, y: 24, width: 32 });
                prefixFrames.backFrames.push(catTailsThisFrame);
            }

            return prefixFrames;
        }
    },
    "Phosphorescent": {
        name: "Phosphorescent",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Phosphorescent";
            let seedGen = new seedrandom(`phosphorescent${seed}`);

            let glowHeadImage = await Jimp.read(`${prefixSourceDirectory}/phosphorescent/glow.png`);
            const smallGlowAnimation = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/phosphorescent/smallglows.png`), 5);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/phosphorescent/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            let sparklePixels: { position: CCOIcons.coordinate, animationOffset: number }[] = [];
            const eligibilityFunction = function (frame: Jimp, x: number, y: number): boolean {
                return frame.bitmap.data[frame.getPixelIndex(x, y) + 3] > 0 && (
                    frame.bitmap.data[frame.getPixelIndex(x, y + 1) + 3] === 0 ||
                    frame.bitmap.data[frame.getPixelIndex(x, y - 1) + 3] === 0 ||
                    frame.bitmap.data[frame.getPixelIndex(x + 1, y) + 3] === 0 ||
                    frame.bitmap.data[frame.getPixelIndex(x - 1, y) + 3] === 0
                )
            }
            iconFrames[0].scan(0, 0, iconFrames[0].bitmap.width, iconFrames[0].bitmap.height, function (x, y, idx) {
                if (y < this.bitmap.height - 1) {
                    if (eligibilityFunction(this, x, y)) {
                        if (seedGen() > 0.9) {
                            sparklePixels.push({ position: { x, y }, animationOffset: Math.floor(seedGen() * smallGlowAnimation.length) });
                        }
                    }
                }
            })
            iconFrames.forEach((frame, index) => {
                if (index !== 0) {
                    sparklePixels = sparklePixels.filter((dripPixel) => {
                        return eligibilityFunction(frame, dripPixel.position.x, dripPixel.position.y);
                    })
                }
            })


            let neededAnimationFrames = maths.leastCommonMultiple(smallGlowAnimation.length, iconFrames.length);

            let padding = Math.round(smallGlowAnimation[0].bitmap.width / 2);

            for (let newAnimationFrameIndex = 0; newAnimationFrameIndex < neededAnimationFrames; newAnimationFrameIndex++) {
                let newFrame = new Jimp(iconFrames[0].bitmap.width + (padding * 2), iconFrames[0].bitmap.height + (padding * 2), 0x00000000);
                for (let dripIndex = 0; dripIndex < sparklePixels.length; dripIndex++) {
                    const sparklePixel = sparklePixels[dripIndex];
                    const sparklePixelAnimationFrame = smallGlowAnimation[(newAnimationFrameIndex + sparklePixel.animationOffset) % smallGlowAnimation.length];
                    newFrame.composite(sparklePixelAnimationFrame, sparklePixel.position.x + 1, sparklePixel.position.y + 1);
                }
                const frameHeadPosition = headPositions[newAnimationFrameIndex % headPositions.length];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(glowHeadImage, cacheDirectory, frameHeadPosition, { x: 16, y: 24, width: 32 });
                prefixFrames.backFrames.push(headImagesThisFrame);
                prefixFrames.frontFrames.push([{
                    image: newFrame,
                    compositePosition: {
                        x: -padding,
                        y: -padding
                    }
                }])
            }

            prefixFrames.outlineFrames.push([{ width: 1, color: 0x40d2e5ff, layers: ["back", "front", "icon"] }, { width: 1, color: 0x3abdcfff, layers: ["back", "front", "icon"] }])

            return prefixFrames;
        }
    },
    "Mathematical": {
        name: "Mathematical",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Mathematical";
            let seedGen = new seedrandom(`mathematical${seed}`);
            const allNumbers = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/mathematical/numbers.png`), 10);
            const allOperators = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/mathematical/operators.png`), 10);
            // Plus, Minus, Multiply, Divide, Power, Equals
            const speechBubbleTail = await Jimp.read(`${prefixSourceDirectory}/mathematical/speechbubbletail.png`);

            const equationPartOne = Math.ceil(seedGen() * 100);
            const equationPartTwo = Math.ceil(seedGen() * 100);
            let possibleOperators = [0, 2, 4];
            if ((equationPartOne/equationPartTwo) % 1 == 0) { // Check if divides evenly
                possibleOperators.push(3);
            }
            if (equationPartOne > equationPartTwo) { // Check if subtracts into positive number
                possibleOperators.push(1);
            }
            if (String(equationPartOne ** equationPartTwo).length > 9 || String(equationPartOne ** equationPartTwo).includes('e')) { // Check if the power operation won't result in REALLY BIG ASS NUMBER
                possibleOperators = possibleOperators.filter(op => op !== 4);
            }
            if (equationPartOne < 20 && equationPartTwo < 20) { // If they're both small numbers, remove addition
                possibleOperators = possibleOperators.filter(op => op !== 0);
            }
            const equationOperation = possibleOperators[Math.floor(seedGen() * possibleOperators.length)];
            
            let equationResult = 0;
            switch (equationOperation) {
                case 0: // Add
                    equationResult = equationPartOne + equationPartTwo;
                    break;
                case 1: // Subtract
                    equationResult = equationPartOne - equationPartTwo;
                    break;
                case 2: // Multiply
                    equationResult = equationPartOne * equationPartTwo;
                    break;
                case 3: // Divide
                    equationResult = equationPartOne / equationPartTwo;
                    break;
                case 4: // Power
                    equationResult = equationPartOne ** equationPartTwo;
                    break;
                default:
                    console.log("Unknown Operation?", equationOperation)
                    break;
            }

            const characterSpacing = 1;
            const firstLineLength = `${equationPartOne}o${equationPartTwo}=${equationResult}`.length;
            
            const characterWidth = allNumbers[0].bitmap.width;
            const characterHeight = allNumbers[0].bitmap.height;
            const imageWidth = (firstLineLength * characterWidth) + ((firstLineLength - 1) * characterSpacing) + (characterSpacing * 2);
            const imageHeight = (characterHeight) + (characterSpacing * 2) + speechBubbleTail.bitmap.height;

            const newFrame = new Jimp(imageWidth, imageHeight, 0x00000000);
            newFrame.composite(speechBubbleTail, 0, 0);
            fillRect(newFrame, 0, speechBubbleTail.bitmap.height, newFrame.bitmap.width, newFrame.bitmap.height - speechBubbleTail.bitmap.height, speechBubbleTail.getPixelColor(0, 3));

            let xPosition = 0;
            let yPosition = 0;
            `${equationPartOne}`.split('').forEach(number => {
                let num = Number(number);
                newFrame.composite(allNumbers[num], (xPosition * characterWidth) + ((xPosition + 1) * characterSpacing), speechBubbleTail.bitmap.height + (yPosition * characterHeight) + ((yPosition + 1) * characterSpacing));
                xPosition++;
            })
            newFrame.composite(allOperators[equationOperation], (xPosition * characterWidth) + ((xPosition + 1) * characterSpacing), speechBubbleTail.bitmap.height + (yPosition * characterHeight) + ((yPosition + 1) * characterSpacing))
            xPosition++;
            `${equationPartTwo}`.split('').forEach(number => {
                let num = Number(number);
                newFrame.composite(allNumbers[num], (xPosition * characterWidth) + ((xPosition + 1) * characterSpacing), speechBubbleTail.bitmap.height + (yPosition * characterHeight) + ((yPosition + 1) * characterSpacing));
                xPosition++;
            })
            newFrame.composite(allOperators[5], (xPosition * characterWidth) + ((xPosition + 1) * characterSpacing), speechBubbleTail.bitmap.height + (yPosition * characterHeight) + ((yPosition + 1) * characterSpacing));
            xPosition++;
            `${equationResult}`.split('').forEach(number => {
                let num = Number(number);
                console.log(number)
                newFrame.composite(allNumbers[num], (xPosition * characterWidth) + ((xPosition + 1) * characterSpacing), speechBubbleTail.bitmap.height + (yPosition * characterHeight) + ((yPosition + 1) * characterSpacing));
                xPosition++;
            });

            let outerStrokeWidth = 1;
            const outerStrokeColor = 0x616161ff;
            let innerStrokeWidth = 1;
            const innerStrokeColor = 0x6b6b6bff;
            prefixFrames.frontFrames.push([{
                image: strokeImage(strokeImage(newFrame, innerStrokeColor, innerStrokeWidth), outerStrokeColor, outerStrokeWidth),
                compositePosition: {
                    x: Math.floor((iconFrames[0].bitmap.width-newFrame.bitmap.width)/2) - outerStrokeWidth - innerStrokeWidth,
                    y: iconFrames[0].bitmap.height + 3 + outerStrokeWidth + innerStrokeWidth
                }
            }])

            // prefixFrames.outlineFrames.push([{ width: innerStrokeWidth, color: innerStrokeColor, layers: ["back", "front", "icon"] }, { width: outerStrokeWidth, color: outerStrokeColor, layers: ["back", "front", "icon"] }])

            return prefixFrames;
        }
    },
    "Wanted": {
        name: "Wanted",
        tags: ["seeded", "appliesDirectlyAfterAllPrefixes"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Wanted";
            let seedGen = new seedrandom(`wanted${seed}`);

            let neededWords: string[] = [''];
            const wordLengthCutoff = 6;
            const posterBackgroundColor = 0xd9bfb6ff;
            const posterBorderColor = 0x9e8177ff;
            const posterTextColor = 0x9e8177ff;
            
            cubeData.name.toUpperCase().split('').forEach(character => {
                const modifyingIndex = neededWords.length - 1;
                if (character === ' ' && neededWords[modifyingIndex].length >= wordLengthCutoff) {
                    neededWords.push('');
                } else {
                    neededWords[modifyingIndex] = `${neededWords[modifyingIndex]}${character}`
                }
            })

            let wordImages: Jimp[] = [];

            for (let wordIndex = 0; wordIndex < neededWords.length; wordIndex++) {
                const word = neededWords[wordIndex];
                wordImages.push(await generateSmallWordImage(word, 0x00000000, posterTextColor, 1));
            }

            const wantedPosterName = new Jimp(Math.max(...wordImages.map(image => image.bitmap.width)), wordImages.reduce((prev, curr) => {
                return prev + curr.bitmap.height;
            }, 0), 0x00000000);

            wordImages.forEach((image, index) => {
                wantedPosterName.composite(image, (wantedPosterName.bitmap.width-image.bitmap.width) / 2, index * image.bitmap.height);
            })

            const wantedPosterTitle = await Jimp.read(`${prefixSourceDirectory}/wanted/postertitle.png`);

            const wantedPosterBaseWidth = Math.max(wantedPosterName.bitmap.width, iconFrames[0].bitmap.width, wantedPosterTitle.bitmap.width);

            let cubeTextDistance = 6;
            let cubeTitleDistance = 5;
            const posterPadding = 5;
            
            const wantedPosterBaseHeight = wantedPosterName.bitmap.height + cubeTextDistance + iconFrames[0].bitmap.height + cubeTitleDistance + wantedPosterTitle.bitmap.height;

            const wantedPosterSize = Math.max(wantedPosterBaseWidth, wantedPosterBaseHeight);
            
            if (wantedPosterBaseHeight < wantedPosterSize) {
                const leftoverPixels = wantedPosterSize - (wantedPosterName.bitmap.height + iconFrames[0].bitmap.height + wantedPosterTitle.bitmap.height);
                cubeTextDistance = Math.ceil(leftoverPixels/2);
                cubeTitleDistance = Math.floor(leftoverPixels/2);
            }

            const constructedPoster = new Jimp(wantedPosterSize, wantedPosterSize, posterBackgroundColor);

            let compositeYPostion = 0;
            constructedPoster.composite(wantedPosterTitle, (wantedPosterSize-wantedPosterTitle.bitmap.width)/2, compositeYPostion);
            compositeYPostion += wantedPosterTitle.bitmap.height;
            compositeYPostion += cubeTitleDistance;

            const cubeCompositeYPosition = compositeYPostion + posterPadding + 1;
            const cubeCompositeXPosition = (constructedPoster.bitmap.width - iconFrames[0].bitmap.width) / 2;

            compositeYPostion += iconFrames[0].bitmap.height;
            compositeYPostion += cubeTextDistance;

            constructedPoster.composite(wantedPosterName, (wantedPosterSize - wantedPosterName.bitmap.width) / 2, compositeYPostion);

            const completePoster = strokeImage(strokeImage(constructedPoster, posterBackgroundColor, posterPadding, false, [[1, 1, 1], [1, 0, 1], [1, 1, 1]]), posterBorderColor, 1, false, [[1, 1, 1], [1, 0, 1], [1, 1, 1]]);

            const ripsOnEachSide = [
                Math.round(seedGen() * (wantedPosterSize/5)) + 3,  // Top
                Math.round(seedGen() * (wantedPosterSize/5)) + 3,  // Right
                Math.round(seedGen() * (wantedPosterSize/5)) + 3,  // Bottom
                Math.round(seedGen() * (wantedPosterSize/5)) + 3,  // Left
            ]

            if (seedGen() < 0.99) {
                const ripImages = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/wanted/rips.png`), 4);
                const ripSize = ripImages[0].bitmap.width;
                const ripsInEachFrame = Math.floor(ripImages[0].bitmap.height/ripSize);

                for (let ripsOnEachSideIndex = 0; ripsOnEachSideIndex < ripsOnEachSide.length; ripsOnEachSideIndex++) {
                    const ripCount = ripsOnEachSide[ripsOnEachSideIndex];
                    for (let ripIndex = 0; ripIndex < ripCount; ripIndex++) {
                        let ripCompositeXPosition = 0;
                        let ripCompositeYPosition = 0;
                        const usingRip = Math.floor(seedGen() * ripsInEachFrame);
                        switch (ripsOnEachSideIndex) {
                            case 0:
                                ripCompositeXPosition = Math.round(seedGen() * (completePoster.bitmap.width));
                                break;
                            case 1:
                                ripCompositeXPosition = completePoster.bitmap.width - ripSize;
                                ripCompositeYPosition = Math.round(seedGen() * (completePoster.bitmap.height));
                                break;
                            case 2:
                                ripCompositeYPosition = completePoster.bitmap.height - ripSize;
                                ripCompositeXPosition = Math.round(seedGen() * (completePoster.bitmap.width));
                                break;
                            case 3:
                                ripCompositeYPosition = Math.round(seedGen() * (completePoster.bitmap.height));
                                break;
                            default:
                                break;
                        }
                        ripImages[ripsOnEachSideIndex % ripImages.length].scan(0, (ripSize * usingRip), ripSize, ripSize, function(x, y, idx) {
                            const pixelDestinationX = (x % ripSize) + ripCompositeXPosition;
                            const pixelDestinationY = (y % ripSize) + ripCompositeYPosition;
                            if (completePoster.bitmap.data[completePoster.getPixelIndex(pixelDestinationX, pixelDestinationY) + 3] > 0) {
                                completePoster.setPixelColor(this.getPixelColor(x, y), pixelDestinationX, pixelDestinationY)
                            }
                        })
                    }
                }
            }

            let shadowFrames: Jimp[] = [];
            iconFrames.forEach(frame => {
                const newShadowFrame = new Jimp(frame.bitmap.width, frame.bitmap.height, 0x00000000);
                frame.scan(0, 0, frame.bitmap.width, frame.bitmap.height, function(x, y, idx) {
                    if (this.bitmap.data[idx + 3] > 0) {
                        newShadowFrame.setPixelColor(0x000000ff, x, y);
                        newShadowFrame.bitmap.data[idx + 3] = this.bitmap.data[idx + 3];
                        newShadowFrame.bitmap.data[idx + 3] = Math.round(newShadowFrame.bitmap.data[idx + 3] * 0.4);
                    }
                })
                shadowFrames.push(newShadowFrame)
            })

            let shadowDistance = 3;
            iconFrames.forEach((frame, index) => {
                prefixFrames.maskFrames.push(completePoster.clone().composite(shadowFrames[index], posterPadding + 1 + cubeCompositeXPosition + shadowDistance, cubeCompositeYPosition + shadowDistance).composite(strokeImage(frame, 0x9e8177ff, 1, false, [[1, 1, 1], [1, 0, 1], [1, 1, 1]]), posterPadding + 1 + cubeCompositeXPosition, cubeCompositeYPosition));
            })

            return prefixFrames;
        }
    },
    "Onomatopoeiacal": {
        name: "Onomatopoeiacal",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Onomatopoeiacal";
            let seedGen = new seedrandom(`onomatopoeiacal${seed}`);

            const possibleOnomatos: string[] = [
                "BANG!",
                "POW!",
                "CRASH!",
                "WHAM!",
                "POP!",
                "WHOOSH!",
                "SQUELCH!",
                "BIFF!",
                "BAP!",
                "BOP!",
                "BRAAAP!",
                "!!!",
                "GROAN...",
                "...",
                "!?",
                "SCREECH!",
                "SCREAM!",
                "SCHLUCK?"
            ];
            const onomatoColorsImage = await Jimp.read(`${prefixSourceDirectory}/onomatopoeiacal/onomatocolors.png`);
            const possibleOnomatoColors: {
                text: number,
                border: number,
                shadow: number
            }[] = parseHorizontalSpriteSheet(onomatoColorsImage, onomatoColorsImage.bitmap.width).map(frame => {
                return {
                    text: frame.getPixelColor(0, 0),
                    border: frame.getPixelColor(0, 1),
                    shadow: frame.getPixelColor(0, 2)
                }
            });

            const onomatoDistance = 10;
            const onomatoCount = Math.ceil(seedGen() * Math.ceil(iconFrames[0].bitmap.height / onomatoDistance));
            const onomatos: {
                word: number,
                colors: number,
                position: CCOIcons.coordinate
            }[] = [];
            let iter = 0;
            while (onomatos.length < onomatoCount && iter < 100) {
                iter++;
                let constructedOnomato = {
                    word: Math.floor(seedGen() * possibleOnomatos.length),
                    colors: Math.floor(seedGen() * possibleOnomatoColors.length),
                    position: {
                        x: Math.round(seedGen() * iconFrames[0].bitmap.width),
                        y: Math.round(seedGen() * iconFrames[0].bitmap.height)
                    }
                }
                if (onomatos.findIndex(onomato => {
                    return onomato.word === constructedOnomato.word || maths.distanceBetweenPoints({x: 0, y: onomato.position.y}, {x: 0, y: constructedOnomato.position.y}) < onomatoDistance
                }) === -1) {
                    onomatos.push(constructedOnomato);
                }
            }
            const constructedFrontFrames: typeof prefixFrames["frontFrames"][number] = [];
            for (let onomatoIndex = 0; onomatoIndex < onomatos.length; onomatoIndex++) {
                const onomato = onomatos[onomatoIndex];
                const image = strokeImage(strokeImage(await generateSmallWordImage(possibleOnomatos[onomato.word], 0x00000000, possibleOnomatoColors[onomato.colors].text, 0), possibleOnomatoColors[onomato.colors].border, 1, false, [[1, 1, 1], [1, 0, 1], [1, 1, 1]]), possibleOnomatoColors[onomato.colors].shadow, 1, false, [[0, 0, 0], [0, 0, 0], [0, 0, 1]]);
                constructedFrontFrames.push({
                    image,
                    compositePosition: {
                        x: Math.round(onomato.position.x - (image.bitmap.width / 2)),
                        y: Math.round(onomato.position.y - (image.bitmap.height / 2))
                    }
                })
            }

            prefixFrames.frontFrames.push(constructedFrontFrames);

            return prefixFrames;
        }
    },
    "Smoked": {
        name: "Smoked",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed, cubeData) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Smoked";
            let seedGen = new seedrandom(`smoked${seed}`);

            const smokedSide = ((seedGen() > 0.25) ? "left" : "right");
            let smokedHatImage = await Jimp.read(`${prefixSourceDirectory}/smoked/smoked${smokedSide}.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/smoked${smokedSide}/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(smokedHatImage, cacheDirectory, frameHeadPosition, { x: 6, y: 13, width: 32 });
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Basking": {
        name: "Basking",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let headPositions = anchorPoints.heads;
            prefixFrames.sourceID = "Basking";

            let umbrellaImage = await Jimp.read(`${prefixSourceDirectory}/basking/baskingback.png`);
            let frontSandImage = await Jimp.read(`${prefixSourceDirectory}/basking/baskingfront.png`);

            let umbrellaDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/basking/umbrella/`);
            if (!fs.existsSync(umbrellaDirectory)) fs.mkdirSync(umbrellaDirectory, { recursive: true });
            let frontSandDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/basking/baskingfront/`);
            if (!fs.existsSync(frontSandDirectory)) fs.mkdirSync(frontSandDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];

                const unbrellaImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(umbrellaImage, umbrellaDirectory, frameHeadPosition, { x: 17, y: 24, width: 32 });
                prefixFrames.backFrames.push(unbrellaImagesThisFrame);

                const frontSandImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(frontSandImage, frontSandDirectory, frameHeadPosition, { x: 17, y: 24, width: 32 });
                prefixFrames.frontFrames.push(frontSandImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Omniscient": {
        name: "Omniscient",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed, cubeData) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Omniscient";

            let seedGen = new seedrandom(`omniscient${seed}`);
            let omniscientSpriteSheet = await Jimp.read(`${prefixSourceDirectory}/omniscient/animation.png`);
            let omniscientMask = await Jimp.read(`${prefixSourceDirectory}/omniscient/mask.png`);

            omniscientSpriteSheet.composite(
                omniscientSpriteSheet.clone().mask(omniscientMask, 0, 0).color([{apply: "hue", params: [360 * seedGen()]}])    
            , 0, 0)

            let omniscientFrames = parseHorizontalSpriteSheet(omniscientSpriteSheet, 15);

            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/omniscient/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });
            // We don't cache this prefix, but we'll make a cache directory just in case we need to in the future

            let neededAnimationFrames = maths.leastCommonMultiple(omniscientFrames.length, iconFrames.length);

            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrames; animationFrameIndex++) {
                const omniscientFrame = omniscientFrames[animationFrameIndex % omniscientFrames.length];
                const frameHeadData = headPositions[animationFrameIndex % headPositions.length];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(omniscientFrame, cacheDirectory, frameHeadData, { x: -3, y: 29, width: 32 }, false);
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Sniping": {
        name: "Sniping",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Sniping";
            
            let headPositions = anchorPoints.heads;
            let seedGen = new seedrandom(`sniping${seed}`);

            const rifles = ["tf2", "cs2"]
            const rifleType = ((seedGen() > 0.98) ? 'rare' : '') + rifles[Math.floor(seedGen() * rifles.length)];

            let sniperRifleImage = await Jimp.read(`${prefixSourceDirectory}/sniping/${rifleType}rifle.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/sniping/${rifleType}/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(sniperRifleImage, cacheDirectory, frameHeadPosition, { x: 29, y: 14, width: 32 });
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Beboppin'": {
        name: "Beboppin'",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Beboppin'";

            let cowboyWigImage = await Jimp.read(`${prefixSourceDirectory}/beboppin/hair.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/beboppin/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(cowboyWigImage, cacheDirectory, frameHeadPosition, { x: 12, y: 24, width: 32 });
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Hard-Boiled": {
        name: "Hard-Boiled",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Hard-Boiled";

            let holmesHatImage = await Jimp.read(`${prefixSourceDirectory}/hardboiled/hat.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/hardboiled/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(holmesHatImage, cacheDirectory, frameHeadPosition, { x: 6, y: 18, width: 32 });
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Angry": {
        name: "Angry",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Angry";

            let omniscientFrames = await loadAnimatedCubeIcon(`${prefixSourceDirectory}/angry/anger.png`);

            let seedGen = new seedrandom(`angry${seed}`);
            const animationOffset = Math.floor(omniscientFrames.length * seedGen())

            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/angry/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });
            // We don't cache this prefix, but we'll make a cache directory just in case we need to in the future

            let neededAnimationFrames = maths.leastCommonMultiple(omniscientFrames.length, iconFrames.length);

            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrames; animationFrameIndex++) {
                const angryFrame = omniscientFrames[(animationFrameIndex + animationOffset) % omniscientFrames.length];
                const frameHeadData = headPositions[animationFrameIndex % headPositions.length];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(angryFrame, cacheDirectory, frameHeadData, { x: (9) - 32, y: omniscientFrames[0].bitmap.height - 3, width: 32 }, false);
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Gruesome": {
        name: "Gruesome",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let headPositions = anchorPoints.heads;
            prefixFrames.sourceID = "Gruesome";

            let bloodBackImage = await Jimp.read(`${prefixSourceDirectory}/gruesome/backblood.png`);
            let bloodFrontImage = await Jimp.read(`${prefixSourceDirectory}/gruesome/frontblood.png`);

            let seedGen = new seedrandom(`gruesome${seed}`);
            const possibleMods: CCOIcons.JimpImgMod[][] = [
                [], [], [], [], [
                    {apply: "hue", params: [-61]}
                ]
            ];
            const usedMod = possibleMods[Math.floor(possibleMods.length * seedGen())]

            bloodBackImage.color(usedMod);
            bloodFrontImage.color(usedMod);

            let bloodBackDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/gruesome/backblood${seed}/`);
            if (!fs.existsSync(bloodBackDirectory)) fs.mkdirSync(bloodBackDirectory, { recursive: true });
            let bloodFrontDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/gruesome/frontblood${seed}/`);
            if (!fs.existsSync(bloodFrontDirectory)) fs.mkdirSync(bloodFrontDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];

                const backBloodImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(bloodBackImage, bloodBackDirectory, frameHeadPosition, { x: 4, y: 11, width: 32 });
                prefixFrames.backFrames.push(backBloodImagesThisFrame.map(item => {
                    item.preventOutline = true;
                    return item;
                }));

                const frontBloodImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(bloodFrontImage, bloodFrontDirectory, frameHeadPosition, { x: 4, y: 11, width: 32 });
                prefixFrames.frontFrames.push(frontBloodImagesThisFrame.map(item => {
                    item.preventOutline = true;
                    return item;
                }));
            }

            return prefixFrames;
        }
    },
    "Outlawed": {
        name: "Outlawed",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let headPositions = anchorPoints.heads;
            prefixFrames.sourceID = "Outlawed";

            let bandannaBackImage = await Jimp.read(`${prefixSourceDirectory}/outlawed/back.png`);
            let bandannaFrontImage = await Jimp.read(`${prefixSourceDirectory}/outlawed/front.png`);

            let seedGen = new seedrandom(`outlawed${seed}`);

            const imageMod: CCOIcons.JimpImgMod[] = [
                { apply: "hue", params: [360 * seedGen()] }
            ];

            bandannaBackImage.color(imageMod);
            bandannaFrontImage.color(imageMod);

            let bandannaBackDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/outlawed${seed}/back/`);
            if (!fs.existsSync(bandannaBackDirectory)) fs.mkdirSync(bandannaBackDirectory, { recursive: true });
            let bandannaFrontDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/outlawed${seed}/front/`);
            if (!fs.existsSync(bandannaFrontDirectory)) fs.mkdirSync(bandannaFrontDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];

                const backBandannaImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(bandannaBackImage, bandannaBackDirectory, frameHeadPosition, { x: 5, y: 8, width: 32 });
                prefixFrames.backFrames.push(backBandannaImagesThisFrame);

                const frontBandannaImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(bandannaFrontImage, bandannaFrontDirectory, frameHeadPosition, { x: 5, y: 8, width: 32 });
                prefixFrames.frontFrames.push(frontBandannaImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Wranglin'": {
        name: "Wranglin'",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Wranglin'";

            let wranglinHatImage = await Jimp.read(`${prefixSourceDirectory}/wranglin/hat.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/wranglin/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(wranglinHatImage, cacheDirectory, frameHeadPosition, { x: 8, y: 21, width: 32 });
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Canoodled": {
        name: "Canoodled",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Canoodled";

            let baseFrame = new Jimp(iconFrames[0].bitmap.width, iconFrames[0].bitmap.height, 0x00000000);

            let seedGen = new seedrandom(`canoodled${seed}`);
            const validHueShifts = [0, 0, 0, 0, 0,
                77,
                -159,
                -86
            ];

            let baseKissImage = await Jimp.read(`${prefixSourceDirectory}/canoodled/kissmask.png`);
            baseKissImage.color([{
                apply: "hue",
                params: [validHueShifts[Math.floor(validHueShifts.length * seedGen())]]
            }])

            const baseKisses = Math.ceil(((iconFrames[0].bitmap.width * iconFrames[0].bitmap.height) / 1024) * 2);
            const kissesOnFrame = baseKisses + Math.round(seedGen() * baseKisses);

            const kissPositionDeadZone = 0.1;
            const kissPositionOffset = baseFrame.bitmap.width * kissPositionDeadZone;
            const kissPositionRange = baseFrame.bitmap.width * (1-(kissPositionDeadZone * 2));
            const maxRotation = 60;

            const kissPositions: CCOIcons.coordinate[] = [];
            const minKissDistance = 15;
            let loopTimes = 0;
            for (let kissIndex = 0; kissIndex < kissesOnFrame && loopTimes < 100; kissIndex++) {
                loopTimes++;
                let newKissPosition = {
                    x: Math.round(kissPositionOffset + (seedGen() * kissPositionRange) - (baseKissImage.bitmap.width / 2)),
                    y: Math.round(kissPositionOffset + (seedGen() * kissPositionRange) - (baseKissImage.bitmap.width / 2))
                };
                if (kissPositions.find(position => maths.distanceBetweenPoints(position, newKissPosition) < minKissDistance)) {
                    kissIndex--;
                } else {
                    kissPositions.push(newKissPosition);
                    let newKissImage = baseKissImage.clone().rotate(Math.round((maxRotation * seedGen()) - (maxRotation / 2)));
                    baseFrame.composite(newKissImage, newKissPosition.x, newKissPosition.y);
                }
            }
            const shadowSize = 1;
            baseFrame = strokeImage(baseFrame, 0x00000022, shadowSize, false, [[0, 1, 0], [1, 0, 1], [0, 1, 0]]);
            baseFrame.crop(shadowSize, shadowSize, baseFrame.bitmap.width-(shadowSize*2), baseFrame.bitmap.height-(shadowSize*2));
            for (let iconFrameIndex = 0; iconFrameIndex < iconFrames.length; iconFrameIndex++) {
                const iconFrame = iconFrames[iconFrameIndex];
                const maskedKissFrame = baseFrame.clone();
                iconFrame.scan(0, 0, iconFrame.bitmap.width, iconFrame.bitmap.height, function(x, y, idx) {
                    if (this.bitmap.data[idx + 3] === 0) {
                        maskedKissFrame.setPixelColor(0x00000000, x, y);
                    }
                });
                prefixFrames.frontFrames.push([{
                    image: maskedKissFrame,
                    compositePosition: {
                        x: 0,
                        y: 0
                    },
                    preventOutline: true
                }]);
            }
            return prefixFrames;
        }
    },
    "Saiyan": {
        name: "Saiyan",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Saiyan";

            let saiyanFrames = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/saiyan/glowsprites.png`), 5);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/saiyan/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });
            // We don't cache this prefix, but we'll make a cache directory just in case we need to in the future

            let neededAnimationFrames = maths.leastCommonMultiple(saiyanFrames.length, iconFrames.length);

            const headPositions = anchorPoints.heads;

            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrames; animationFrameIndex++) {
                const flamingFrame = saiyanFrames[animationFrameIndex % saiyanFrames.length];
                const frameHeadData = headPositions[animationFrameIndex % headPositions.length];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(flamingFrame, cacheDirectory, frameHeadData, { x: 16, y: 32, width: 32 }, false);
                prefixFrames.backFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Amorous": {
        name: "Amorous",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Amorous";

            let seedGen = new seedrandom(`amorous${seed}`);
            
            let heartFrames = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/amorous/heartanim.png`), 15);
            
            const validHueShifts = [0, 0, 0, 0, 0,
                77,
                -159,
                -86
            ];
            const usingShift = validHueShifts[Math.floor(validHueShifts.length * seedGen())];
            heartFrames.forEach(frame => {
                frame.color([{apply: "hue", params: [usingShift]}])
            })

            let heartOffsets: number[] = [];
            let failsafe = 0;
            while (heartOffsets.length < 4) {
                let possibleOffset = Math.floor(heartFrames.length * seedGen());
                failsafe++;
                if (!heartOffsets.find(offset => Math.abs(offset - possibleOffset) <= 2) || failsafe > 100) {
                    heartOffsets.push(possibleOffset);
                }
            }

            let neededAnimationFrames = maths.leastCommonMultiple(heartFrames.length, iconFrames.length);

            const headPositions = anchorPoints.heads;

            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/amorous${seed}/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrames; animationFrameIndex++) {
                const frameHeadData = headPositions[animationFrameIndex % headPositions.length];
                const rightHeartImages: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(heartFrames[(animationFrameIndex + heartOffsets[0]) % heartFrames.length], cacheDirectory, frameHeadData, { x: 6 - 32, y: 11, width: 32 }, false);
                const centerHeartImages: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(heartFrames[(animationFrameIndex + heartOffsets[1]) % heartFrames.length], cacheDirectory, frameHeadData, { x: 16 - 32, y: 15, width: 32 }, false);
                const otherCenterHeartImages: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(heartFrames[(animationFrameIndex + heartOffsets[2]) % heartFrames.length], cacheDirectory, frameHeadData, { x: 27 - 32, y: 15, width: 32 }, false);
                const leftHeartImages: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(heartFrames[(animationFrameIndex + heartOffsets[3]) % heartFrames.length], cacheDirectory, frameHeadData, { x: 37 - 32, y: 11, width: 32 }, false);
                prefixFrames.frontFrames.push([...rightHeartImages, ...centerHeartImages, ...otherCenterHeartImages, ...leftHeartImages]);
            }

            return prefixFrames
        }
    },
    "Dazed": {
        name: "Dazed",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Dazed";

            let seedGen = new seedrandom(`dazed${seed}`);
            const validRotations = [0, 90, 180, 270];

            let dazedFrames = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/dazed/dazedanim.png`), 15);

            const validHueShifts = [0,
                47,
                135,
                180,
                -120,
                -80,
                -50
            ];
            const usingShift = validHueShifts[Math.floor(validHueShifts.length * seedGen())];
            dazedFrames.forEach(frame => {
                frame.color([{ apply: "hue", params: [usingShift] }])
            })

            let dazedOffsets: number[] = [];
            let failsafe = 0;
            while (dazedOffsets.length < 4) {
                let possibleOffset = Math.floor(dazedFrames.length * seedGen());
                failsafe++;
                if (!dazedOffsets.find(offset => Math.abs(offset - possibleOffset) <= 2) || failsafe > 100) {
                    dazedOffsets.push(possibleOffset);
                }
            }

            const dazedRotations = [
                validRotations[Math.floor(validRotations.length * seedGen())],
                validRotations[Math.floor(validRotations.length * seedGen())],
                validRotations[Math.floor(validRotations.length * seedGen())],
                validRotations[Math.floor(validRotations.length * seedGen())]
            ]

            let neededAnimationFrames = maths.leastCommonMultiple(dazedFrames.length, iconFrames.length);

            const headPositions = anchorPoints.heads;

            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/amorous${seed}/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrames; animationFrameIndex++) {
                const frameHeadData = headPositions[animationFrameIndex % headPositions.length];
                const rightDazedImages: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(dazedFrames[(animationFrameIndex + dazedOffsets[0]) % dazedFrames.length].clone().rotate(dazedRotations[0]), cacheDirectory, frameHeadData, { x: 6 - 32, y: 11, width: 32 }, false);
                const centerDazedImages: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(dazedFrames[(animationFrameIndex + dazedOffsets[1]) % dazedFrames.length].clone().rotate(dazedRotations[1]), cacheDirectory, frameHeadData, { x: 16 - 32, y: 15, width: 32 }, false);
                const otherCenterDazedImages: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(dazedFrames[(animationFrameIndex + dazedOffsets[2]) % dazedFrames.length].clone().rotate(dazedRotations[2]), cacheDirectory, frameHeadData, { x: 27 - 32, y: 15, width: 32 }, false);
                const leftDazedImages: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(dazedFrames[(animationFrameIndex + dazedOffsets[3]) % dazedFrames.length].clone().rotate(dazedRotations[3]), cacheDirectory, frameHeadData, { x: 37 - 32, y: 11, width: 32 }, false);
                prefixFrames.frontFrames.push([...rightDazedImages, ...centerDazedImages, ...otherCenterDazedImages, ...leftDazedImages]);
            }

            return prefixFrames
        }
    },
    "Frosty": {
        name: "Frosty",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Frosty";

            let frostImage = await Jimp.read(`${prefixSourceDirectory}/frosty/frost.png`);
            let seedGen = new seedrandom(`frosty${seed}`);
            const Xoffset = Math.floor(seedGen() * frostImage.bitmap.width);
            const Yoffset = Math.floor(seedGen() * frostImage.bitmap.height);

            iconFrames.forEach(frame => {
                let newFrostFrame = new Jimp(frame.bitmap.width, frame.bitmap.height, 0x00000000);
                frame.scan(0, 0, frame.bitmap.width, frame.bitmap.height, function(x, y, idx) {
                    if (this.bitmap.data[idx + 3] > 0) {
                        newFrostFrame.setPixelColor(frostImage.getPixelColor((x + Xoffset) % frostImage.bitmap.width, (y + Yoffset) % frostImage.bitmap.height), x, y);
                        newFrostFrame.bitmap.data[idx + 3] = Math.ceil((this.bitmap.data[idx + 3] + newFrostFrame.bitmap.data[idx + 3])/2);
                    }
                })
                prefixFrames.frontFrames.push([{image: newFrostFrame, preventOutline: true, compositePosition: {x: 0, y: 0}}]);
            })

            let possibleOutlines = [
                0x2bc2daff,
                0x8cdeeaff,
                0x197f8fff
            ];

            prefixFrames.outlineFrames.push([{
                width: 1,
                color: possibleOutlines[Math.floor(possibleOutlines.length * seedGen())],
                matrix: [
                    [1, 1, 1],
                    [1, 0, 1],
                    [1, 1, 1],
                ],
                layers: ["icon"]
            }])

            return prefixFrames;
        }
    },
    "Electrified": {
        name: "Electrified",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Electrified";
            let seedGen = new seedrandom(`electrified${seed}`);

            let electrifiedMultiplier = iconFrames[0].bitmap.width / 32;
            let electrifiedPositions = generateSparsePositions(Math.ceil((3 * electrifiedMultiplier) + (seedGen() * 4 * (electrifiedMultiplier ** 2))), iconFrames[0].bitmap.width / 3, seedGen, {width: iconFrames[0].bitmap.width, height: iconFrames[0].bitmap.height});
            
            electrifiedPositions = electrifiedPositions.filter(position => {
                return iconFrames[0].bitmap.data[iconFrames[0].getPixelIndex(position.x, position.y) + 3] > 0
            })

            let electrifiedOffsets: number[] = [];
            electrifiedPositions.forEach(() => {
                electrifiedOffsets.push(Math.floor(seedGen() * 15));
            });

            let electrifiedRotations: number[] = [];
            electrifiedPositions.forEach(() => {
                electrifiedRotations.push(Math.floor(seedGen() * 4) * 90);
            });

            const possibleFilters: CCOIcons.JimpImgMod[][] = [
                [
                    {
                        apply: "hue",
                        params: [180]
                    }
                ],
                [
                    {
                        apply: "hue",
                        params: [108]
                    }
                ],
                [
                    {
                        apply: "hue",
                        params: [0]
                    }
                ],
                [
                    {
                        apply: "hue",
                        params: [-65]
                    }
                ]
            ];
            const electrifiedColor = possibleFilters[Math.floor(seedGen() * possibleFilters.length)]

            const lightningFrames = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/electrified/lightning.png`), 15)
            lightningFrames.forEach(frame => frame.color(electrifiedColor));

            const lightningStrokeColor = new Jimp(1, 1, lightningFrames[0].getPixelColor(0, 20)).color([{apply: "darken", params: [25]}]).getPixelColor(0, 0);
            const compositeSizeOffset = Math.floor(lightningFrames[0].bitmap.width/2);
            for (let electrifiedFrameIndex = 0; electrifiedFrameIndex < lightningFrames.length; electrifiedFrameIndex++) {
                let constructedFrame: typeof prefixFrames["frontFrames"][number] = [];
                for (let electrifiedPositionIndex = 0; electrifiedPositionIndex < electrifiedPositions.length; electrifiedPositionIndex++) {
                    const lightningFrame = lightningFrames[(electrifiedFrameIndex + electrifiedOffsets[electrifiedPositionIndex]) % lightningFrames.length];
                    const electrifiedPosition = electrifiedPositions[electrifiedPositionIndex];
                    const electrifiedRotation = electrifiedRotations[electrifiedPositionIndex];
                    constructedFrame.push({
                        image: strokeImage(lightningFrame.clone().rotate(electrifiedRotation, false), lightningStrokeColor, 1, false, [[0, 0, 0], [0, 0, 0], [0, 1, 0]]),
                        compositePosition: {
                            x: Math.round(electrifiedPosition.x - compositeSizeOffset),
                            y: Math.round(electrifiedPosition.y - compositeSizeOffset)
                        }
                    })
                }
                prefixFrames.frontFrames.push(constructedFrame);
            }

            prefixFrames.outlineFrames.push([{
                width: 2,
                color: lightningStrokeColor,
                layers: ["icon"],
                matrix: [
                    [0, 1, 0],
                    [1, 0, 1],
                    [0, 1, 0],
                ]
            }]);

            return prefixFrames;
        }
    },
    "Overcast": {
        name: "Overcast",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let headPositions = anchorPoints.heads;
            prefixFrames.sourceID = "Overcast";


            let seedGen = new seedrandom(`overcast${seed}`);

            let backCloudsImage = await Jimp.read(`${prefixSourceDirectory}/overcast/backclouds.png`);
            let frontCloudsImage = await Jimp.read(`${prefixSourceDirectory}/overcast/frontclouds.png`);

            if (seedGen() > 0.5) {
                backCloudsImage.flip(true, false);
            }
            if (seedGen() > 0.5) {
                frontCloudsImage.flip(true, false);
            }

            let backCloudsDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/overcast/backclouds${seed}/`);
            if (!fs.existsSync(backCloudsDirectory)) fs.mkdirSync(backCloudsDirectory, { recursive: true });
            let frontCloudsDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/overcast/frontclouds${seed}/`);
            if (!fs.existsSync(frontCloudsDirectory)) fs.mkdirSync(frontCloudsDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];

                const backCloudImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(backCloudsImage, backCloudsDirectory, frameHeadPosition, { x: 8, y: 16, width: 32 });
                prefixFrames.backFrames.push(backCloudImagesThisFrame);

                const frontCloudImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(frontCloudsImage, frontCloudsDirectory, frameHeadPosition, { x: 8, y: 16, width: 32 });
                prefixFrames.frontFrames.push(frontCloudImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Bladed": {
        name: "Bladed",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Bladed";
            let headPositions = anchorPoints.heads;

            let seedGen = new seedrandom(`bladed${seed}`);
            let swordImage = await Jimp.read(`${prefixSourceDirectory}/bladed/sword${Math.floor(seedGen() * 6)}.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/bladed${seed}/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(swordImage, cacheDirectory, frameHeadPosition, { x: 14, y: 26, width: 32 });
                prefixFrames.backFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Jolly": {
        name: "Jolly",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Jolly";
            let headPositions = anchorPoints.heads;

            let hatImage = await Jimp.read(`${prefixSourceDirectory}/jolly/phyrgiancap.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/jolly/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(hatImage, cacheDirectory, frameHeadPosition, { x: 8, y: 16, width: 32 });
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Partying": {
        name: "Partying",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Partying";
            let headPositions = anchorPoints.heads;

            const shadowSize = 1;
            let seedGen = new seedrandom(`partying${seed}`);
            let hatImage = await Jimp.read(`${prefixSourceDirectory}/partying/base.png`);
            hatImage = strokeImage(hatImage, 0x00000022, shadowSize, false, [
                [0, 0, 0],
                [0, 0, 0],
                [0, 1, 0]
            ]);

            let embellishmentImages = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/partying/embellishments.png`), 4);
            hatImage.composite(embellishmentImages[Math.floor(seedGen() * embellishmentImages.length)], shadowSize, shadowSize);

            let stripeImages = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/partying/stripes.png`), 4);
            hatImage.composite(stripeImages[Math.floor(seedGen() * stripeImages.length)], shadowSize, shadowSize);

            let topperImages = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/partying/toppers.png`), 4);
            hatImage.composite(topperImages[Math.floor(seedGen() * topperImages.length)], shadowSize, shadowSize);

            hatImage.color([
                {
                    apply: "hue",
                    params: [Math.round(360 * seedGen())]
                }
            ])

            hatImage.composite(await Jimp.read(`${prefixSourceDirectory}/partying/shading.png`), shadowSize, shadowSize);
            hatImage.composite(await Jimp.read(`${prefixSourceDirectory}/partying/sparkles.png`), shadowSize, shadowSize);

            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/jolly/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(hatImage, cacheDirectory, frameHeadPosition, { x: -6, y: 24, width: 32 });
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Sophisticated": {
        name: "Sophisticated",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Sophisticated";
            let headPositions = anchorPoints.heads;

            let hatImage = await Jimp.read(`${prefixSourceDirectory}/sophisticated/tophat.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/sophisticated/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(hatImage, cacheDirectory, frameHeadPosition, { x: 8, y: 24, width: 32 });
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Culinary": {
        name: "Culinary",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Culinary";
            let headPositions = anchorPoints.heads;

            let hatImage = await Jimp.read(`${prefixSourceDirectory}/culinary/toque.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/culinary/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(hatImage, cacheDirectory, frameHeadPosition, { x: 8, y: 34, width: 32 });
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Eudaemonic": {
        name: "Eudaemonic",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Eudaemonic";
            let headPositions = anchorPoints.heads;

            if (!allPrefixes.includes("Thinking")) {
                let animation = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/eudaemonic/speechbubble.png`), 10);
    
                const bubbleDistance = 7;
                for (let animationFrameIndex = 0; animationFrameIndex < animation.length; animationFrameIndex++) {
                    const animationFrame = animation[animationFrameIndex];
                    const constructedFrames: typeof prefixFrames["frontFrames"][number] = [];
                    for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                        const headFrame = headPositions[headFrameIndex];
                        headFrame.positions.forEach(head => {
                            constructedFrames.push({
                                image: animationFrame,
                                compositePosition: {
                                    x: head.startPosition.x + head.width + Math.round(head.width / bubbleDistance),
                                    y: head.startPosition.y - Math.round(head.width / bubbleDistance) - animation[0].bitmap.height
                                }
                            })
                        })
                    }
                    prefixFrames.frontFrames.push(constructedFrames)
                }
            }

            return prefixFrames;
        }
    },
    "Magical": {
        name: "Magical",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Magical";

            let headPositions = anchorPoints.heads;
            let seedGen = new seedrandom(`magical${seed}`);
            const hatType = ((seedGen() > 0.98) ? 'rare' : 'common');

            let wizardHatImage = await Jimp.read(`${prefixSourceDirectory}/magical/${hatType}.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/magical/${hatType}/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(wizardHatImage, cacheDirectory, frameHeadPosition, { x: 12, y: 25, width: 32 });
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }
            return prefixFrames;
        }
    },
    "Blushing": {
        name: "Blushing",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Blushing";

            let headPositions = anchorPoints.heads;
            let seedGen = new seedrandom(`blushing${seed}`);
            const blushType = Math.floor(seedGen() * 2);

            let blushMakeupImage = await Jimp.read(`${prefixSourceDirectory}/blushing/${blushType}.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/blushing/type${blushType}/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(blushMakeupImage, cacheDirectory, frameHeadPosition, { x: 0, y: 0, width: 32 });
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }
            return prefixFrames;
        }
    },
    "Sweetened": {
        name: "Sweetened",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Sweetened";
            let headPositions = anchorPoints.heads;

            let cherryImage = await Jimp.read(`${prefixSourceDirectory}/sweetened/cherry.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/sweetened/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(cherryImage, cacheDirectory, frameHeadPosition, { x: 0, y: 19, width: 32 });
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Dovey": {
        name: "Dovey",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Dovey";

            let headPositions = anchorPoints.heads;
            let seedGen = new seedrandom(`dovey${seed}`);
            const birdType = ((seedGen() > 0.99) ? 'rare' : 'common');

            let birdImage = await Jimp.read(`${prefixSourceDirectory}/dovey/${birdType}.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/dovey/${birdType}/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(birdImage, cacheDirectory, frameHeadPosition, { x: 17, y: 42, width: 32 });
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }
            return prefixFrames;
        }
    },
    "Batty": {
        name: "Batty",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Batty";
            let headPositions = anchorPoints.heads;

            let batImage = await Jimp.read(`${prefixSourceDirectory}/batty/bat.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/batty/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(batImage, cacheDirectory, frameHeadPosition, { x: 0, y: 8, width: 32 });
                prefixFrames.backFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Streaming": {
        name: "Streaming",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let headPositions = anchorPoints.heads;
            prefixFrames.sourceID = "Streaming";

            let seedGen = new seedrandom(`streaming${seed}`);

            const headphoneVariant = Math.floor(seedGen() * 2);

            let backHeadphonesImage = await Jimp.read(`${prefixSourceDirectory}/streaming/h${headphoneVariant}b.png`);
            let frontHeadphonesImage = await Jimp.read(`${prefixSourceDirectory}/streaming/h${headphoneVariant}f.png`);

            if (headphoneVariant === 1) {
                const shift = Math.floor(seedGen() * 360);

                backHeadphonesImage.color([{
                    apply: "hue",
                    params: [shift]
                }])
                frontHeadphonesImage.color([{
                    apply: "hue",
                    params: [shift]
                }])
            }

            let musicImage = new Jimp(1, 1, 0x00000000);
            let notesDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/streaming/musicnotes${seed}/`);
            if (seedGen() > 0.9) {
                if (!fs.existsSync(notesDirectory)) fs.mkdirSync(notesDirectory, { recursive: true });
                musicImage = new Jimp(42, 42, 0x00000000);
                const notes = parseHorizontalSpriteSheet((await Jimp.read(`${prefixSourceDirectory}/streaming/notes.png`)).color([{apply: "hue", params: [Math.floor(360 * seedGen())]}]), 3);
                const positions = [
                    {
                        x: 29 - 7,
                        y: 26
                    },
                    {
                        x: 38 - 3,
                        y: 20
                    },
                    {
                        x: 39 - 3,
                        y: 35
                    }
                ];
                positions.forEach(pos => {
                    musicImage.composite(notes[Math.floor(seedGen() * notes.length)], pos.x - Math.ceil(notes[0].bitmap.width/2), pos.y - Math.ceil(notes[0].bitmap.width/2))
                });
            }

            let backHeadphonesDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/streaming/backheadphones${seed}/`);
            if (!fs.existsSync(backHeadphonesDirectory)) fs.mkdirSync(backHeadphonesDirectory, { recursive: true });
            let frontHeadphonesDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/streaming/frontheadphones${seed}/`);
            if (!fs.existsSync(frontHeadphonesDirectory)) fs.mkdirSync(frontHeadphonesDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];

                const backHeadphoneImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(backHeadphonesImage, backHeadphonesDirectory, frameHeadPosition, { x: 5, y: 13, width: 32 });
                prefixFrames.backFrames.push(backHeadphoneImagesThisFrame);

                let frontFrames: CCOIcons.compiledPrefixFrames["frontFrames"][number] = [];
                if (musicImage.bitmap.width > 1) {
                    frontFrames.push({
                        image: musicImage,
                        compositePosition: {
                            x: iconFrames[0].bitmap.width - Math.floor(musicImage.bitmap.width/2),
                            y: -Math.floor(musicImage.bitmap.height/2)
                        }
                    })
                }
                const frontHeadphoneImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(frontHeadphonesImage, frontHeadphonesDirectory, frameHeadPosition, { x: 5, y: 13, width: 32 });
                prefixFrames.frontFrames.push([...frontHeadphoneImagesThisFrame, ...frontFrames]);
            }

            return prefixFrames;
        }
    },
    "Clapping": {
        name: "Clapping",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Clapping";

            let clappingFrames = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/clapping/clap.png`), 5);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/clapping/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });
            // We don't cache this prefix, but we'll make a cache directory just in case we need to in the future

            let neededAnimationFrames = maths.leastCommonMultiple(clappingFrames.length, iconFrames.length);

            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrames; animationFrameIndex++) {
                const clappingFrame = clappingFrames[animationFrameIndex % clappingFrames.length];
                const frameHeadData = headPositions[animationFrameIndex % headPositions.length];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(clappingFrame, cacheDirectory, frameHeadData, { x: 16, y: -7, width: 32 }, false);
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Musical": {
        name: "Musical",
        tags: ["seeded", "appliesDirectlyAfterAllPrefixes"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Musical";

            let seedGen = new seedrandom(`musical${seed}`);
            const prefixFrameLength = 30;
            const colorRotation = 360 * seedGen();
            const noteImages = parseHorizontalSpriteSheet((await Jimp.read(`${prefixSourceDirectory}/musical/notes.png`)).color([
                { apply: "hue", params: [colorRotation] }
            ]), 5);
            const notes: {
                noteImage: number,
                track: 0 | 1 | 2
            }[] = [];
            const noteSpeed = ((Math.floor(seedGen() * 3)) || -1) as (-1 | 1 | 2);
            
            const universalNoteOffset = seedGen();

            const noteCount = Math.ceil(seedGen() * ((iconFrames[0].bitmap.width)/(noteImages[0].bitmap.width * 1.3)));

            while (notes.length < noteCount) {
                notes.push({
                    noteImage: Math.floor(seedGen() * noteImages.length),
                    track: Math.floor(seedGen() * 3) as (0 | 1 | 2)
                })
            }

            const size = iconFrames[0].bitmap.height/6;
            function sinPosition(x: number, t: number) {
                const timeScale = 1;
                return Math.round(size * Math.sin(((x/size) - (2 * Math.PI * ((t * timeScale) % 1)))) + (iconFrames[0].bitmap.height/2));
            }

            const colorImage = new Jimp(1, 2, 0x3e3e3eff);
            colorImage.setPixelColor(0x2c2c2cff, 0, 1);

            const noteSizeCentering = noteImages[0].bitmap.width/2;
            const neededFrames = maths.leastCommonMultiple(iconFrames.length, prefixFrameLength);

            for (let animationFrameIndex = 0; animationFrameIndex < neededFrames; animationFrameIndex++) {
                const frame = iconFrames[animationFrameIndex % iconFrames.length].clone();
                const time = ((animationFrameIndex % prefixFrameLength)/prefixFrameLength);
                for (let frameXPosition = 0; frameXPosition < frame.bitmap.width; frameXPosition++) {
                    const sinY = sinPosition(frameXPosition, time);
                    // Top line
                    frame.composite(colorImage, frameXPosition, sinY - size);

                    // Middle Line
                    frame.composite(colorImage, frameXPosition, sinY);

                    // Bottom Line
                    frame.composite(colorImage, frameXPosition, sinY + size);
                }
                for (let noteIndex = 0; noteIndex < notes.length; noteIndex++) {
                    const note = notes[noteIndex];
                    const noteImage = noteImages[note.noteImage];
                    const noteProgress = ((((time + universalNoteOffset) * noteSpeed) + (noteIndex / notes.length)) % 1) * frame.bitmap.width;
                    let yOffset = 0;
                    switch (note.track) {
                        case 0:
                            yOffset -= size;
                            break; 
                        case 2:
                            yOffset += size;
                            break;
                        default:
                            break;
                    }
                    frame.composite(noteImage, noteProgress - noteSizeCentering, sinPosition(noteProgress, time) - noteSizeCentering + yOffset);
                    frame.composite(noteImage, noteProgress - noteSizeCentering + frame.bitmap.width, sinPosition(noteProgress + frame.bitmap.width, time) - noteSizeCentering + yOffset);
                    frame.composite(noteImage, noteProgress - noteSizeCentering - frame.bitmap.width, sinPosition(noteProgress - frame.bitmap.width, time) - noteSizeCentering + yOffset);
                    frame.composite(noteImage, noteProgress - noteSizeCentering + (frame.bitmap.width * 2), sinPosition(noteProgress + (frame.bitmap.width * 2), time) - noteSizeCentering + yOffset);
                    frame.composite(noteImage, noteProgress - noteSizeCentering - (frame.bitmap.width * 2), sinPosition(noteProgress - (frame.bitmap.width * 2), time) - noteSizeCentering + yOffset);
                }
                prefixFrames.maskFrames.push(frame);
            }

            return prefixFrames;
        }
    },
    "Stunned": {
        name: "Stunned",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Stunned";

            let stunnedFrames = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/stunned/stars.png`), 5);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/stunned/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });
            // We don't cache this prefix, but we'll make a cache directory just in case we need to in the future

            let neededAnimationFrames = maths.leastCommonMultiple(stunnedFrames.length, iconFrames.length);

            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrames; animationFrameIndex++) {
                const stunnedFrame = stunnedFrames[animationFrameIndex % stunnedFrames.length];
                const frameHeadData = headPositions[animationFrameIndex % headPositions.length];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(stunnedFrame, cacheDirectory, frameHeadData, { x: 8, y: 17, width: 32 }, false);
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Lovey": {
        name: "Lovey",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: true,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed, cubeData) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Lovey";

            let seedGen = new seedrandom(`amorous${seed}`); // Same seed gen as amorous so that the heart colors always match

            let heartEyeImage = strokeImage(await Jimp.read(`${prefixSourceDirectory}/lovey/heart.png`), 0x00000022, 1, false, [[0, 0, 0], [0, 0, 0], [0, 1, 0]]);
            const validHueShifts = [0, 0, 0, 0, 0,
                77,
                -159,
                -86
            ];
            const usingShift = validHueShifts[Math.floor(validHueShifts.length * seedGen())];
            heartEyeImage.color([{apply: "hue", params: [usingShift]}])

            anchorPoints.eyes.forEach((eyesThisFrame, index) => {
                prefixFrames.frontFrames.push([]);
                eyesThisFrame.coordinates.forEach(coordinate => {
                    prefixFrames.frontFrames[index].push({
                        image: heartEyeImage,
                        compositePosition: {
                            x: coordinate.x - Math.floor(heartEyeImage.bitmap.width/2),
                            y: coordinate.y - Math.floor(heartEyeImage.bitmap.width/2)
                        }
                    })
                })
            })

            return prefixFrames;
        }
    },
    "Trouvaille": {
        name: "Trouvaille",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Trouvaille";
            let headPositions = anchorPoints.heads;
            let seedGen = new seedrandom(`trouvaille${seed}`);

            let cloverImage = await Jimp.read(`${prefixSourceDirectory}/trouvaille/${(seedGen() < 0.99) ? 'common' : 'rare'}.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/${seed}trouvaille/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(cloverImage, cacheDirectory, frameHeadPosition, { x: -10, y: 11, width: 32 });
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Googly": {
        name: "Googly",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: true,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Googly";

            let seedGen = new seedrandom(`googly${seed}`);

            const googlyEyeRotations: {
                flipX: boolean,
                flipY: boolean
            }[] = [];
            const generatedGooglyEyeRotations = 5;
            while (googlyEyeRotations.length < generatedGooglyEyeRotations) {
                googlyEyeRotations.push({
                    flipX: seedGen() > 0.5,
                    flipY: seedGen() > 0.5
                })
            }

            let googlyEyeImage = await Jimp.read(`${prefixSourceDirectory}/googly/googlyeye.png`);

            anchorPoints.eyes.forEach((eyesThisFrame, index) => {
                prefixFrames.frontFrames.push([]);
                eyesThisFrame.coordinates.forEach((coordinate, coordindex) => {
                    const flips = googlyEyeRotations[coordindex % generatedGooglyEyeRotations];
                    const constructedEye = strokeImage(googlyEyeImage.clone().flip(flips.flipX, flips.flipY), 0x00000022, 1, false, [[0, 0, 0], [0, 0, 0], [0, 1, 0]]);
                    prefixFrames.frontFrames[index].push({
                        image: constructedEye,
                        compositePosition: {
                            x: coordinate.x - Math.floor(constructedEye.bitmap.width / 2),
                            y: coordinate.y - Math.floor(constructedEye.bitmap.width / 2)
                        }
                    })
                })
            })

            return prefixFrames;
        }
    },
    "Expressive": {
        name: "Expressive",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: true,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Expressive";

            let seedGen = new seedrandom(`expressive${seed}`);

            const eyebrowColors = [
                0x6e5942ff,
                0x1f1f1fff,
                0x726b23ff,
                0xab5429ff
            ];

            let eyebrowMasks = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/expressive/eyebrows.png`), 5);
            const eyebrowImage = (new Jimp(eyebrowMasks[0].bitmap.width, eyebrowMasks[0].bitmap.height, eyebrowColors[Math.floor(seedGen() * eyebrowColors.length)]));
            eyebrowMasks[Math.floor(seedGen() * eyebrowMasks.length)].scan(0, 0, eyebrowMasks[0].bitmap.width, eyebrowMasks[0].bitmap.height, function(x, y, idx) {
                if (this.bitmap.data[idx + 3] <= 0) {
                    eyebrowImage.setPixelColor(0x00000000, x, y)
                }
            })

            anchorPoints.eyes.forEach((eyesThisFrame, index) => {
                prefixFrames.frontFrames.push([]);
                const averageXValue = eyesThisFrame.coordinates.reduce((prev, curr) => {
                    return prev + curr.x
                }, 0)/eyesThisFrame.coordinates.length;
                console.log(averageXValue);
                eyesThisFrame.coordinates.forEach((coordinate, coordindex) => {
                    prefixFrames.frontFrames[index].push({
                        image: eyebrowImage.clone().flip((coordinate.x > averageXValue), false),
                        compositePosition: {
                            x: coordinate.x - Math.floor(eyebrowImage.bitmap.width / 2),
                            y: coordinate.y - 7
                        }
                    })
                })
            })

            return prefixFrames;
        }
    },
    "Talkative": {
        name: "Talkative",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Talkative";

            let speechFrames = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/talkative/talkingindicator.png`), 5);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/talkative/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });
            // We don't cache this prefix, but we'll make a cache directory just in case we need to in the future

            let neededAnimationFrames = maths.leastCommonMultiple(speechFrames.length, iconFrames.length);

            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrames; animationFrameIndex++) {
                const speechFrame = speechFrames[animationFrameIndex % speechFrames.length];
                const frameHeadData = headPositions[animationFrameIndex % headPositions.length];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(speechFrame, cacheDirectory, frameHeadData, { x: 7, y: 9, width: 32 }, false);
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Muscular": {
        name: "Muscular",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let headPositions = anchorPoints.heads;
            prefixFrames.sourceID = "Muscular";

            let muscleBackImage = await Jimp.read(`${prefixSourceDirectory}/muscular/back.png`);
            let muscleFrontImage = await Jimp.read(`${prefixSourceDirectory}/muscular/front.png`);

            let muscleBackDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/muscular/back/`);
            if (!fs.existsSync(muscleBackDirectory)) fs.mkdirSync(muscleBackDirectory, { recursive: true });
            let muscleFrontDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/muscular/front/`);
            if (!fs.existsSync(muscleFrontDirectory)) fs.mkdirSync(muscleFrontDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];

                const backMuscleImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(muscleBackImage, muscleBackDirectory, frameHeadPosition, { x: 6, y: 15, width: 32 });
                prefixFrames.backFrames.push(backMuscleImagesThisFrame);

                const frontMuscleImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(muscleFrontImage, muscleFrontDirectory, frameHeadPosition, { x: 6, y: 15, width: 32 });
                prefixFrames.frontFrames.push(frontMuscleImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Leggendary": {
        name: "Leggendary",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed, cubeData) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let headPositions = anchorPoints.heads;
            prefixFrames.sourceID = "Leggendary";

            let legsImage = await Jimp.read(`${prefixSourceDirectory}/leggendary/legs.png`);

            let bloodBackDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/leggendary/`);
            if (!fs.existsSync(bloodBackDirectory)) fs.mkdirSync(bloodBackDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];

                const backBloodImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(legsImage, bloodBackDirectory, frameHeadPosition, { x: 0, y: 8, width: 32 });
                prefixFrames.backFrames.push(backBloodImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Thinking": {
        name: "Thinking",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Thinking";

            let speechFrames: Jimp[] = [];

            if (allPrefixes.includes("Eudaemonic")) {
                speechFrames = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/thinking/eudaemonicthoughts.png`), 5);
            } else if (allPrefixes.includes("Feminine") && allPrefixes.includes("Masculine")) {
                speechFrames = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/thinking/mascfemthoughts.png`), 5);
            } else if (allPrefixes.includes("Feminine")) {
                speechFrames = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/thinking/femthoughts.png`), 5);
            } else if (allPrefixes.includes("Masculine")) {
                speechFrames = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/thinking/mascthoughts.png`), 5);
            } else {
                speechFrames = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/thinking/thoughts.png`), 5);
            }

            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/thinking/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });
            // We don't cache this prefix, but we'll make a cache directory just in case we need to in the future

            let neededAnimationFrames = maths.leastCommonMultiple(speechFrames.length, iconFrames.length);

            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrames; animationFrameIndex++) {
                const speechFrame = speechFrames[animationFrameIndex % speechFrames.length];
                const frameHeadData = headPositions[animationFrameIndex % headPositions.length];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(speechFrame, cacheDirectory, frameHeadData, { x: -33, y: 28, width: 32 }, false);
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Boiled": {
        name: "Boiled",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Boiled";

            let seedGen = new seedrandom(`boiled${seed}`);

            let steamFrames = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/boiled/steam.png`), 10);

            let steamOffsets: number[] = [];
            let failsafe = 0;
            while (steamOffsets.length < 4) {
                let possibleOffset = Math.floor(steamFrames.length * seedGen());
                failsafe++;
                if (!steamOffsets.find(offset => Math.abs(offset - possibleOffset) <= 2) || failsafe > 100) {
                    steamOffsets.push(possibleOffset);
                }
            }

            let neededAnimationFrames = maths.leastCommonMultiple(steamFrames.length, iconFrames.length);

            const headPositions = anchorPoints.heads;

            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/boiled${seed}/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrames; animationFrameIndex++) {
                const frameHeadData = headPositions[animationFrameIndex % headPositions.length];
                const rightSteamImages: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(steamFrames[(animationFrameIndex + steamOffsets[0]) % steamFrames.length], cacheDirectory, frameHeadData, { x: 2 - 32, y: 17, width: 32 }, false);
                const centerSteamImages: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(steamFrames[(animationFrameIndex + steamOffsets[1]) % steamFrames.length], cacheDirectory, frameHeadData, { x: 11 - 32, y: 22, width: 32 }, false);
                const otherCenterSteamImages: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(steamFrames[(animationFrameIndex + steamOffsets[2]) % steamFrames.length], cacheDirectory, frameHeadData, { x: 24 - 32, y: 22, width: 32 }, false);
                const leftSteamImages: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(steamFrames[(animationFrameIndex + steamOffsets[3]) % steamFrames.length], cacheDirectory, frameHeadData, { x: 33 - 32, y: 17, width: 32 }, false);
                prefixFrames.frontFrames.push([...rightSteamImages, ...centerSteamImages, ...otherCenterSteamImages, ...leftSteamImages]);
            }

            return prefixFrames
        }
    },
    "Typing": {
        name: "Typing",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Typing";

            let seedGen = new seedrandom(`typing${cubeData.name}${seed}`);

            const speechBubbleTail = await Jimp.read(`${prefixSourceDirectory}/typing/speechbubbletail.png`)

            const characterPool = `AAAABCDEEEEFGHIIIIJKLMNOOOOPQRSTUUUUVWXYYZ`;

            const characters: number[] = [];

            if (allPrefixes.includes("Zammin")) {
                characters.push(...("ZAMMIN".split('').map(character => character.charCodeAt(0))));
            } else if (allPrefixes.includes("Acquiescing")) {
                characters.push(...("SIGHING".split('').map(character => character.charCodeAt(0))));
            } else {
                const typingLength = Math.round(seedGen() * 4) + 4;
                while (characters.length < typingLength) {
                    characters.push(characterPool.charCodeAt(Math.floor(seedGen() * characterPool.length)));
                }
            }
            const typingString = String.fromCharCode(...characters);
            const speechBubblePadding = 2;
            const textImage = await generateSmallWordImage(typingString, 0xffffffff, 0x000000ff, speechBubblePadding);

            const speechBubbleX = iconFrames[0].bitmap.width - 3;
            const speechBubbleY = -8;

            prefixFrames.frontFrames.push([{
                image: textImage,
                compositePosition: {
                    x: speechBubbleX,
                    y: speechBubbleY
                }
            }, {
                image: speechBubbleTail,
                compositePosition: {
                    x: speechBubbleX,
                    y: speechBubbleY + (textImage.bitmap.height - speechBubblePadding)
                }
            }])

            return prefixFrames;
        }
    },
    "Blind": {
        name: "Blind",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let headPositions = anchorPoints.heads;
            prefixFrames.sourceID = "Blind";

            let blindfoldBackImage = await Jimp.read(`${prefixSourceDirectory}/blind/back.png`);
            let blindfoldFrontImage = await Jimp.read(`${prefixSourceDirectory}/blind/front.png`);

            let blindfoldBackDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/blind/back/`);
            if (!fs.existsSync(blindfoldBackDirectory)) fs.mkdirSync(blindfoldBackDirectory, { recursive: true });
            let blindfoldFrontDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/blind/front/`);
            if (!fs.existsSync(blindfoldFrontDirectory)) fs.mkdirSync(blindfoldFrontDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];

                const backBlindfoldImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(blindfoldBackImage, blindfoldBackDirectory, frameHeadPosition, { x: 1, y: 8, width: 32 });
                prefixFrames.backFrames.push(backBlindfoldImagesThisFrame);

                const frontBlindfoldImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(blindfoldFrontImage, blindfoldFrontDirectory, frameHeadPosition, { x: 1, y: 8, width: 32 });
                prefixFrames.frontFrames.push(frontBlindfoldImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Cucurbitaphilic": {
        name: "Cucurbitaphilic",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Cucurbitaphilic";

            let seedGen = new seedrandom(`cucurbitaphilic${seed}`);

            let targetPumpkin = Math.floor(seedGen() * 3)+1;
            let pumpkinImage = await Jimp.read(`${prefixSourceDirectory}/cucurbitaphilic/${targetPumpkin}.png`);
            let targetSize = (iconFrames[0].bitmap.width/48);
            pumpkinImage.resize(Math.ceil(pumpkinImage.bitmap.width * targetSize), Math.ceil(pumpkinImage.bitmap.width * targetSize), Jimp.RESIZE_NEAREST_NEIGHBOR);
            const xPadding = 5;
            const yPadding = 3;

            prefixFrames.frontFrames.push([
                {
                    image: pumpkinImage,
                    compositePosition: {
                        x: iconFrames[0].bitmap.width - pumpkinImage.bitmap.width + xPadding,
                        y: iconFrames[0].bitmap.height - pumpkinImage.bitmap.height + yPadding
                    }
                }
            ])

            return prefixFrames;
        }
    },
    "Radioactive": {
        name: "Radioactive",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Radioactive";

            const desiredFrames = 15;
            const radioactivePadding = 6;
            const radioactiveColor = 0x05f20aff;
            const radioactiveStrokeColor = 0x16d71aff;
            const animationDensity = 1;
            const animationPadding = 1;

            const neededFrames = maths.leastCommonMultipleOfArray([desiredFrames, iconFrames.length]);
            let maskFrames: Jimp[] = [];
            iconFrames.forEach((frame) => {
                maskFrames.push(strokeImage(frame, 0xffffffff, radioactivePadding, true, [
                    [0, 1, 0],
                    [1, 0, 1],
                    [0, 1, 0]
                ]))
            })

            const radioactiveFrames: Jimp[] = [];

            const radioactiveLines = Math.floor((iconFrames[0].bitmap.height / (radioactivePadding + 2)) * animationDensity);
            const lineDistance = (iconFrames[0].bitmap.height + (radioactivePadding*2))/radioactiveLines;

            for (let radioactiveIndex = 0; radioactiveIndex < desiredFrames; radioactiveIndex++) {
                const newFrame = new Jimp((2 * radioactivePadding) + iconFrames[0].bitmap.width, (2 * radioactivePadding) + iconFrames[0].bitmap.height, 0x00000000);
                const animationProgressOffset = (2 * Math.PI) * (radioactiveIndex/desiredFrames);
                for (let radioactiveLineIndex = 0; radioactiveLineIndex < radioactiveLines; radioactiveLineIndex++) {
                    const yOffset = radioactivePadding + ((radioactiveLineIndex - 0.25)*lineDistance);
                    for (let newFrameX = 0; newFrameX < newFrame.bitmap.width; newFrameX++) {
                        const yPosition = (Math.cos(animationProgressOffset + ((Math.PI * 2) * (newFrameX / newFrame.bitmap.width))) * radioactivePadding) + yOffset;
                        newFrame.setPixelColor(radioactiveColor, newFrameX, yPosition);
                        newFrame.setPixelColor(radioactiveColor, yPosition, newFrameX);
                    }
                }
                radioactiveFrames.push(strokeImage(newFrame, radioactiveStrokeColor, animationPadding).crop(animationPadding, animationPadding, newFrame.bitmap.width, newFrame.bitmap.height));
            }

            for (let animationIndex = 0; animationIndex < neededFrames; animationIndex++) {
                const maskFrameIndex = animationIndex % maskFrames.length;
                const radioactiveIndex = animationIndex % radioactiveFrames.length;
                prefixFrames.backFrames.push([
                    {
                        image: radioactiveFrames[radioactiveIndex].clone().mask(maskFrames[maskFrameIndex], 0, 0),
                        compositePosition: {
                            x: -radioactivePadding,
                            y: -radioactivePadding
                        },
                        preventOutline: true
                    }
                ])
            }

            prefixFrames.outlineFrames.push([
                {
                    width: 1,
                    color: radioactiveStrokeColor,
                    layers: ["back", "front", "icon"]
                }
            ])
            return prefixFrames;
        }
    },
    "Read": {
        name: "Read",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Read";

            let seedGen = new seedrandom(`read${seed}`);

            let targetRead = Math.floor(seedGen() * 4) + 1;
            let pumpkinImage = await Jimp.read(`${prefixSourceDirectory}/read/${targetRead}.png`);
            let targetSize = (iconFrames[0].bitmap.width / 32);
            pumpkinImage.resize(Math.ceil(pumpkinImage.bitmap.width * targetSize), Math.ceil(pumpkinImage.bitmap.width * targetSize), Jimp.RESIZE_NEAREST_NEIGHBOR);
            const xPadding = 5;
            const yPadding = 3;

            prefixFrames.frontFrames.push([
                {
                    image: pumpkinImage,
                    compositePosition: {
                        x: iconFrames[0].bitmap.width - pumpkinImage.bitmap.width + xPadding,
                        y: iconFrames[0].bitmap.height - pumpkinImage.bitmap.height + yPadding
                    }
                }
            ])

            return prefixFrames;
        }
    },
    "Foggy": {
        name: "Foggy",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Foggy";
            const fogImage = await Jimp.read(`${prefixSourceDirectory}/foggy/fog.png`);
            const cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/foggy/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            const headPositions = anchorPoints.heads;

            for (let newAnimationIndex = 0; newAnimationIndex < headPositions.length; newAnimationIndex++) {
                const headFrame = headPositions[newAnimationIndex % headPositions.length];
                const fogsThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(fogImage, cacheDirectory, headFrame, { x: 13, y: 10, width: 32 });

                prefixFrames.frontFrames.push([...fogsThisFrame])
            }

            return prefixFrames;
        }
    },
    "Fatherly": {
        name: "Fatherly",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Fatherly";

            let seedGen = new seedrandom(`fatherly${seed}`);

            const useLeft = seedGen() > 0.5;
            const useRight = (!useLeft) ? true : seedGen() > 0.5;
            const leftScale = 0.4 + (seedGen() * 0.2);
            const rightScale = 0.4 + (seedGen() * 0.2);
            
            iconFrames.forEach((iconFrame) => {
                let compiledFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = [];
    
                if (useLeft) {
                    const newSize = {
                        width: Math.floor(iconFrame.bitmap.width * leftScale),
                        height: Math.floor(iconFrame.bitmap.height * leftScale)
                    };
                    compiledFrame.push({
                        image: iconFrame.clone().resize(newSize.width, newSize.height, Jimp.RESIZE_NEAREST_NEIGHBOR),
                        compositePosition: {
                            x: iconFrame.bitmap.width - Math.floor(newSize.width * 0.7),
                            y: iconFrame.bitmap.height - Math.floor(newSize.height * 0.8)
                        }
                    })
                }

                if (useRight) {
                    const newSize = {
                        width: Math.floor(iconFrame.bitmap.width * rightScale),
                        height: Math.floor(iconFrame.bitmap.height * rightScale)
                    };
                    compiledFrame.push({
                        image: iconFrame.clone().resize(newSize.width, newSize.height, Jimp.RESIZE_NEAREST_NEIGHBOR),
                        compositePosition: {
                            x: -Math.floor(newSize.width * 0.3),
                            y: iconFrame.bitmap.height - Math.floor(newSize.height * 0.8)
                        }
                    })
                }

                prefixFrames.frontFrames.push(compiledFrame);
            })

            return prefixFrames;
        }
    },
    "Meleagris": {
        name: "Meleagris",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Meleagris";
            const turkeyFeathersImage = await Jimp.read(`${prefixSourceDirectory}/meleagris/tail.png`);
            const cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/meleagris/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            const headPositions = anchorPoints.heads;

            for (let newAnimationIndex = 0; newAnimationIndex < headPositions.length; newAnimationIndex++) {
                const headFrame = headPositions[newAnimationIndex % headPositions.length];
                const hatsThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(turkeyFeathersImage, cacheDirectory, headFrame, { x: 16, y: 24, width: 32 });

                prefixFrames.backFrames.push([...hatsThisFrame]);
            }

            return prefixFrames;
        }
    },
    "Pugilistic": {
        name: "Pugilistic",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let headPositions = anchorPoints.heads;
            prefixFrames.sourceID = "Pugilistic";

            let gloveBackImage = await Jimp.read(`${prefixSourceDirectory}/pugilistic/back.png`);
            let gloveFrontImage = await Jimp.read(`${prefixSourceDirectory}/pugilistic/front.png`);

            let seedGen = new seedrandom(`pugilistic${seed}`);

            const imageMod: CCOIcons.JimpImgMod[] = [
                { apply: "hue", params: [360 * seedGen()] }
            ];

            gloveBackImage.color(imageMod);
            gloveFrontImage.color(imageMod);

            let backDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/pugilistic${seed}/back/`);
            if (!fs.existsSync(backDirectory)) fs.mkdirSync(backDirectory, { recursive: true });
            let frontDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/pugilistic${seed}/front/`);
            if (!fs.existsSync(frontDirectory)) fs.mkdirSync(frontDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];

                const backGloveImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(gloveBackImage, backDirectory, frameHeadPosition, { x: 5, y: 8, width: 32 });
                prefixFrames.backFrames.push(backGloveImagesThisFrame);

                const frontGloveImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(gloveFrontImage, frontDirectory, frameHeadPosition, { x: 5, y: 8, width: 32 });
                prefixFrames.frontFrames.push(frontGloveImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Censored": {
        name: "Censored",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let headPositions = anchorPoints.heads;
            prefixFrames.sourceID = "Censored";

            let censorBar = await Jimp.read(`${prefixSourceDirectory}/censored/text.png`);

            let censorBarDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/censored/`);
            if (!fs.existsSync(censorBarDirectory)) fs.mkdirSync(censorBarDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frontGlovesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(censorBar, censorBarDirectory, headPositions[headFrameIndex], { x: 8, y: -4, width: 32 });
                prefixFrames.frontFrames.push(frontGlovesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Sick": {
        name: "Sick",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let headPositions = anchorPoints.heads;
            prefixFrames.sourceID = "Sick";

            let maskBackImage = await Jimp.read(`${prefixSourceDirectory}/sick/back.png`);
            let maskFrontImage = await Jimp.read(`${prefixSourceDirectory}/sick/front.png`);

            let seedGen = new seedrandom(`sick${seed}`);

            const imageMod: CCOIcons.JimpImgMod[] = [
                { apply: "hue", params: [360 * seedGen()] }
            ];

            maskBackImage.color(imageMod);
            maskFrontImage.color(imageMod);

            let backDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/sick${seed}/back/`);
            if (!fs.existsSync(backDirectory)) fs.mkdirSync(backDirectory, { recursive: true });
            let frontDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/sick${seed}/front/`);
            if (!fs.existsSync(frontDirectory)) fs.mkdirSync(frontDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];

                const backMaskImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(maskBackImage, backDirectory, frameHeadPosition, { x: 0, y: 8, width: 32 });
                prefixFrames.backFrames.push(backMaskImagesThisFrame);

                const frontMaskImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(maskFrontImage, frontDirectory, frameHeadPosition, { x: 0, y: 8, width: 32 });
                prefixFrames.frontFrames.push(frontMaskImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Fearful": {
        name: "Fearful",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Fearful";

            let sweatAnimation = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/fearful/animation.png`), 15);

            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/fearful/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });
            // We don't cache this prefix, but we'll make a cache directory just in case we need to in the future

            let neededAnimationFrames = maths.leastCommonMultiple(sweatAnimation.length, iconFrames.length);

            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrames; animationFrameIndex++) {
                const sweatFrame = sweatAnimation[animationFrameIndex % sweatAnimation.length];
                const frameHeadData = headPositions[animationFrameIndex % headPositions.length];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(sweatFrame, cacheDirectory, frameHeadData, { x: -21, y: 17, width: 32 }, false);
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    }, 
    "Drunken": {
        name: "Drunken",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Drunken";

            let seedGen = new seedrandom(`drunken${seed}`);

            let drunkFrames = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/drunken/sloshedanim.png`), 15);

            let drunkOffsets: number[] = [];
            let failsafe = 0;
            while (drunkOffsets.length < 4) {
                let possibleOffset = Math.floor(drunkFrames.length * seedGen());
                failsafe++;
                if (!drunkOffsets.find(offset => Math.abs(offset - possibleOffset) <= 2) || failsafe > 100) {
                    drunkOffsets.push(possibleOffset);
                }
            }

            let neededAnimationFrames = maths.leastCommonMultiple(drunkFrames.length, iconFrames.length);

            const headPositions = anchorPoints.heads;

            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/drunken${seed}/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrames; animationFrameIndex++) {
                const frameHeadData = headPositions[animationFrameIndex % headPositions.length];
                const rightDrunkImages: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(drunkFrames[(animationFrameIndex + drunkOffsets[0]) % drunkFrames.length], cacheDirectory, frameHeadData, { x: 6 - 32, y: 11, width: 32 }, false);
                const centerDrunkImages: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(drunkFrames[(animationFrameIndex + drunkOffsets[1]) % drunkFrames.length], cacheDirectory, frameHeadData, { x: 16 - 32, y: 15, width: 32 }, false);
                const otherCenterDrunkImages: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(drunkFrames[(animationFrameIndex + drunkOffsets[2]) % drunkFrames.length], cacheDirectory, frameHeadData, { x: 27 - 32, y: 15, width: 32 }, false);
                const leftDrunkImages: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(drunkFrames[(animationFrameIndex + drunkOffsets[3]) % drunkFrames.length], cacheDirectory, frameHeadData, { x: 37 - 32, y: 11, width: 32 }, false);
                prefixFrames.frontFrames.push([...rightDrunkImages, ...centerDrunkImages, ...otherCenterDrunkImages, ...leftDrunkImages]);
            }

            return prefixFrames
        }
    },
    "Comfortable": {
        name: "Comfortable",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let headPositions = anchorPoints.heads;
            prefixFrames.sourceID = "Comfortable";

            let pillowImage = await Jimp.read(`${prefixSourceDirectory}/comfortable/pillow.png`);
            let tasselsImage = await Jimp.read(`${prefixSourceDirectory}/comfortable/tassels.png`);

            let seedGen = new seedrandom(`comfortable${seed}`);

            pillowImage.color([ { apply: "hue", params: [360 * seedGen()] } ]);
            pillowImage.composite(tasselsImage, 0, 0);

            let pillowDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/comfortable${seed}/`);
            if (!fs.existsSync(pillowDirectory)) fs.mkdirSync(pillowDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];

                const pillowImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(pillowImage, pillowDirectory, frameHeadPosition, { x: 8, y: 0, width: 32 });
                prefixFrames.backFrames.push(pillowImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Swag": {
        name: "Swag",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let headPositions = anchorPoints.heads;
            prefixFrames.sourceID = "Swag";

            let backImage = await Jimp.read(`${prefixSourceDirectory}/swag/back.png`);
            let frontImage = await Jimp.read(`${prefixSourceDirectory}/swag/front.png`);

            let backDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/swag/back/`);
            if (!fs.existsSync(backDirectory)) fs.mkdirSync(backDirectory, { recursive: true });
            let frontDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/swag/front/`);
            if (!fs.existsSync(frontDirectory)) fs.mkdirSync(frontDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];

                const backImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(backImage, backDirectory, frameHeadPosition, { x: 0, y: 8, width: 32 });
                prefixFrames.backFrames.push(backImagesThisFrame);

                const frontImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(frontImage, frontDirectory, frameHeadPosition, { x: 0, y: 8, width: 32 });
                prefixFrames.frontFrames.push(frontImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Stereoscopic": {
        name: "Stereoscopic",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let headPositions = anchorPoints.heads;
            prefixFrames.sourceID = "Stereoscopic";

            let backImage = await Jimp.read(`${prefixSourceDirectory}/stereoscopic/back.png`);
            let frontImage = await Jimp.read(`${prefixSourceDirectory}/stereoscopic/front.png`);

            let backDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/stereoscopic/back/`);
            if (!fs.existsSync(backDirectory)) fs.mkdirSync(backDirectory, { recursive: true });
            let frontDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/stereoscopic/front/`);
            if (!fs.existsSync(frontDirectory)) fs.mkdirSync(frontDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];

                const backImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(backImage, backDirectory, frameHeadPosition, { x: 0, y: 8, width: 32 });
                prefixFrames.backFrames.push(backImagesThisFrame);

                const frontImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(frontImage, frontDirectory, frameHeadPosition, { x: 0, y: 8, width: 32 });
                prefixFrames.frontFrames.push(frontImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Scientific": {
        name: "Scientific",
        tags: ["seeded"],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Scientific";
            let headPositions = anchorPoints.heads;

            let seedGen = new seedrandom(`scientific${seed}`);
            let animation = parseHorizontalSpriteSheet((await Jimp.read(`${prefixSourceDirectory}/scientific/flask.png`)).color([{apply: "hue", params: [Math.round(seedGen() * 360)]}]), 5);

            const flaskDistance = -8;
            for (let animationFrameIndex = 0; animationFrameIndex < animation.length; animationFrameIndex++) {
                const animationFrame = animation[animationFrameIndex];
                const constructedFrames: typeof prefixFrames["frontFrames"][number] = [];
                for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                    const headFrame = headPositions[headFrameIndex];
                    headFrame.positions.forEach(head => {
                        constructedFrames.push({
                            image: animationFrame,
                            compositePosition: {
                                x: head.startPosition.x + head.width + flaskDistance,
                                y: head.startPosition.y + (head.width/2) + flaskDistance
                            }
                        })
                    })
                }
                prefixFrames.frontFrames.push(constructedFrames)
            }

            return prefixFrames;
        }
    },
    "Brainy": {
        name: "Brainy",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Brainy";
            const brainHatImage = await Jimp.read(`${prefixSourceDirectory}/brainy/brain.png`);
            const cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/brainy/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            const headPositions = anchorPoints.heads;

            for (let newAnimationIndex = 0; newAnimationIndex < headPositions.length; newAnimationIndex++) {
                const headFrame = headPositions[newAnimationIndex % headPositions.length];
                const hatsThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(brainHatImage, cacheDirectory, headFrame, { x: 0, y: 12, width: 32 });

                prefixFrames.frontFrames.push([...hatsThisFrame])
            }

            return prefixFrames;
        }
    },
    "Oriental": {
        name: "Oriental",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Oriental";
            const roofHatImage = await Jimp.read(`${prefixSourceDirectory}/oriental/roof.png`);
            const cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/oriental/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            const headPositions = anchorPoints.heads;

            for (let newAnimationIndex = 0; newAnimationIndex < headPositions.length; newAnimationIndex++) {
                const headFrame = headPositions[newAnimationIndex % headPositions.length];
                const hatsThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(roofHatImage, cacheDirectory, headFrame, { x: 4, y: 18, width: 32 });

                prefixFrames.frontFrames.push([...hatsThisFrame])
            }

            return prefixFrames;
        }
    },
    "Roped": {
        name: "Roped",
        tags: ["seeded"],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            const prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Roped";
            let seedGen = new seedrandom(`roped${seed}`);

            let iconHeight = iconFrames[0].bitmap.height;
            let iconWidth = iconFrames[0].bitmap.width;

            let ropeCount = Math.round(seedGen() * 2) + 2;
            let ropeImage = await Jimp.read(`${prefixSourceDirectory}/roped/rope.png`);
            const desiredFrames = 15;

            let ropeSlopeVariance = 0.2;

            let ropeLines: {
                start: {
                    x: number,
                    y: number
                },
                end: {
                    x: number,
                    y: number
                },
                offset: number,
                flipX: boolean,
                flipY: boolean,
                direction: number,
                slope: number,
                lineImage: Jimp,
                lineImagesPerFrame: Jimp[]
            }[] = [];

            const maskThickness = Math.ceil(ropeImage.bitmap.height / 2);

            while (ropeLines.length < ropeCount) {
                let newRope: typeof ropeLines[number] = {
                    start: {
                        x: 0,
                        y: 0
                    },
                    end: {
                        x: 0,
                        y: 0
                    },
                    offset: Math.round(seedGen() * ropeImage.bitmap.width),
                    flipX: seedGen() > 0.5,
                    flipY: seedGen() > 0.5,
                    direction: ((seedGen() > 0.5) ? -1 : 1),
                    slope: 0,
                    lineImage: new Jimp(0, 0, 0),
                    lineImagesPerFrame: []
                }
                newRope.start.y = Math.round((seedGen() * ((iconHeight + (maskThickness * 2)) * (1 - (ropeSlopeVariance * 2)))) + ((iconHeight + (maskThickness * 2)) * ropeSlopeVariance));
                newRope.end.x = iconWidth + maskThickness - 1;
                newRope.end.y = Math.round(newRope.start.y + (seedGen() * (iconHeight + (maskThickness * 2)) * ropeSlopeVariance * ((seedGen() > 0.5) ? -1 : 1)));
                newRope.slope = (newRope.start.y - newRope.end.y) / (newRope.start.x - newRope.end.x);
                newRope.lineImage = new Jimp(iconFrames[0].bitmap.width + (maskThickness * 2), iconFrames[0].bitmap.height + (maskThickness * 2), 0x00000000);
                for (let lineImageX = 0; lineImageX < newRope.lineImage.bitmap.width; lineImageX++) {
                    newRope.lineImage.setPixelColor(0xffffffff, lineImageX, newRope.start.y + Math.round(lineImageX * newRope.slope));
                }
                ropeLines.push(newRope);
            }

            const ropeMovementPerFrame = ropeImage.bitmap.width / desiredFrames;
            const ropeImageCenterOffset = Math.round(ropeImage.bitmap.height / 2);
            iconFrames.forEach((frame, index) => {
                iconFrames[index] = strokeImage(frame, 0x00000000, maskThickness);
                ropeLines.forEach((ropeLine) => {
                    ropeLine.lineImagesPerFrame.push(strokeImage(ropeLine.lineImage.clone().mask(iconFrames[index], 0, 0), 0xffffffff, maskThickness, false, [
                        [0, 1, 0],
                        [1, 0, 1],
                        [0, 1, 0]
                    ]));
                })
            })
            const neededFrames = maths.leastCommonMultipleOfArray([desiredFrames, iconFrames.length]);
            for (let neededIconFrameIndex = 0; neededIconFrameIndex < neededFrames; neededIconFrameIndex++) {
                let newPrefixImage = new Jimp(iconWidth + (maskThickness * 2), iconHeight + (maskThickness * 2), 0x00000000);
                const iconFrameIndex = neededIconFrameIndex % iconFrames.length;

                for (let ropeLineIndex = 0; ropeLineIndex < ropeLines.length; ropeLineIndex++) {
                    const tentacleLine = ropeLines[ropeLineIndex];
                    const lineImageThisFrame = tentacleLine.lineImagesPerFrame[iconFrameIndex];

                    let newRopeFrame = new Jimp(newPrefixImage.bitmap.width, newPrefixImage.bitmap.height, 0x00000000);

                    for (let newRopeFrameX = 0; newRopeFrameX < newRopeFrame.bitmap.width; newRopeFrameX++) {
                        const newCenterPoint = {
                            x: newRopeFrameX,
                            y: tentacleLine.start.y + Math.round(newRopeFrameX * tentacleLine.slope)
                        }
                        for (let newRopeFrameY = 0; newRopeFrameY < ropeImage.bitmap.height; newRopeFrameY++) {
                            let sourceX = (((newCenterPoint.x + (tentacleLine.offset + ropeImage.bitmap.width - 1)) + Math.round((tentacleLine.direction * neededIconFrameIndex) * ropeMovementPerFrame)) % ropeImage.bitmap.width);
                            if (tentacleLine.flipX) {
                                sourceX = ropeImage.bitmap.width - 1 - sourceX;
                            }
                            let sourceY = newRopeFrameY;
                            if (tentacleLine.flipY) {
                                sourceY = ropeImage.bitmap.height - 1 - sourceY;
                            }
                            const sourceCoordinates = {
                                x: sourceX,
                                y: sourceY
                            }
                            const destinationCoordinates = {
                                x: newRopeFrameX,
                                y: newCenterPoint.y - ropeImageCenterOffset + newRopeFrameY + 1
                            }
                            newRopeFrame.setPixelColor(ropeImage.getPixelColor(sourceCoordinates.x, sourceCoordinates.y), destinationCoordinates.x, destinationCoordinates.y);
                        }
                    }
                    // newPrefixImage.composite(lineImageThisFrame, -maskThickness, -maskThickness);
                    newPrefixImage.composite(newRopeFrame.mask(lineImageThisFrame, -maskThickness, -maskThickness), 0, 0);
                }

                prefixFrames.frontFrames.push([{
                    image: newPrefixImage,
                    compositePosition: {
                        x: -maskThickness,
                        y: -maskThickness
                    }
                }]);
            }

            return prefixFrames;
        }
    },
    "Brilliant": {
        name: "Brilliant",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Brilliant";

            let bulbFrames = await loadAnimatedCubeIcon(`${prefixSourceDirectory}/brilliant/bulb.png`);

            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/brilliant/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });
            // We don't cache this prefix, but we'll make a cache directory just in case we need to in the future

            let neededAnimationFrames = maths.leastCommonMultiple(bulbFrames.length, iconFrames.length);

            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrames; animationFrameIndex++) {
                const haloMovementFrame = bulbFrames[animationFrameIndex % bulbFrames.length];
                const frameHeadData = headPositions[animationFrameIndex % headPositions.length];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(haloMovementFrame, cacheDirectory, frameHeadData, { x: -1, y: 28, width: 32 }, false);
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Collectible": {
        name: "Collectible",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let headPositions = anchorPoints.heads;
            prefixFrames.sourceID = "Collectible";

            let caseBackImage = await Jimp.read(`${prefixSourceDirectory}/collectible/back.png`);
            let caseFrontImage = await Jimp.read(`${prefixSourceDirectory}/collectible/front.png`);

            let caseBackDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/collectible/back/`);
            if (!fs.existsSync(caseBackDirectory)) fs.mkdirSync(caseBackDirectory, { recursive: true });
            let caseFrontDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/collectible/front/`);
            if (!fs.existsSync(caseFrontDirectory)) fs.mkdirSync(caseFrontDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];

                const backCaseImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(caseBackImage, caseBackDirectory, frameHeadPosition, { x: 5, y: 14, width: 32 });
                prefixFrames.backFrames.push(backCaseImagesThisFrame);

                const frontCaseImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(caseFrontImage, caseFrontDirectory, frameHeadPosition, { x: 5, y: 14, width: 32 });
                prefixFrames.frontFrames.push(frontCaseImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Tumbling": {
        name: "Tumbling",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let headPositions = anchorPoints.heads;
            prefixFrames.sourceID = "Tumbling";

            let chairBackImage = await Jimp.read(`${prefixSourceDirectory}/tumbling/back.png`);
            let chairFrontImage = await Jimp.read(`${prefixSourceDirectory}/tumbling/front.png`);

            let chairBackDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/tumbling/back/`);
            if (!fs.existsSync(chairBackDirectory)) fs.mkdirSync(chairBackDirectory, { recursive: true });
            let chairFrontDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/tumbling/front/`);
            if (!fs.existsSync(chairFrontDirectory)) fs.mkdirSync(chairFrontDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];

                const backChairImagesThisFrame: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(chairBackImage, chairBackDirectory, frameHeadPosition, { x: 16, y: 19, width: 32 });
                prefixFrames.backFrames.push(backChairImagesThisFrame);

                const frontChairImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(chairFrontImage, chairFrontDirectory, frameHeadPosition, { x: 16, y: 19, width: 32 });
                prefixFrames.frontFrames.push(frontChairImagesThisFrame);
            }

            return prefixFrames;
        }
    }, 
    "Sparkly": {
        name: "Sparkly",
        tags: [ "seeded" ],
        needs: {
            heads: false,
            eyes: false,
            accents: true,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Sparkly";
            const sparkles = await loadAnimatedCubeIcon(`${prefixSourceDirectory}/sparkly/sparkles.png`);
            const sparkleFrameMulti = iconFrames.length > 1 ? 2 : 10;
            let seedGen = new seedrandom(`sparkly${seed}`);

            const accentPositions = anchorPoints.accents;

            const desiredFrames = iconFrames.length * sparkleFrameMulti;
            for (let newAnimationIndex = 0; newAnimationIndex < desiredFrames; newAnimationIndex++) {
                const constructedFrame: typeof prefixFrames.frontFrames[number] = [];
                
                const accentFrame = accentPositions[newAnimationIndex % accentPositions.length].image;
                accentFrame.scan(0, 0, accentFrame.bitmap.width, accentFrame.bitmap.height, function(x, y, idx) {
                    if (seedGen() > 0.99 && accentFrame.getPixelColor(x, y) === 0xffffffff) {
                        constructedFrame.push({
                            image: sparkles[Math.floor(sparkles.length * seedGen())],
                            compositePosition: {
                                x: x-Math.floor(sparkles[0].bitmap.width/2),
                                y: y-Math.floor(sparkles[0].bitmap.height/2)
                            }}
                        )
                    }
                })

                prefixFrames.frontFrames.push(constructedFrame)
            }

            return prefixFrames;
        }
    },
    "Adorable": {
        name: "Adorable",
        tags: [ "seeded" ],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Adorable";
            let seedGen = new seedrandom(`adorable${seed}`);
            const bows = await loadAnimatedCubeIcon(`${prefixSourceDirectory}/adorable/bows.png`);
            const usingBow = bows[Math.floor(seedGen() * bows.length)]
            usingBow.color([
                {
                    apply: "hue",
                    params: [360 * seedGen()]
                }
            ])
            const cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/adorable${seed}/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            const headPositions = anchorPoints.heads;

            for (let newAnimationIndex = 0; newAnimationIndex < headPositions.length; newAnimationIndex++) {
                const headFrame = headPositions[newAnimationIndex % headPositions.length];
                const hatsThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(usingBow, cacheDirectory, headFrame, { x: -19, y: 7, width: 32 });

                prefixFrames.frontFrames.push([...hatsThisFrame])
            }

            return prefixFrames;
        }
    },
    "Hurt": {
        name: "Hurt",
        tags: [ "seeded" ],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Hurt";

            let baseFrame = new Jimp(iconFrames[0].bitmap.width, iconFrames[0].bitmap.height, 0x00000000);

            let seedGen = new seedrandom(`hurt${seed}`);

            let baseBandaidImage = await Jimp.read(`${prefixSourceDirectory}/hurt/bandaid.png`);

            const baseBandaids = Math.ceil(((iconFrames[0].bitmap.width * iconFrames[0].bitmap.height) / 1024) * 2);
            const bandaidsOnFrame = baseBandaids + Math.round(seedGen() * baseBandaids);

            const bandaidPositionDeadZone = 0.1;
            const bandaidPositionOffset = baseFrame.bitmap.width * bandaidPositionDeadZone;
            const bandaidPositionRange = baseFrame.bitmap.width * (1 - (bandaidPositionDeadZone * 2));
            const maxRotation = 60;

            const bandaidPositions: CCOIcons.coordinate[] = [];
            const minBandaidDistance = 15;
            let loopTimes = 0;
            for (let bandaidIndex = 0; bandaidIndex < bandaidsOnFrame && loopTimes < 100; bandaidIndex++) {
                loopTimes++;
                let newKissPosition = {
                    x: Math.round(bandaidPositionOffset + (seedGen() * bandaidPositionRange) - (baseBandaidImage.bitmap.width / 2)),
                    y: Math.round(bandaidPositionOffset + (seedGen() * bandaidPositionRange) - (baseBandaidImage.bitmap.width / 2))
                };
                if (bandaidPositions.find(position => maths.distanceBetweenPoints(position, newKissPosition) < minBandaidDistance)) {
                    bandaidIndex--;
                } else {
                    bandaidPositions.push(newKissPosition);
                    let newBandaidImage = baseBandaidImage.clone().rotate(Math.round((maxRotation * seedGen()) - (maxRotation / 2)));
                    baseFrame.composite(newBandaidImage, newKissPosition.x, newKissPosition.y);
                }
            }
            const shadowSize = 1;
            baseFrame = strokeImage(baseFrame, 0x00000022, shadowSize, false, [[0, 1, 0], [1, 0, 1], [0, 1, 0]]);
            baseFrame.crop(shadowSize, shadowSize, baseFrame.bitmap.width - (shadowSize * 2), baseFrame.bitmap.height - (shadowSize * 2));
            for (let iconFrameIndex = 0; iconFrameIndex < iconFrames.length; iconFrameIndex++) {
                const iconFrame = iconFrames[iconFrameIndex];
                const maskedBandaidFrame = baseFrame.clone();
                iconFrame.scan(0, 0, iconFrame.bitmap.width, iconFrame.bitmap.height, function (x, y, idx) {
                    if (this.bitmap.data[idx + 3] === 0) {
                        maskedBandaidFrame.setPixelColor(0x00000000, x, y);
                    }
                });
                prefixFrames.frontFrames.push([{
                    image: maskedBandaidFrame,
                    compositePosition: {
                        x: 0,
                        y: 0
                    },
                    preventOutline: true
                }]);
            }
            return prefixFrames;
        }
    },
    "Ailurophilic": {
        name: "Ailurophilic",
        tags: [ "seeded" ],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Ailurophilic";
            let seedGen = new seedrandom(`ailurophilic${seed}`);

            const catPatternCount = 3;
            const catSpriteSheet = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/ailurophilic/basecat.png`), 10);
            const catPatternSheet = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/ailurophilic/catpattern${Math.floor(seedGen() * catPatternCount)}.png`), 10);
            const catPalette = await Jimp.read(`${prefixSourceDirectory}/ailurophilic/catpallettes.png`);
            const flipped = (seedGen() > 0.5);
            const compositePosition = flipped ? {
                x: -5,
                y: iconFrames[0].bitmap.height - catSpriteSheet[0].bitmap.height + 1
            } : {
                x: iconFrames[0].bitmap.width - catSpriteSheet[0].bitmap.width + 3,
                y: iconFrames[0].bitmap.height - catSpriteSheet[0].bitmap.height + 1
            }

            const usingPalette = Math.floor(catPalette.bitmap.width * seedGen());
            const paletteMap = {
                0xeeeeeeff: catPalette.getPixelColor(usingPalette, 0),
                0xbdbdbdff: catPalette.getPixelColor(usingPalette, 1),
                0x9e9e9eff: catPalette.getPixelColor(usingPalette, 2),
                0xff0000ff: catPalette.getPixelColor(usingPalette, 3),
                0xcc0000ff: catPalette.getPixelColor(usingPalette, 4)
            }

            for (let catSpriteSheetIndex = 0; catSpriteSheetIndex < catSpriteSheet.length; catSpriteSheetIndex++) {
                const catSprite = catSpriteSheet[catSpriteSheetIndex];
                catSprite.composite(catPatternSheet[catSpriteSheetIndex], 0, 0);
                catSprite.scan(0, 0, catSprite.bitmap.width, catSprite.bitmap.height, function(x, y, idx) {
                    const sourceColor = catSprite.getPixelColor(x, y);
                    // @ts-ignore 
                    const foundColor = paletteMap[sourceColor] ?? 0x00000000;
                    if (foundColor !== 0x00000000) {
                        catSprite.setPixelColor(foundColor, x, y);
                    }
                });
                if (!flipped) catSprite.flip(true, false);
                prefixFrames.frontFrames.push([{
                    image: catSprite,
                    compositePosition
                }]);
            }

            return prefixFrames;
        }
    },
    "Fake": {
        name: "Fake",
        tags: [ "appliesDirectlyAfterAllPrefixes" ],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Fake";

            const colors = [
                [0xf2f2f2ff, 0xc2c2c2ff],
                [0xc2c2c2ff, 0xf2f2f2ff]
            ];

            for (let outputFrameIndex = 0; outputFrameIndex < iconFrames.length; outputFrameIndex++) {
                const currentIconFrame = iconFrames[outputFrameIndex % iconFrames.length].clone();
                
                currentIconFrame.scan(0, 0, currentIconFrame.bitmap.width, currentIconFrame.bitmap.height, function(x, y, idx) {
                    if (currentIconFrame.bitmap.data[idx + 3] === 0) {
                        currentIconFrame.setPixelColor(colors[y % colors.length][x % colors[0].length], x, y);
                    }
                })

                prefixFrames.maskFrames.push(currentIconFrame);
            }

            return prefixFrames;
        }
    },
    "Glinting": {
        name: "Glinting",
        tags: [ "seeded" ],
        needs: {
            heads: false,
            eyes: false,
            accents: true,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Glinting";
            const accentFrames = anchorPoints.accents;
            let seedGen = new seedrandom(`glinting${seed}`);

            const glintOverlay = await Jimp.read(`${prefixSourceDirectory}/glinting/glint.png`);
            glintOverlay.color([{apply: "hue", params: [Math.floor(360 * seedGen())]}]);
            const desiredFrames = 30;
            const trueFrames = maths.leastCommonMultiple(desiredFrames, accentFrames.length);

            const sinAmplitude = Math.ceil(seedGen() * 5) + 1;
            const sinOffset = seedGen() * 2 * Math.PI;

            for (let newFrameIndex = 0; newFrameIndex < trueFrames; newFrameIndex++) {
                const newFrame = accentFrames[newFrameIndex % accentFrames.length].image.clone();
                const animationProgress = (newFrameIndex % desiredFrames)/desiredFrames;
                
                const yOffset = Math.round(Math.sin(sinOffset + (animationProgress * 2 * Math.PI)) * sinAmplitude);
                const xOffset = Math.round(animationProgress * glintOverlay.bitmap.width);

                newFrame.scan(0, 0, newFrame.bitmap.width, newFrame.bitmap.height, function(x, y, idx) {
                    if (newFrame.bitmap.data[idx + 3] > 0) newFrame.setPixelColor(glintOverlay.getPixelColor((x + xOffset) % glintOverlay.bitmap.width, (y + yOffset) % glintOverlay.bitmap.height), x, y);
                })

                prefixFrames.frontFrames.push([
                    {
                        image: newFrame,
                        compositePosition: { x: 0, y: 0 },
                        preventOutline: true
                    }
                ])
            }

            return prefixFrames;
        }
    },
    "Conspicuous": {
        name: "Conspicuous",
        tags: [ "seeded" ],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Conspicuous";
            let seedGen = new seedrandom(`conspicuous${seed}`);

            const evidenceTagSheet = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/conspicuous/crimemarkers.png`), 9);
            const flipped = (seedGen() > 0.5);
            const compositePosition = flipped ? {
                x: -20,
                y: iconFrames[0].bitmap.height - (evidenceTagSheet[0].bitmap.height/2) + 5
            } : {
                x: iconFrames[0].bitmap.width - evidenceTagSheet[0].bitmap.width + 18,
                y: iconFrames[0].bitmap.height - (evidenceTagSheet[0].bitmap.height / 2) + 5
            }

            const usingSprite = evidenceTagSheet[Math.floor(seedGen() * evidenceTagSheet.length)];
            const spriteHeight = usingSprite.bitmap.height / 2;
            const spriteWidth = usingSprite.bitmap.width;

            if (flipped) {
                usingSprite.crop(0, spriteHeight, spriteWidth, spriteHeight);
            } else {
                usingSprite.crop(0, 0, spriteWidth, spriteHeight);
            }

            prefixFrames.frontFrames.push([{
                image: usingSprite,
                compositePosition
            }]);

            return prefixFrames;
        }
    },
    "Voodoo": {
        name: "Voodoo",
        tags: [ "seeded" ],
        needs: {
            heads: true,
            eyes: true,
            accents: false,
            mouths: true
        },
        compileFrames: async function (anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Voodoo";
            let seedGen = new seedrandom(`voodoo${seed}`);
            const pinBobSheet = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/voodoo/pins.png`), 3);
            const crosseyeImage = await Jimp.read(`${prefixSourceDirectory}/voodoo/crosseye.png`);

            const createPins = anchorPoints.heads.every((headFrame) => headFrame.positions[0].startPosition.x === anchorPoints.heads[0].positions[0].startPosition.x && headFrame.positions[0].startPosition.y === anchorPoints.heads[0].positions[0].startPosition.y && headFrame.positions[0].width === anchorPoints.heads[0].positions[0].width );

            console.log(`Create Pins: ${createPins}`);

            const usingPins: {
                position: CCOIcons.coordinate,
                length: number,
                style: number,
                hue: number
            }[] = [];
            const pinBobPositions: CCOIcons.coordinate[] = [];
            let pinShaftImage = new Jimp(1, 1, 0x00000000);

            const iconBitmap = iconFrames[0].bitmap;
            const extraPinLength = 4;
            const basePinLength = 8;
            if (createPins) {
                let failsafe = 0;
                const pinCount = Math.round(seedGen() * 2) + 4;

                while (usingPins.length < pinCount && failsafe < 250) {
                    failsafe++;
    
                    const chosenPosition = {
                        x: Math.floor(seedGen() * iconBitmap.width),
                        y: Math.floor(seedGen() * iconBitmap.height)
                    }
    
                    if (iconBitmap.data[iconFrames[0].getPixelIndex(chosenPosition.x, chosenPosition.y) + 3] > 100) { // if the pixel is transparent
                        let valid = false;
                        if (!usingPins.some(pinData => maths.distanceBetweenPoints(pinData.position, chosenPosition) < (iconFrames[0].bitmap.width / 3))) {
                            if (chosenPosition.x >= (iconBitmap.width - 1) || chosenPosition.x <= 0 || (iconFrames[0].getPixelColor(chosenPosition.x - 1, chosenPosition.y) >> 0 && 0xff) < 100) {
                                valid = true;
                            }
    
                            if (chosenPosition.x >= (iconBitmap.width - 1) || chosenPosition.x <= 0 || (iconFrames[0].getPixelColor(chosenPosition.x + 1, chosenPosition.y) >> 0 && 0xff) < 100) {
                                valid = true;
                            }
    
                            if (chosenPosition.y >= (iconBitmap.height - 1) || chosenPosition.y <= 0 || (iconFrames[0].getPixelColor(chosenPosition.x, chosenPosition.y - 1) >> 0 && 0xff) < 100) {
                                valid = true;
                            }
    
                            if (chosenPosition.y >= (iconBitmap.height - 1) || chosenPosition.y <= 0 || (iconFrames[0].getPixelColor(chosenPosition.x, chosenPosition.y + 1) >> 0 && 0xff) < 100) {
                                valid = true;
                            }
    
                            if (valid) {
                                failsafe = 0;
                                usingPins.push({
                                    position: chosenPosition,
                                    length: Math.ceil(seedGen() * extraPinLength) + basePinLength,
                                    style: Math.floor(seedGen() * pinBobSheet.length),
                                    hue: Math.floor(360 * seedGen())
                                });
                            }
                        }
                    }
                }
                
                pinShaftImage = new Jimp(iconBitmap.width + (extraPinLength + basePinLength * 2), iconBitmap.height + (extraPinLength + basePinLength * 2), 0x00000000);

                const centerPoint = {
                    x: Math.floor(iconBitmap.width / 2),
                    y: Math.floor(iconBitmap.height / 2)
                }
                const pinPalette = {
                    shaftMain: 0x696969ff,
                    shaftShadow: 0x4a4a4aff
                }

                for (let pinIndex = 0; pinIndex < usingPins.length; pinIndex++) {
                    const pinData = usingPins[pinIndex];
                    const trueAngle = Math.atan2(centerPoint.y - pinData.position.y, pinData.position.x - centerPoint.x);

                    for (let pinPixelIndex = 0; pinPixelIndex < pinData.length; pinPixelIndex++) {
                        const xPos = pinData.position.x + Math.ceil(Math.cos(trueAngle) * (pinPixelIndex + 1));
                        const yPos = pinData.position.y - Math.ceil(Math.sin(trueAngle) * (pinPixelIndex + 1));

                        pinShaftImage.setPixelColor(pinPalette.shaftMain, extraPinLength + basePinLength + xPos, extraPinLength + basePinLength + yPos);

                        if (pinPixelIndex === pinData.length - 1) {
                            pinBobPositions.push({
                                x: xPos,
                                y: yPos
                            })
                        }
                    }

                    // pinShaftImage.setPixelColor(0xff0000ff, pinPosition.x + extraPinLength + basePinLength, pinPosition.y + extraPinLength + basePinLength);
                }

                pinShaftImage = strokeImage(pinShaftImage, pinPalette.shaftShadow, 1, false, [[0, 0, 0], [0, 0, 0], [0, 1, 0]]);
            }

            for (let iconFrameIndex = 0; iconFrameIndex < iconFrames.length; iconFrameIndex++) {
                const iconFrame = iconFrames[iconFrameIndex];
                let constructedFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = [];

                if (createPins) {
                    constructedFrame.push({
                        image: pinShaftImage,
                        compositePosition: {
                            x: - extraPinLength - basePinLength - 1,
                            y: - extraPinLength - basePinLength - 1
                        }
                    })
    
                    for (let pinBobIndex = 0; pinBobIndex < pinBobPositions.length; pinBobIndex++) {
                        const pinBobPosition = pinBobPositions[pinBobIndex];
                        const pinData = usingPins[pinBobIndex];
                        constructedFrame.push({
                            image: pinBobSheet[pinData.style].clone().color([{apply: "hue", params: [pinData.hue]}]),
                            compositePosition: {
                                x: pinBobPosition.x - Math.floor(pinBobSheet[0].bitmap.width/2),
                                y: pinBobPosition.y - Math.floor(pinBobSheet[0].bitmap.height/2)
                            }
                        })
                    }
                }

                const eyes = anchorPoints.eyes[iconFrameIndex % anchorPoints.eyes.length];
                for (let eyeIndex = 0; eyeIndex < eyes.coordinates.length; eyeIndex++) {
                    const eyeCoordinate = eyes.coordinates[eyeIndex];
                    constructedFrame.push({
                        image: crosseyeImage.clone(),
                        compositePosition: {
                            x: eyeCoordinate.x - Math.floor(crosseyeImage.bitmap.width/2),
                            y: eyeCoordinate.y - Math.floor(crosseyeImage.bitmap.height/2)
                        },
                        preventOutline: true
                    })
                }

                prefixFrames.frontFrames.push(constructedFrame);
            }
            
            return prefixFrames;
        }
    },
    "Annoyed": {
        name: "Annoyed",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Annoyed";

            let annoyedFrames = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/annoyed/fuzzball.png`), 5);

            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/annoyed/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            let neededAnimationFrames = maths.leastCommonMultiple(annoyedFrames.length, iconFrames.length);

            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrames; animationFrameIndex++) {
                const annoyedFrame = annoyedFrames[animationFrameIndex % annoyedFrames.length];
                const frameHeadData = headPositions[animationFrameIndex % headPositions.length];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(annoyedFrame, cacheDirectory, frameHeadData, { x: 0, y: 27, width: 32 }, false);
                prefixFrames.frontFrames.push(headImagesThisFrame);
            }

            return prefixFrames;
        }
    },
    "Zammin": {
        name: "Zammin",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Zammin";
            let headPositions = anchorPoints.heads;

            if (!allPrefixes.includes("Typing")) {
                let animation: Jimp = new Jimp(1, 1, 0);
                if (allPrefixes.includes("Acquiescing")) {
                    animation = await Jimp.read(`${prefixSourceDirectory}/zamminacquiescing/sighzamn.png`);
                } else {
                    animation = await Jimp.read(`${prefixSourceDirectory}/zamminacquiescing/zamn.png`);
                }
    
                const bubbleDistance = 13;
                const constructedFrames: typeof prefixFrames["frontFrames"][number] = [];
                for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                    const headFrame = headPositions[headFrameIndex];
                    headFrame.positions.forEach(head => {
                        constructedFrames.push({
                            image: animation,
                            compositePosition: {
                                x: head.startPosition.x + head.width + Math.round(head.width / bubbleDistance),
                                y: head.startPosition.y - Math.round(head.width / bubbleDistance) - animation.bitmap.height
                            }
                        })
                    })
                    prefixFrames.frontFrames.push(constructedFrames)
                }
            }

            return prefixFrames;
        }
    },
    "RDMing": {
        name: "RDMing",
        tags: [ "seeded" ],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "RDMing";

            let seedGen = new seedrandom(`rdming${seed}`);
            const possibleGravGunColors = [
                0xd829ffff,
                0x42cbf5ff,
                0xff2966ff,
                0xffad29ff
            ]
            const gravGunColor = possibleGravGunColors[Math.floor(seedGen() * possibleGravGunColors.length)];

            prefixFrames.outlineFrames.push([
                {
                    width: 1,
                    color: gravGunColor,
                    layers: ["back", "front", "icon"]
                }
            ]);

            const animationPadding = 2;
            const divisions = 8;
            const maxReferenceAngle = (Math.PI * 2) / (divisions * 2);
            const desiredFrames = 5;
            const neededFrames = maths.leastCommonMultiple(desiredFrames, iconFrames.length);

            const iconCenterPosition = {
                x: Math.floor(iconFrames[0].bitmap.width / 2),
                y: Math.floor(iconFrames[0].bitmap.height / 2),
            }
            for (let iconFrameIndex = 0; iconFrameIndex < neededFrames; iconFrameIndex++) {
                const iconFrame = iconFrames[iconFrameIndex % iconFrames.length];
                const angleAddition = (Math.PI * iconFrameIndex) / (desiredFrames * divisions);
                const newFrame = new Jimp(iconFrame.bitmap.width + (animationPadding * 2), iconFrame.bitmap.height + (animationPadding * 2));
                newFrame.scan(0, 0, newFrame.bitmap.width, newFrame.bitmap.height, function(newX, newY, idx) {
                    const x = newX - animationPadding;
                    const y = newY - animationPadding;
                    const originalIndex = iconFrame.getPixelIndex(x, y);
                    const checkingPositions = [
                        { x: x - 2, y: y - 2 },
                        { x: x - 1, y: y - 2 },
                        { x: x, y: y - 2 },
                        { x: x + 1, y: y - 2 },
                        { x: x + 2, y: y - 2 },
                        { x: x + 2, y: y - 1 },
                        { x: x + 2, y: y },
                        { x: x + 2, y: y + 1 },
                        { x: x + 2, y: y + 2 },
                        { x: x + 1, y: y + 2 },
                        { x: x, y: y + 2 },
                        { x: x - 1, y: y + 2 },
                        { x: x - 2, y: y + 2 },
                        { x: x - 2, y: y + 1 },
                        { x: x - 2, y: y },
                        { x: x - 2, y: y - 1 },
                    ]
                    if ((iconFrame.bitmap.data[originalIndex + 3] === 0 || x < 0 || x >= iconFrame.bitmap.width || y < 0 || y >= iconFrame.bitmap.height) && checkingPositions.some(coord => iconFrame.bitmap.data[iconFrame.getPixelIndex(coord.x, coord.y) + 3] > 0)) {
                        let pixelAngle = Math.atan2(-(y - iconCenterPosition.y), x - iconCenterPosition.x);
                        if (pixelAngle < 0) pixelAngle += Math.PI;
                        pixelAngle = (pixelAngle + angleAddition) % maxReferenceAngle;
                        if (0 < pixelAngle && pixelAngle < maxReferenceAngle / 2) {
                            newFrame.setPixelColor(gravGunColor, x + animationPadding, y + animationPadding)
                        }
                        if (pixelAngle < 0) console.log(pixelAngle * (180/Math.PI), x, y);
                    }
                })
                prefixFrames.backFrames.push([
                    {
                        image: newFrame,
                        compositePosition: {
                            x: -animationPadding,
                            y: -animationPadding
                        },
                        preventOutline: true
                    }
                ]);
            }

            return prefixFrames;
        }
    },
    "Acquiescing": {
        name: "Acquiescing",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Acquiescing";
            let headPositions = anchorPoints.heads;

            if (!allPrefixes.includes("Zammin") && !allPrefixes.includes("Typing")) {
                let animation: Jimp = await Jimp.read(`${prefixSourceDirectory}/zamminacquiescing/sigh.png`);

                const bubbleDistance = 13;
                const constructedFrames: typeof prefixFrames["frontFrames"][number] = [];
                for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                    const headFrame = headPositions[headFrameIndex];
                    headFrame.positions.forEach(head => {
                        constructedFrames.push({
                            image: animation,
                            compositePosition: {
                                x: head.startPosition.x + head.width + Math.round(head.width / bubbleDistance),
                                y: head.startPosition.y - Math.round(head.width / bubbleDistance) - animation.bitmap.height
                            }
                        })
                    })
                    prefixFrames.frontFrames.push(constructedFrames)
                }
            }

            return prefixFrames;
        }
    },
    "Fuming": {
        name: "Fuming",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Fuming";

            let steamFrames = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/fuming/steam.png`), 5);

            let neededAnimationFrames = maths.leastCommonMultiple(steamFrames.length, iconFrames.length);

            const headPositions = anchorPoints.heads;

            // if we cache this, we may need separate directories for the flipped versions.
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/fuming/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let animationFrameIndex = 0; animationFrameIndex < neededAnimationFrames; animationFrameIndex++) {
                const frameHeadData = headPositions[animationFrameIndex % headPositions.length];
                const fumingLeftHeadImages: CCOIcons.compiledPrefixFrames["backFrames"][number] = await compileHeadsForFrame(steamFrames[animationFrameIndex % steamFrames.length], cacheDirectory, frameHeadData, { x: 9, y: 0, width: 32 }, false);
                const fumingRightHeadImages: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(steamFrames[animationFrameIndex % steamFrames.length].clone().flip(true, false), cacheDirectory, frameHeadData, { x: -24, y: -4, width: 32 }, false);
                prefixFrames.frontFrames.push([...fumingRightHeadImages]);
                prefixFrames.backFrames.push([...fumingLeftHeadImages]);
            }

            return prefixFrames
        }
    },
    "DLC": {
        name: "DLC",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "DLC";

            prefixFrames.frameModifiers.push([
                {
                    modifiers: [
                        { apply: "darken", params: [100] }
                    ],
                    layers: ["icon"]
                }
            ])

            return prefixFrames;
        }
    },
    "Feminine": {
        name: "Feminine",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Feminine";
            let headPositions = anchorPoints.heads;

            if (!allPrefixes.includes("Thinking")) {
                let animation: Jimp[] = [];
                if (allPrefixes.includes("Masculine")) {
                    animation = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/masculinefeminine/both.png`), 5);
                } else {
                    animation = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/masculinefeminine/feminine.png`), 5);
                }

                const bubbleDistance = 13;
                for (let animationFrameIndex = 0; animationFrameIndex < animation.length; animationFrameIndex++) {
                    const animationFrame = animation[animationFrameIndex];
                    const constructedFrames: typeof prefixFrames["frontFrames"][number] = [];
                    for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                        const headFrame = headPositions[headFrameIndex];
                        headFrame.positions.forEach(head => {
                            constructedFrames.push({
                                image: animationFrame,
                                compositePosition: {
                                    x: head.startPosition.x + head.width + Math.round(head.width / bubbleDistance),
                                    y: head.startPosition.y - Math.round(head.width / bubbleDistance) - animation[0].bitmap.height
                                }
                            })
                        })
                    }
                    prefixFrames.frontFrames.push(constructedFrames)
                }
            }

            return prefixFrames;
        }
    },
    "Masculine": {
        name: "Masculine",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Masculine";
            let headPositions = anchorPoints.heads;

            if (!allPrefixes.includes("Thinking") && !allPrefixes.includes("Feminine")) {
                let animation = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/masculinefeminine/masculine.png`), 5);

                const bubbleDistance = 13;
                for (let animationFrameIndex = 0; animationFrameIndex < animation.length; animationFrameIndex++) {
                    const animationFrame = animation[animationFrameIndex];
                    const constructedFrames: typeof prefixFrames["frontFrames"][number] = [];
                    for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                        const headFrame = headPositions[headFrameIndex];
                        headFrame.positions.forEach(head => {
                            constructedFrames.push({
                                image: animationFrame,
                                compositePosition: {
                                    x: head.startPosition.x + head.width + Math.round(head.width / bubbleDistance),
                                    y: head.startPosition.y - Math.round(head.width / bubbleDistance) - animation[0].bitmap.height
                                }
                            })
                        })
                    }
                    prefixFrames.frontFrames.push(constructedFrames)
                }
            }

            return prefixFrames;
        }
    },
    "Ornamentalized": {
        name: "Ornamentalized",
        tags: [ "seeded" ],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Ornamentalized";
            let seedGen = new seedrandom(`ornamentalized${seed}`);
            let possibleOrnaments = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/ornamentalized/ornaments.png`), 5);
            let hookOverlay = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/ornamentalized/hook.png`), 5)[0];
            let shadingOverlay = parseHorizontalSpriteSheet(await Jimp.read(`${prefixSourceDirectory}/ornamentalized/shading.png`), 5)[0];

            let generatedOrnaments: { position: CCOIcons.coordinate, ornament: Jimp }[] = [];
            const eligibilityFunction = function (frame: Jimp, x: number, y: number): boolean {
                return frame.bitmap.data[frame.getPixelIndex(x, y) + 3] > 0 && frame.bitmap.data[frame.getPixelIndex(x, y + 1) + 3] === 0 && frame.bitmap.data[frame.getPixelIndex(x, y + 2) + 3] === 0
            }
            const minOrnamentDistance = possibleOrnaments[0].bitmap.width;

            let failsafe = 0;
            while (generatedOrnaments.length == 0 && failsafe < Math.pow(minOrnamentDistance, 3)) {
                iconFrames[0].scan(0, 0, iconFrames[0].bitmap.width, iconFrames[0].bitmap.height, function (x, y, idx) {
                    if (y < this.bitmap.height - 1) {
                        failsafe++;
                        if (eligibilityFunction(this, x, y)) {
                            if (seedGen() > 0.96 && !generatedOrnaments.some(pixel => maths.distanceBetweenPoints(pixel.position, { x, y }) < minOrnamentDistance)) {
                                const newOrnament = possibleOrnaments[Math.floor(seedGen() * possibleOrnaments.length)].clone();
                                newOrnament.color([{ apply: "hue", params: [Math.floor(seedGen() * 360)] }]);
                                newOrnament.composite(hookOverlay, 0, 0);
                                if (seedGen() > 0.5) newOrnament.flip(true, false);
                                newOrnament.composite(shadingOverlay, 0, 0);
                                generatedOrnaments.push({ position: { x, y }, ornament: newOrnament });
                                failsafe = 0;
                            }
                        }
                    }
                })
            }

            iconFrames.forEach((frame, index) => {
                if (index !== 0) {
                    generatedOrnaments = generatedOrnaments.filter((dripPixel) => {
                        return eligibilityFunction(frame, dripPixel.position.x, dripPixel.position.y);
                    })
                }
            })

            const padding = (possibleOrnaments[0].bitmap.width / 2) + 4;
            const neededAnimationFrames = iconFrames.length;

            for (let newAnimationFrameIndex = 0; newAnimationFrameIndex < neededAnimationFrames; newAnimationFrameIndex++) {
                let newFrame = new Jimp(iconFrames[0].bitmap.width + (padding * 2), iconFrames[0].bitmap.height + (padding * 2), 0x00000000);
                for (let ornamentIndex = 0; ornamentIndex < generatedOrnaments.length; ornamentIndex++) {
                    const ornament = generatedOrnaments[ornamentIndex];
                    newFrame.composite(ornament.ornament, ornament.position.x - Math.floor(ornament.ornament.bitmap.width/2) + padding, ornament.position.y - 2 + padding);
                }
                prefixFrames.frontFrames.push([{
                    image: newFrame,
                    compositePosition: {
                        x: -padding,
                        y: -padding
                    }
                }])
            }

            return prefixFrames;
        }
    },
    "Expensive": {
        name: "Expensive",
        tags: [],
        needs: {
            heads: false,
            eyes: true,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Expensive";
            const moneyEye = await Jimp.read(`${prefixSourceDirectory}/expensive/moneyeye.png`);

            const neededFrames = anchorPoints.eyes.length;

            for (let frameIndex = 0; frameIndex < neededFrames; frameIndex++) {
                const eyes = anchorPoints.eyes[frameIndex % anchorPoints.eyes.length];
                const constructedFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = [];
                for (let eyeIndex = 0; eyeIndex < eyes.coordinates.length; eyeIndex++) {
                    const eye = eyes.coordinates[eyeIndex];
                    constructedFrame.push({
                        image: moneyEye.clone(),
                        compositePosition: {
                            x: eye.x - Math.floor(moneyEye.bitmap.width/2),
                            y: eye.y - Math.floor(moneyEye.bitmap.height/2)
                        }
                    })
                }
                prefixFrames.frontFrames.push(constructedFrame);
            }

            return prefixFrames;
        }
    },
    "Hyaline": {
        name: "Hyaline",
        tags: [ "seeded" ],
        needs: {
            heads: false,
            eyes: false,
            accents: true,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Hyaline";

            const desiredFrames = 15;
            const waitFrames = 15;
            const neededFrames = maths.leastCommonMultiple(desiredFrames, anchorPoints.accents.length);
            let seedGen = new seedrandom(`hyaline${seed}`);

            const sheenImageYScale = 3;
            const sheenImage = new Jimp(1, Math.ceil(iconFrames[0].bitmap.height * sheenImageYScale));
            let previousWasAdded = false;
            let addedsheen = 0;
            while (addedsheen < iconFrames[0].bitmap.height/7) {
                sheenImage.scan(0, 0, 1, sheenImage.bitmap.height, function(x, y) {
                    if (seedGen() > ((previousWasAdded) ? 0.2 : 0.94)) {
                        sheenImage.setPixelColor(0xffffffff, x, y);
                        previousWasAdded = !previousWasAdded;
                        addedsheen++;
                    }
                })
            }

            for (let newFrameIndex = 0; newFrameIndex < neededFrames; newFrameIndex++) {
                const accentFrame = anchorPoints.accents[newFrameIndex % anchorPoints.accents.length];
                const iconFrame = iconFrames[newFrameIndex % iconFrames.length];
                const newFrame = new Jimp(accentFrame.image.bitmap.width, accentFrame.image.bitmap.height, 0x00000000);
                const sheenFrame = newFrameIndex % desiredFrames;

                newFrame.scan(0, 0, newFrame.bitmap.width, newFrame.bitmap.height, function(x, y, idx) {
                    const sheenIndex = Math.ceil(x + y + 1 + (sheenFrame * (sheenImageYScale) * (iconFrames[0].bitmap.height/desiredFrames))) % sheenImage.bitmap.height;
                    if (sheenImage.getPixelColor(0, sheenIndex) !== 0) {
                        if (accentFrame.image.bitmap.data[accentFrame.image.getPixelIndex(x, y) + 3] > 0) {
                            newFrame.setPixelColor(0xffffff32, x, y);
                        } else if (iconFrame.bitmap.data[iconFrame.getPixelIndex(x, y) + 3] > 0) {
                            newFrame.setPixelColor(0xffffff11, x, y);
                        }
                    }
                })

                prefixFrames.frontFrames.push([{
                    image: newFrame,
                    compositePosition: {
                        x: 0,
                        y: 0
                    }
                }])
            }            

            const chosenWaitFrame = Math.floor(seedGen() * neededFrames);
            for (let waitFrameIndex = 0; waitFrameIndex < waitFrames; waitFrameIndex++) {
                prefixFrames.frontFrames.splice(chosenWaitFrame, 0, prefixFrames.frontFrames[chosenWaitFrame]);
            }

            return prefixFrames;
        }
    },
    "Sussy": {
        name: "Sussy",
        tags: [ "seeded" ],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Sussy";

            let seedGen = new seedrandom(`sussy${seed}`);
            const espPadding = 3;
            const shadowColor = 0x242424ff;
            function generateESPImageFromHead(head: CCOIcons.anchorPointSchema["heads"][number]["positions"][number]) {
                const createdJimp = new Jimp(head.width + 1 + (espPadding * 2), head.width + 1 + (espPadding * 2), 0x00000000);
                fillHollowRect(createdJimp, 1, 1, head.width + (espPadding * 2), head.width + (espPadding * 2), shadowColor);
                fillHollowRect(createdJimp, 0, 0, head.width + (espPadding * 2), head.width + (espPadding * 2), 0xcf2929ff);
                return createdJimp;
            }

            const shadowMatrix: CCOIcons.strokeMatrix = [[0, 0, 0], [0, 0, 0], [0, 0, 1]];
            const barOutlineMatrix: CCOIcons.strokeMatrix = [[1, 1, 1], [1, 0, 1], [1, 1, 1]];
            const cubeHPImage = strokeImage(strokeImage(new Jimp(1, iconFrames[0].bitmap.height + (espPadding * 2) - 2, 0x479639ff), 0x345934ff, 1, false, barOutlineMatrix), shadowColor, 1, false, shadowMatrix);
            const cubeStaminaImage = strokeImage(strokeImage(new Jimp(1, iconFrames[0].bitmap.height + (espPadding * 2) - 2, 0xbf8e47ff), 0x594a34ff, 1, false, barOutlineMatrix), shadowColor, 1, false, shadowMatrix)

            const missingHP = seedGen() * (iconFrames[0].bitmap.height);
            const missingStamina = seedGen() * (iconFrames[0].bitmap.height);
            for (let missingHPIndex = 0; missingHPIndex < Math.max(missingHP, missingStamina); missingHPIndex++) {
                if (missingHP >= missingHPIndex) cubeHPImage.setPixelColor(shadowColor, 2, 2 + missingHPIndex);
                if (missingStamina >= missingHPIndex) cubeStaminaImage.setPixelColor(shadowColor, 2, 2 + missingHPIndex);
            }


            let usingCubeName = cubeData.name.split(' ')[0].slice(0, 6);
            if (usingCubeName !== cubeData.name) usingCubeName = `${usingCubeName}_`;
            const cubeNameImage = await generateSmallWordImage(usingCubeName.toUpperCase(), 0x00000000, 0x000000ff, 0);
            cubeNameImage.rotate(90);
            for (let iconFrameIndex = 0; iconFrameIndex < iconFrames.length; iconFrameIndex++) {
                const iconFrame = iconFrames[iconFrameIndex];
                const iconHeads = anchorPoints.heads[iconFrameIndex].positions;
                const constructedFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = [
                    {
                        image: cubeStaminaImage,
                        compositePosition: {
                            x: iconFrame.bitmap.width + 9,
                            y: -espPadding - 1
                        }
                    },
                    {
                        image: cubeHPImage,
                        compositePosition: {
                            x: iconFrame.bitmap.width + 4,
                            y: -espPadding - 1
                        }
                    },
                    {
                        image: cubeNameImage,
                        compositePosition: {
                            x: -cubeNameImage.bitmap.width - 3,
                            y: iconFrame.bitmap.height - cubeNameImage.bitmap.height + 4
                        }
                    }
                ];
                
                for (let iconHeadIndex = 0; iconHeadIndex < iconHeads.length; iconHeadIndex++) {
                    const iconHead = iconHeads[iconHeadIndex];
                    constructedFrame.push({
                        image: generateESPImageFromHead(iconHead),
                        compositePosition: {
                            x: iconHead.startPosition.x - espPadding,
                            y: iconHead.startPosition.y - espPadding - Math.floor(iconHead.width/4)
                        },
                        preventOutline: true
                    });
                }

                prefixFrames.frontFrames.push(constructedFrame);
            }

            return prefixFrames;
        }
    }, /*
    "Sleepy": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Disgusted": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Hypnotic": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            return structuredClone(basePrefixReturnObject)
        }
    }, */
    "Idiotic": {
        name: "Idiotic",
        tags: [],
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Idiotic";
            const teamCaptainHatImage = await Jimp.read(`${prefixSourceDirectory}/idiotic/dunce.png`);
            const cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/idiotic/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            const headPositions = anchorPoints.heads;

            for (let newAnimationIndex = 0; newAnimationIndex < headPositions.length; newAnimationIndex++) {
                const headFrame = headPositions[newAnimationIndex % headPositions.length];
                const hatsThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(teamCaptainHatImage, cacheDirectory, headFrame, { x: 0, y: 22, width: 32 });

                prefixFrames.frontFrames.push([...hatsThisFrame])
            }

            return prefixFrames;
        }
    }, /*
    "Nailed": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Farmboy": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Blurry": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Obfuscating": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Inverted": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Broken": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Angery": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Despairing": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Dookied": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Grinning": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Worthless": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData, allPrefixes) {
            return structuredClone(basePrefixReturnObject)
        }
    }
    */
} satisfies { [key: string]: CCOIcons.prefixDefinition };

/**
 * Describes the order in which prefixes should be applied; if applied in the wrong order, prefixes can look strange.
 */
const prefixIDApplicationOrder = [
    "Fake", // Turns the icon into a 'fake' PNG
    "Rippling", // Adds a sine wave to the cube
    "Musical", // Adds an animated music sheet to the cube

    // -------------- Special cases
    "Censored", // Adds a censor bar to the cube
    "Sussy", // Adds an ESP (cheater) overlay to the cube

    // -------------- Prefixes That Add Environmental Stuffs (Or just super large props)
    "Orbital", // Adds 3 orbiting planets to the cube
    "Endangered", // Adds a sword on a string above the cube
    "Radioactive", // Adds a 'stylistic' radioactive effect to the cube

    // -------------- Prefixes That Add Particles That don't depend on the cube
    "Leafy", // Adds some raining leaves to the cube
    "Snowy", // Adds some raining snow to the cube
    "Menacing", // Adds a jjba-style menacing effect to the cube
    "Bugged", // Adds a Glitchy 'Missing Texture' Animation to the Cube
    "Cursed", // Adds a spinning Pentagram beneath the Cube
    "Typing", // Adds a speech bubble with a random sequence of letters to the cube

    // -------------- Prefixes That Add Particles That depend on the cube itself (are bound to parts of the cube)
    "Flaming", // Makes the cube on FREAKING FIRE
    "Foggy", // Adds fog to the cube
    "Angry", // Adds an animated anime-esque anger icon to the cube
    "Thinking", // Adds a thought bubble with a question mark to the cube
    "Talkative", // Adds an animated yellow speech indicator to the cube
    "Eudaemonic", // Adds an animated happy face speech bubble to the cube
    "Acquiescing", // Adds a speech bubble with SIGH...
    "Zammin", // Adds a speech bubble with ZAMN
    "Feminine", // Adds a speech bubble with the "female" symbol inside
    "Masculine", // Adds a speech bubble with the "male" symbol inside
    "Annoyed", // Adds a fuzzball floating above the cube
    "Brilliant", // Adds a floating light bulb to the cube
    "Scientific", // Adds a sciency flask to the cube
    "Dazed", // Adds 'dazed' particles around the cube (I don't know what I was thinking when I created this prefix in 2020)
    "Boiled", // Adds steam coming off the cube
    "Amorous", // Adds hearts around the head of the cube
    "Drunken", // Adds a drunken stupor effect to the cube
    "Stunned", // Adds a cartoony "seeing stars" effect to the cube
    "Fearful", // Adds a fear 'sweat' animation to the cube
    "Based", // Adds Flashing Eyes to the Cube
    "Expensive", // Adds dollar signs to the eyes of the cube
    "Lovey", // Adds Heart Eyes to the Cube
    "Googly", // Adds Googly Eyes to the Cube
    "Expressive", // Adds sassy eyebrows to the Cube
    "Blushing", // Adds blush to the cube
    "Clapping", // Adds the twitch clapping emote to the cube
    "Insignificant", // Adds ULTRAKILL Gabriel-esque halo and wings to the cube
    "Holy", // Adds an embellished animated decoration to the cube
    "Unholy", // Adds an embellished animated decoration to the cube
    "Contaminated", // Adds a dripping and outline effect to the cube
    "Phosphorescent", // Adds a glow and outline effect to the cube

    // -------------- Prefixes That Add Props (Accessories that aren't bound to the cube's parts)
    "Summoning", // Adds spinning cubes to the cube
    "Swarming", // Adds spinning cubes to the cube
    "Runic", // Adds nordic runes and an outline to the cube
    "Mathematical", // Adds LCD numbers and an outline to the cube
    "Onomatopoeiacal", // Adds Onomatopoeia to the cube
    "Fatherly", // Adds one or two smaller versions of the cube to the cube
    "Saiyan", // Makes the cube yell super loud whilst charging
    "Electrified", // Adds arcing lightning to the cube
    "Cucurbitaphilic", // Adds a random pumpkin to the cube
    "Ailurophilic", // Adds a cat to the cube
    "Conspicuous", // Adds crime scene markers to the cube
    "Read", // Adds a tarot reading to the cube (swords, wands, etc.)

    // -------------- Prefixes That Add Accessories (Props that are bound to the cube's parts)
    "Sacred", // Adds a Fancy Halo to the Cube
    "Omniscient", // Adds an eye of providence to the Cube
    "Cuffed", // Adds a handcuff around the Cube
    "Sniping", // Adds a sniper rifle to the Cube
    "Marvelous", // Adds a Hand holding the Cube
    "Sparkly", // Adds a sparkling effect to the cube
    "Muscular", // Adds disgusting muscly arms to the cube
    "Leggendary", // Adds disgusting built-ass legs to the cube
    "Meleagris", // Adds a turkey tail to the cube
    "Collectible", // Adds a display case to the cube
    "Tumbling", // Adds the evangelion folding chair to the cube
    "Incarcerated", // Adds a Jail around the Cube
    "Pugilistic", // Adds boxing gloves to the Cube
    "Basking", // Adds sand and an umbrella to the cube
    "Bladed", // Adds a sword to the cube
    "Overcast", // Adds clouds around the cube
    "Emburdening", // Adds a statue of Atlas holding up the cube
    "Royal", // Adds a crown to the cube
    "Kramped", // Adds a pair of krampus horns to the cube
    "Oriental", // Adds an oriental-style roof to the cube
    "Wranglin'", // Adds a cowboy hat to the cube
    "Sophisticated", // Adds a top hat to the cube
    "Adorable", // Adds a cute little bow to the cube
    "Culinary", // Adds a chef's toque to the cube
    "Captain", // Adds a Team Captain hat to the cube
    "Idiotic", // Adds a dunce cap to the cube
    "Fuming", // Adds a set of steam coming out of the cube's "ears"
    "Magical", // Adds a wizard hat to the cube
    "Streaming", // Adds headphones to the cube
    "Sweetened", // Adds a cherry to the top of the cube
    "Trouvaille", // Adds a clover to the top of the cube
    "Dovey", // Adds a dove perched on the cube
    "Batty", // Adds a bat hanging from the cube NOTE: this is super gross. I don't like bats
    "Jolly", // Adds a Santa hat to the cube
    "Partying", // Adds a party hat to the cube
    "Hard-Boiled", // Adds a holmes-esque detective hat to the cube
    "Smoked", // Adds a GET SMOKED hat to the cube
    "Blind", // Adds a blindfold to the cube
    "Outlawed", // Adds a bandanna to the cube
    "Serving", // Adds a french-maid-style skirt and bonnet to the cube
    "Angelic", // Adds a halo to the cube
    "Dandy", // Adds dandy space hair to the cube
    "Beboppin'", // Adds space mercenary hair to the cube
    "Foolish", // Adds a jester Hat to the Cube
    "Cruel", // Adds Cruelty Squad-Inspired Glasses to the Cube
    "Neko", // Adds cat ears and tail to the cube
    "Tentacular", // Adds moving tentacles to the cube
    "Chained", // Adds moving chains to the cube
    "Adduced", // Adds moving caution tape to the cube
    "Roped", // Adds moving ropes to the cube
    "Bushy", // Adds a Random Beard to the Cube
    "Emphasized", // Adds a random amount of red arrows to the cube
    "Ornamentalized", // Adds a few christmas ornaments to the cube
    "Brainy", // Adds a gross brain to the cube
    "Comfortable", // Adds a pillow for the cube to sit on

    // -------------- Prefixes That Are Skin-Tight (idk how to phrase this)
    "Voodoo", // Adds pins and Xes to the cube
    "Swag", // Adds sunglasses to the cube
    "Stereoscopic", // Adds stereoscopic shades to the cube
    "Sick", // Adds a face mask to the cube
    "Gruesome", // Adds blood all over the cube
    "Canoodled", // Adds kiss-shaped lipstick to the cube in random spots
    "Hurt", // Adds bandaids to the cube in random spots
    "Glinting", // Adds a minecraft enchantment-esque glint animation
    "Hyaline", // Adds a sheen animation to the cube
    "Frosty", // Adds frost all over the cube
    "Glitchy", // Adds a Green Mask along with a particle rain inside that mask
    "RDMing", // Adds an animated gravity-gun outline to the cube
    "95in'", // Adds a Windows 95-esque application window to the cube
    "Wanted", // Adds a wanted poster to the cube

    // -------------- Prefixes That only generate masks
    "Phasing", // Adds a mask using an overengineered equation (https://www.desmos.com/calculator/mbxk8blmhp)
    "Evanescent", // Adds a mask using an overengineered equation (https://www.desmos.com/calculator/mbxk8blmhp)

    // -------------- Prefixes that only apply filters
    "Raving", // Hue shifts the cube every frame to create a 'rainbow' effect
    "DLC", // Turns the cube completely black

    // -------------- Attribute Effects should always be behind everything else
    "Divine", // Divine modifier for the cube
    "Slated", // Slated modifier for the cube
    "Contraband", // Contraband modifier for the cube
    "Collectors", // Collectors modifier for the cube
    "noprefix" // Placeholder prefix for "no prefix"
] as const satisfies CCOIcons.prefixID[];

/**
 * Sorting function to sort an array of prefixes in their intended application order
 */
function sortPrefixesByApplicationOrder(a: CCOIcons.prefixID, b: CCOIcons.prefixID) {
    // If 'a' and 'b' have red squiggly lines, that probably means that prefixIDApplicationOrder is missing a PrefixID
    const aIndex = prefixIDApplicationOrder.indexOf(a);
    const bIndex = prefixIDApplicationOrder.indexOf(b);
    if (aIndex > bIndex) {
        return -1;
    } else {
        return 1;
    }
}

export {
    prefixes,
    getNeededPaddingFromCompiledFrames,
    prefixIDApplicationOrder,
    sortPrefixesByApplicationOrder,
    prefixHasTag
}