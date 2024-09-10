import * as CCOIcons from './../../typedefs';
import * as config from './config';
import * as path from 'path';
import * as fs from 'fs-extra';
import Jimp from 'jimp';
import * as maths from '../maths';
import { drawLine, fillRect, generateSmallWordImage, loadAnimatedCubeIcon, parseHorizontalSpriteSheet, saveAnimatedCubeIcon, strokeImage } from '../imageutils';
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
            prefixFrames.sourceID = "Slated";
            let accentFrames = anchorPoints.accents;
            let patternRNG = new seedrandom(`${cubeData.name}`);

            const contrabandEffectImage = await Jimp.read(`./sourceicons/attributeeffects/contraband.png`);
            const cropX = Math.ceil(patternRNG() * (contrabandEffectImage.bitmap.width - iconFrames[0].bitmap.width));
            const cropY = Math.ceil(patternRNG() * (contrabandEffectImage.bitmap.height - iconFrames[0].bitmap.height));
            contrabandEffectImage.crop(cropX, cropY, iconFrames[0].bitmap.width, iconFrames[0].bitmap.height);

            const contrabandOutlineThickness = 1;
            for (let frameIndex = 0; frameIndex < iconFrames.length; frameIndex++) {
                let contrabandEffectClone = contrabandEffectImage.clone();
                contrabandEffectClone.mask(accentFrames[frameIndex % accentFrames.length].image, 0, 0);
                prefixFrames.frontFrames.push([{
                    image: strokeImage(contrabandEffectClone, 0x000000ff, contrabandOutlineThickness, false, [[1, 1, 1], [1, 0, 1], [1, 1, 1]]),
                    compositePosition: {
                        x: -contrabandOutlineThickness,
                        y: -contrabandOutlineThickness
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
        tags: ["seeded"],
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
                
                prefixFrames.frontFrames.push([...swordsThisFrame])
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
                    { apply: "hue", params: [(360/ravingFrames)*(ravingFrameIndex+frameOffset)]},
                    { apply: "darken", params: [10]}
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
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let headPositions = anchorPoints.heads;
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Sniping";
            
            let headPositions = anchorPoints.heads;
            let seedGen = new seedrandom(`sniping${seed}`);

            const rifles = ["tf2", "cs2"]
            const rifleType = ((seedGen() > 0.98) ? 'rare' : '') + rifles[Math.floor(seedGen() * rifles.length)];

            let sacredHeadImage = await Jimp.read(`${prefixSourceDirectory}/sniping/${rifleType}rifle.png`);
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/sniping/${rifleType}/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            for (let headFrameIndex = 0; headFrameIndex < headPositions.length; headFrameIndex++) {
                const frameHeadPosition = headPositions[headFrameIndex];
                const headImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(sacredHeadImage, cacheDirectory, frameHeadPosition, { x: 29, y: 14, width: 32 });
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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

            let bandannaBackDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/outlawed/back/`);
            if (!fs.existsSync(bandannaBackDirectory)) fs.mkdirSync(bandannaBackDirectory, { recursive: true });
            let bandannaFrontDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/outlawed/front/`);
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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

                const crontCloudImagesThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(frontCloudsImage, frontCloudsDirectory, frameHeadPosition, { x: 8, y: 16, width: 32 });
                prefixFrames.frontFrames.push(crontCloudImagesThisFrame);
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Eudaemonic";
            let headPositions = anchorPoints.heads;

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

            return prefixFrames;
        }
    }, /*
    "Magical": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Blushing": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Sweetened": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Dovey": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Batty": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Streaming": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Clapping": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Musical": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Stunned": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Lovey": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Trouvaille": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Googly": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Expressive": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Talkative": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Muscular": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Leggendary": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Thinking": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Boiled": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Typing": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Blind": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Cucurbitaphilic": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Radioactive": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Read": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Foggy": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Fatherly": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Pugilistic": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Censored": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Sick": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Fearful": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Drunken": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Comfortable": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Swag": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Stereoscopic": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Scientific": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Brainy": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Roped": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Brilliant": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Sparkly": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Adorable": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Hurt": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Ailurophilic": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Fake": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Glinting": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Contraband": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Voodoo": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Annoyed": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Zammin": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "RDMing": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Acquiescing": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Fuming": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "DLC": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Feminine": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Masculine": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Ornamentalized": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Expensive": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Hyaline": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Sussy": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Sleepy": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Idiotic": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Nailed": {
        name: "",
        tags: [],
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
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
        compileFrames: async function(anchorPoints, iconFrames, seed, cubeData) {
            return structuredClone(basePrefixReturnObject)
        }
    }
    */
} satisfies { [key: string]: CCOIcons.prefixDefinition };

/**
 * Describes the order in which prefixes should be applied; if applied in the wrong order, prefixes can look strange.
 */
const prefixIDApplicationOrder = [
    "Rippling", // Adds a sine wave to the cube

    // -------------- Prefixes That Add Environmental Stuffs (Or just super large props)
    "Orbital", // Adds 3 orbiting planets to the cube
    "Endangered", // Adds a sword on a string above the cube

    // -------------- Prefixes That Add Particles That don't depend on the cube
    "Leafy", // Adds some raining leaves to the cube
    "Snowy", // Adds some raining snow to the cube
    "Menacing", // Adds a jjba-style menacing effect to the cube
    "Bugged", // Adds a Glitchy 'Missing Texture' Animation to the Cube
    "Cursed", // Adds a spinning Pentagram beneath the Cube

    // -------------- Prefixes That Add Particles That depend on the cube itself (are bound to parts of the cube)
    "Flaming", // Makes the cube on FREAKING FIRE
    "Angry", // Adds an animated anime-esque anger icon to the cube
    "Eudaemonic", // Adds an animated happy face speech bubble to the cube
    "Dazed", // Adds 'dazed' particles around the cube (I don't know what I was thinking when I created this prefix in 2020)
    "Amorous", // Adds hearts around the head of the cube
    "Based", // Adds Flashing Eyes to the Cube
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
    "Saiyan", // Makes the cube yell super loud whilst charging
    "Electrified", // Adds arcing lightning to the cube

    // -------------- Prefixes That Add Accessories (Props that are bound to the cube's parts)
    "Sacred", // Adds a Fancy Halo to the Cube
    "Omniscient", // Adds an eye of providence to the Cube
    "Cuffed", // Adds a handcuff around the Cube
    "Sniping", // Adds a sniper rifle to the Cube
    "Marvelous", // Adds a Hand holding the Cube
    "Incarcerated", // Adds a Jail around the Cube
    "Basking", // Adds sand and an umbrella to the cube
    "Bladed", // Adds a sword to the cube
    "Overcast", // Adds clouds around the cube
    "Emburdening", // Adds a statue of Atlas holding up the cube
    "Royal", // Adds a crown to the cube
    "Kramped", // Adds a pair of krampus horns to the cube
    "Wranglin'", // Adds a cowboy hat to the cube
    "Sophisticated", // Adds a top hat to the cube
    "Culinary", // Adds a chef's toque to the cube
    "Captain", // Adds a Team Captain hat to the cube
    "Jolly", // Adds a Santa hat to the cube
    "Partying", // Adds a party hat to the cube
    "Hard-Boiled", // Adds a holmes-esque detective hat to the cube
    "Smoked", // Adds a GET SMOKED hat to the cube
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
    "Bushy", // Adds a Random Beard to the Cube
    "Emphasized", // Adds a random amount of red arrows to the cube

    // -------------- Prefixes That Are Skin-Tight (idk how to phrase this)
    "Gruesome", // Adds blood all over the cube
    "Canoodled", // Adds kiss-shaped lipstick to the cube in random spots
    "Frosty", // Adds frost all over the cube
    "Glitchy", // Adds a Green Mask along with a particle rain inside that mask
    "95in'", // Adds a Windows 95-esque application window to the cube
    "Wanted", // Adds a wanted poster to the cube

    // -------------- Prefixes That only generate masks
    "Phasing", // Adds a mask using an overengineered equation (https://www.desmos.com/calculator/mbxk8blmhp)
    "Evanescent", // Adds a mask using an overengineered equation (https://www.desmos.com/calculator/mbxk8blmhp)

    // -------------- Prefixes that only apply filters
    "Raving", // Hue shifts the cube every frame to create a 'rainbow' effect

    // -------------- Divine and Slated Effects should always be behind everything else
    "Divine", // Divine modifier for the cube
    "Slated", // Slated modifier for the cube
    "Contraband", // Contraband modifier for the cube
    "Collectors" // Collectors modifier for the cube
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