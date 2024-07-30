import * as CCOIcons from './../../typedefs';
import * as config from './config';
import * as path from 'path';
import * as fs from 'fs-extra';
import Jimp from 'jimp';
import * as maths from '../maths';
import { drawLine, fillRect, loadAnimatedCubeIcon, saveAnimatedCubeIcon, strokeImage } from '../imageutils';
let seedrandom = require('seedrandom');

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

    console.log("Resize Target: ", resizeTarget)

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
    "Sacred": {
        name: "Sacred",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
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
        seeded: false,
        maskOnly: false,
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
        seeded: true,
        maskOnly: false,
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
        seeded: true,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: true,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let accentPositions = anchorPoints.accents;
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
                let accentFrameIndex = neededIconFrameIndex % accentPositions.length;

                const iconFrame = iconFrames[iconFrameIndex];

                const prefixFrame = new Jimp(iconFrame.bitmap.width, iconFrame.bitmap.height, maskColor);

                accentPositions[accentFrameIndex].coordinates.forEach(coordinate => {
                    prefixFrame.setPixelColor(accentMaskImage.getPixelColor(coordinate.x % accentMaskImage.bitmap.width, coordinate.y % accentMaskImage.bitmap.height), coordinate.x, coordinate.y);
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
        seeded: true,
        maskOnly: false,
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
        seeded: true,
        maskOnly: false,
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
                    x: Math.floor(seedGen() * (targetFrameSize.width - possibleLeafImages[0].bitmap.width)),
                    y: Math.floor(seedGen() * targetFrameSize.height)
                })
            }

            for (let animationFrameIndex = 0; animationFrameIndex < animationFrameCount; animationFrameIndex++) {
                const newAnimationFrame = new Jimp(targetFrameSize.width, targetFrameSize.height, 0x00000000);
                for (let leafIconIndex = 0; leafIconIndex < fallingLeaves.length; leafIconIndex++) {
                    const leafIcon = fallingLeaves[leafIconIndex];
                    const fallOffset = (targetFrameSize.height / animationFrameCount) * animationFrameIndex;
                    const leafAnimationIndex = (leafIcon.iconIndexOffset + animationFrameIndex) % animationFrameCount;
                    newAnimationFrame.composite(possibleLeafImages[leafAnimationIndex].clone().color(universalHueRotation), leafIcon.x, leafIcon.y + fallOffset);
                    newAnimationFrame.composite(possibleLeafImages[leafAnimationIndex].clone().color(universalHueRotation), leafIcon.x, (leafIcon.y - targetFrameSize.height) + fallOffset);
                }
                prefixFrames.frontFrames.push([{
                        image: newAnimationFrame,
                        compositePosition: {
                            x: Math.floor((iconFrames[0].bitmap.width - targetFrameSize.width) / 2),
                            y: 0
                        }
                    }]
                )
            }
            
            return prefixFrames;
        }
    },
    "Cruel": {
        name: "Cruel",
        seeded: true,
        maskOnly: false,
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
        seeded: true,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let seedRNG = new seedrandom(`orbital${seed}`);
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
            if (seedRNG() < 0.25) {
                allPlanets.push({
                    name: "Jupiter",
                    color: await Jimp.read(`${prefixSourceDirectory}/orbital/jupiter/planet.png`),
                    mask: await Jimp.read(`${prefixSourceDirectory}/orbital/jupiter/mask.png`),
                    shading: await Jimp.read(`${prefixSourceDirectory}/orbital/jupiter/shading.png`),
                    startingPercent: seedRNG() * 100,
                    speed: ((seedRNG() > 0.5) ? 1 : -1) * (1 + ((seedRNG() < 0.33) ? 1 : 0)),
                    generatedKeyFrames: []
                })
            }
            if (seedRNG() < 0.33) {
                allPlanets.push({
                    name: "Mars",
                    color: await Jimp.read(`${prefixSourceDirectory}/orbital/mars/planet.png`),
                    mask: await Jimp.read(`${prefixSourceDirectory}/orbital/mars/mask.png`),
                    shading: await Jimp.read(`${prefixSourceDirectory}/orbital/mars/shading.png`),
                    startingPercent: seedRNG() * 100,
                    speed: ((seedRNG() > 0.5) ? 1 : -1) * (1 + ((seedRNG() < 0.33) ? 1 : 0)),
                    generatedKeyFrames: []
                })
            }
            if (seedRNG() < 0.20) {
                allPlanets.push({
                    name: "Eris",
                    color: await Jimp.read(`${prefixSourceDirectory}/orbital/eris/planet.png`),
                    mask: await Jimp.read(`${prefixSourceDirectory}/orbital/eris/mask.png`),
                    shading: await Jimp.read(`${prefixSourceDirectory}/orbital/eris/shading.png`),
                    startingPercent: seedRNG() * 100,
                    speed: ((seedRNG() > 0.5) ? 1 : -1) * (1 + ((seedRNG() < 0.33) ? 1 : 0)),
                    generatedKeyFrames: []
                })
            }
            if (seedRNG() < 0.25 || allPlanets.length === 0) {
                allPlanets.push({
                    name: "Earth",
                    color: await Jimp.read(`${prefixSourceDirectory}/orbital/earth/planet.png`),
                    mask: await Jimp.read(`${prefixSourceDirectory}/orbital/earth/mask.png`),
                    shading: await Jimp.read(`${prefixSourceDirectory}/orbital/earth/shading.png`),
                    startingPercent: seedRNG() * 100,
                    speed: ((seedRNG() > 0.5) ? 1 : -1) * (1 + ((seedRNG() < 0.33) ? 1 : 0)),
                    generatedKeyFrames: []
                })
            }
            const neededAnimationFrameCount = maths.leastCommonMultipleOfArray(allPlanets.map(planetData => {
                return planetData.color.bitmap.width
            })) * 2;

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
        seeded: true,
        maskOnly: false,
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

            let seedRNG = new seedrandom(`flaming${seed}`);
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
            
            const fireColorIndex = Math.floor(decentFireColors.length * seedRNG());

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
        seeded: false,
        maskOnly: false,
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
        seeded: true,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let seedRNG = new seedrandom(`cursed${seed}`);
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Cursed";
            const baseImage = await Jimp.read(`${prefixSourceDirectory}/cursed/pentagram.png`);
            baseImage.color([{
                apply: "hue",
                params: [360 * seedRNG()]
            }])
            const cursedFrames = 15;
            const frameRotation = 72/cursedFrames;
            const rotationSpeed = ((seedRNG() > 0.5) ? 1 : -1) * 1;
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
        seeded: false,
        maskOnly: false,
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
        seeded: false,
        maskOnly: false,
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
        seeded: false,
        maskOnly: false,
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
        seeded: false,
        maskOnly: false,
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
        seeded: true,
        maskOnly: true,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed) {
            const phasingFrames = 20;
            let seedRNG = new seedrandom(`phasing${seed}`);
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Phasing";
            const frameOffset = phasingFrames * seedRNG();

            const animationBounds = (5 + (seedRNG() * 10)) * (iconFrames[0].bitmap.width / 32);

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
        seeded: true,
        maskOnly: true,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            const phasingFrames = 20;
            let seedRNG = new seedrandom(`evanescent${seed}`);
            let prefixFrames = structuredClone(basePrefixReturnObject);
            prefixFrames.sourceID = "Evanescent";
            const frameOffset = phasingFrames * seedRNG();

            const animationBounds = (5 + (seedRNG() * 10)) * (iconFrames[0].bitmap.height / 32);

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
        seeded: true,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            const ravingFrames = 15;
            let seedRNG = new seedrandom(`raving${seed}`);
            const frameOffset = ravingFrames * seedRNG();
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
        seeded: true,
        maskOnly: false,
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            let seedRNG = new seedrandom(`royal${seed}`);
            let crownType = Math.ceil(2*seedRNG());
            prefixFrames.sourceID = "Royal";
            const crownImage = await Jimp.read(`${prefixSourceDirectory}/royal/crown${crownType}.png`);
            const crownGemMask = await Jimp.read(`${prefixSourceDirectory}/royal/crown${crownType}gemmasks.png`);
            const crownGems = crownImage.clone().mask(crownGemMask, 0, 0);
            crownGems.color([{
                apply: "hue",
                params: [360 * seedRNG()]
            }, {
                apply: "brighten",
                params: [20 * seedRNG()]
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
        seeded: false,
        maskOnly: false,
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
        seeded: false,
        maskOnly: false,
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
            const cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/insignificant/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

            const headPositions = anchorPoints.heads;

            for (let newAnimationIndex = 0; newAnimationIndex < headPositions.length; newAnimationIndex++) {
                const headFrame = headPositions[newAnimationIndex % headPositions.length];
                const halosThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(haloImage, cacheDirectory, headFrame, { x: 74, y: 54, width: 32 });
                const wingsThisFrame: CCOIcons.compiledPrefixFrames["frontFrames"][number] = await compileHeadsForFrame(wingsImage, cacheDirectory, headFrame, { x: 74, y: 54, width: 32 });

                prefixFrames.frontFrames.push([...halosThisFrame]);
                prefixFrames.backFrames.push([...wingsThisFrame]);
            }

            return prefixFrames;
        }
    },
    "95in'": {
        name: "95in'",
        seeded: false,
        maskOnly: false,
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
        seeded: true,
        maskOnly: false,
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

            for (let animationFrameIndex = 0; animationFrameIndex < animationFrameCount; animationFrameIndex++) {
                const newAnimationFrame = new Jimp(targetFrameSize.width, targetFrameSize.height, 0x00000000);
                for (let snowflakeIconIndex = 0; snowflakeIconIndex < fallingSnowflakes.length; snowflakeIconIndex++) {
                    const snowflakeIcon = fallingSnowflakes[snowflakeIconIndex];
                    const fallOffset = (targetFrameSize.height / animationFrameCount) * animationFrameIndex;
                    const snowflakeAnimationIndex = (snowflakeIcon.iconIndexOffset + animationFrameIndex) % animationFrameCount;
                    const imageUsed = (snowflakeIcon.large) ? largeSnowflakeImages[snowflakeAnimationIndex]  : possibleSnowflakeImages[snowflakeAnimationIndex]
                    newAnimationFrame.composite(imageUsed, snowflakeIcon.x, snowflakeIcon.y + fallOffset);
                    newAnimationFrame.composite(imageUsed, snowflakeIcon.x, (snowflakeIcon.y - targetFrameSize.height) + fallOffset);
                }
                prefixFrames.frontFrames.push([{
                    image: newAnimationFrame,
                    compositePosition: {
                        x: Math.floor((iconFrames[0].bitmap.width - targetFrameSize.width) / 2),
                        y: 0
                    }
                }]
                )
            }

            return prefixFrames;
        }
    },/*
    "Tentacular": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Summoning": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Swarming": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Kramped": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Dandy": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Incarcerated": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Runic": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Rippling": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Emphasized": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Chained": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Angelic": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Menacing": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Serving": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Holy": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Unholy": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Contaminated": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Phosphorescent": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Neko": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Mathematical": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Wanted": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Onomatopoeiacal": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Smoked": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Basking": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Omniscient": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Sniping": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Beboppin'": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Hard-Boiled": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Angry": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Gruesome": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Outlawed": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Wranglin'": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Canoodled": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Saiyan": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Amorous": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Dazed": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Adduced": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Frosty": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Cowling": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Overcast": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Berserk": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Jolly": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Partying": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Sophisticated": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Culinary": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Eudaemonic": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Magical": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Blushing": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Sweetened": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Dovey": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Batty": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Streaming": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Clapping": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Musical": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Stunned": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Lovey": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Trouvaille": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Googly": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Expressive": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Talkative": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Muscular": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Leggendary": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Thinking": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Boiled": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Typing": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Blind": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Cucurbitaphilic": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Radioactive": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Read": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Foggy": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Fatherly": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Pugilistic": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Censored": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Sick": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Fearful": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Drunken": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Comfortable": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Swag": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Stereoscopic": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Scientific": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Brainy": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Roped": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Brilliant": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Sparkly": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Adorable": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Hurt": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Ailurophilic": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Fake": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Glinting": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Contraband": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Voodoo": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Annoyed": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Zammin": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "RDMing": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Acquiescing": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Fuming": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "DLC": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Feminine": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Masculine": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Ornamentalized": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Expensive": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Hyaline": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Sussy": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Sleepy": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Disgusted": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Hypnotic": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Idiotic": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Nailed": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Farmboy": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Blurry": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Obfuscating": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Inverted": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Broken": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Angery": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Despairing": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Dookied": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Grinning": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Worthless": {
        name: "",
        seeded: false,
        maskOnly: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    }
    */
} satisfies { [key: string]: CCOIcons.prefixDefinition };

