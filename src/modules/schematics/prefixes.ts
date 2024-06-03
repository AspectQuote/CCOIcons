import * as CCOIcons from './../../typedefs';
import * as config from './config';
import * as path from 'path';
import * as fs from 'fs-extra';
import Jimp from 'jimp';
import * as maths from '../maths';
import { loadAnimatedCubeIcon, saveAnimatedCubeIcon, strokeImage } from '../imageutils';
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

    // const strokeOffset = frames.reduce((prev: number, curr) => {
    //     return prev + (curr.frameOutlines.reduce((prev: number, curr) => {
    //         return curr.width;
    //     }, 0))
    // }, 0);

    // Compile all of the composite positions' top-leftmost needed pixels into an array
    let allBasePositions = frames.reduce((prev: CCOIcons.coordinate[], curr) => {
        return prev.concat(...curr.frontFrames.map(frameDataArray => {
            return frameDataArray.map(frameData => {
                return {
                    x: frameData.compositePosition.x, // - strokeOffset,
                    y: frameData.compositePosition.y // - strokeOffset
                }
            })
        })).concat(...curr.backFrames.map(frameDataArray => {
            return frameDataArray.map(frameData => {
                return {
                    x: frameData.compositePosition.x, // - strokeOffset,
                    y: frameData.compositePosition.y // - strokeOffset
                }
            })
        }))
    }, []);

    // Compile all of the composite positions' bottom-rightmost needed pixels into an array
    let allOffsetPositions = frames.reduce((prev: CCOIcons.coordinate[], curr) => {
        return prev.concat(...curr.frontFrames.map(frameDataArray => {
            return frameDataArray.map(frameData => {
                return {
                    x: frameData.compositePosition.x + frameData.image.bitmap.width, // + strokeOffset,
                    y: frameData.compositePosition.y + frameData.image.bitmap.height // + strokeOffset
                }
            })
        })).concat(...curr.backFrames.map(frameDataArray => {
            return frameDataArray.map(frameData => {
                return {
                    x: frameData.compositePosition.x + frameData.image.bitmap.width, // + strokeOffset,
                    y: frameData.compositePosition.y + frameData.image.bitmap.height // + strokeOffset
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
    if (!fs.existsSync(`${targetFilePath}${targetFileName}`) || !performCaching) {
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
    outlineFrames: []
};

const prefixes = {
    "Sacred": {
        name: "Sacred",
        seeded: false,
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);

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
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
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
        needs: {
            heads: false,
            eyes: true,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let eyePositions = anchorPoints.eyes;
            let prefixFrames = structuredClone(basePrefixReturnObject);

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
        needs: {
            heads: false,
            eyes: false,
            accents: true,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let accentPositions = anchorPoints.accents;
            let prefixFrames = structuredClone(basePrefixReturnObject);

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
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: true
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let mouthPositions = anchorPoints.mouths;
            let prefixFrames = structuredClone(basePrefixReturnObject);

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
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let prefixFrames = structuredClone(basePrefixReturnObject);
            
            let seedGen = new seedrandom(`leafy${seed}`);
            const animationFrameCount = 15; // Yes, there are 16 frames in the animation. However, 16 is not divisible 5... I'm trying to keep prefix animation frame counts at intervals of 5 to make sure their least common multiple is more manageable.
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
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);

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
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let seedRNG = new seedrandom(`orbital${seed}`);
            let prefixFrames = structuredClone(basePrefixReturnObject);
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
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function(anchorPoints, iconFrames, seed) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);

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
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: async function (anchorPoints, iconFrames, seed) {
            let headPositions = anchorPoints.heads;
            let prefixFrames = structuredClone(basePrefixReturnObject);

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
    },/*
    "Cursed": {
        name: "",
        seeded: false,
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
    "Emburdening": {
        name: "",
        seeded: false,
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
    "Cuffed": {
        name: "",
        seeded: false,
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
    "Endangered": {
        name: "",
        seeded: false,
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
    "Marvelous": {
        name: "",
        seeded: false,
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
    "Phasing": {
        name: "",
        seeded: false,
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
    "Tentacular": {
        name: "",
        seeded: false,
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
    "Evanescent": {
        name: "",
        seeded: false,
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
    "Royal": {
        name: "",
        seeded: false,
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
    "Captain": {
        name: "",
        seeded: false,
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
    "Insignificant": {
        name: "",
        seeded: false,
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
    "95in'": {
        name: "",
        seeded: false,
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
    "Snowy": {
        name: "",
        seeded: false,
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
    "Raving": {
        name: "",
        seeded: false,
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

    // -------------- Prefixes That Add Particles That don't depend on the cube
    "Leafy", // Adds some raining leaves to the cube
    "Bugged", // Adds a Glitchy 'Missing Texture' Animation to the Cube

    // -------------- Prefixes That Add Particles That depend on the cube itself (are bound to parts of the cube)
    "Flaming", // Makes the cube on FREAKING FIRE
    "Based", // Adds Flashing Eyes to the Cube

    // -------------- Prefixes That Add Props (Accessories that aren't bound to the cube's parts)

    // -------------- Prefixes That Add Accessories (Props that are bound to the cube's parts)
    "Sacred", // Adds a Fancy Halo to the Cube
    "Foolish",
    "Cruel", // Adds Cruelty Squad-Inspired Glasses to the Cube
    "Bushy", // Adds a Random Beard to the Cube

    // -------------- Prefixes That Are Skin-Tight (idk how to phrase this)
    "Glitchy", // Adds a Green Mask along with a particle rain inside that mask

    // -------------- Prefixes That Replace The Original Cube (modifies the original image)
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