/**
 * Describes the order in which prefixes should be applied; if applied in the wrong order, prefixes can look strange.
 */
const prefixIDApplicationOrder = [
    // -------------- Prefixes That Add Environmental Stuffs (Or just super large props)
    "Orbital", // Adds 3 orbiting planets to the cube
    "Endangered", // Adds a sword on a string above the cube

    // -------------- Prefixes That Add Particles That don't depend on the cube
    "Leafy", // Adds some raining leaves to the cube
    "Snowy", // Adds some raining snow to the cube
    "Bugged", // Adds a Glitchy 'Missing Texture' Animation to the Cube
    "Cursed", // Adds a spinning Pentagram beneath the Cube

    // -------------- Prefixes That Add Particles That depend on the cube itself (are bound to parts of the cube)
    "Flaming", // Makes the cube on FREAKING FIRE
    "Based", // Adds Flashing Eyes to the Cube
    "Insignificant", // Adds ULTRAKILL Gabriel-esque halo and wings to the cube

    // -------------- Prefixes That Add Props (Accessories that aren't bound to the cube's parts)
    
    // -------------- Prefixes That Add Accessories (Props that are bound to the cube's parts)
    "Sacred", // Adds a Fancy Halo to the Cube
    "Cuffed", // Adds a handcuff around the cube
    "Marvelous", // Adds a Hand holding the Cube
    "Emburdening", // Adds a statue of Atlas holding up the cube
    "Royal", // Adds a crown to the cube
    "Captain", // Adds a Team Captain hat to the cube
    "Foolish", // Adds a jester Hat to the Cube
    "Cruel", // Adds Cruelty Squad-Inspired Glasses to the Cube
    "Bushy", // Adds a Random Beard to the Cube

    // -------------- Prefixes That Are Skin-Tight (idk how to phrase this)
    "Glitchy", // Adds a Green Mask along with a particle rain inside that mask
    "95in'", // Adds a Windows 95-esque application window to the cube

    // -------------- Prefixes That only generate masks
    "Phasing", // Adds a mask using an overengineered equation (https://www.desmos.com/calculator/mbxk8blmhp)
    "Evanescent", // Adds a mask using an overengineered equation (https://www.desmos.com/calculator/mbxk8blmhp)

    // -------------- Prefixes that only apply filters
    "Raving" // Hue shifts the cube every frame to create a 'rainbow' effect
] as const;

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
    sortPrefixesByApplicationOrder
}