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

    // Compile all of the composite positions' top-leftmost needed pixels into an array
    let allBasePositions = frames.reduce((prev: CCOIcons.coordinate[], curr) => {
        return prev.concat(...curr.frontFrames.map(frameDataArray => {
            return frameDataArray.map(frameData => {
                return frameData.compositePosition
            })
        })).concat(...curr.backFrames.map(frameDataArray => {
            return frameDataArray.map(frameData => {
                return frameData.compositePosition
            })
        }))
    }, []);

    // Compile all of the composite positions' bottom-rightmost needed pixels into an array
    let allOffsetPositions = frames.reduce((prev: CCOIcons.coordinate[], curr) => {
        return prev.concat(...curr.frontFrames.map(frameDataArray => {
            return frameDataArray.map(frameData => {
                return {
                    x: frameData.compositePosition.x + frameData.image.bitmap.width,
                    y: frameData.compositePosition.y + frameData.image.bitmap.height
                }
            })
        })).concat(...curr.backFrames.map(frameDataArray => {
            return frameDataArray.map(frameData => {
                return {
                    x: frameData.compositePosition.x + frameData.image.bitmap.width,
                    y: frameData.compositePosition.y + frameData.image.bitmap.height
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

    // If we are no longer at a 1:1 aspect ratio, then add padding to each side evenly to reach it.
    if ((resizeTarget.left + resizeTarget.right) !== (resizeTarget.above + resizeTarget.below)) {
        let inlineSize = 0;
        let blockSize = 1;
        while (inlineSize !== blockSize) {
            if (inlineSize < blockSize) {
                if (resizeTarget.left < resizeTarget.right) {
                    resizeTarget.left++;
                } else {
                    resizeTarget.right++;
                }
            } else {
                if (resizeTarget.above < resizeTarget.below) {
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
 * @returns The resized prefix animation frames
 */
async function getResizedPrefixAnimation(targetWidth: number, targetHeight: number, cachePath: string, originalAnimation: Jimp[]): Promise<Jimp[]> {
    let targetFilePath = `${cachePath}/`;
    let targetFileName = `${targetWidth}x${targetHeight}.png`;

    // If we don't already have an image cached at this path, then we create it and save it at that path.
    if (!fs.existsSync(`${targetFilePath}${targetFileName}`)) {
        let newAnimation: Jimp[] = [];
        for (let originalAnimationFrameIndex = 0; originalAnimationFrameIndex < originalAnimation.length; originalAnimationFrameIndex++) {
            const originalAnimationFrame = originalAnimation[originalAnimationFrameIndex];
            newAnimation.push(originalAnimationFrame.clone());
            if (targetWidth !== originalAnimationFrame.bitmap.width || targetHeight !== originalAnimationFrame.bitmap.height) {
                newAnimation[newAnimation.length - 1].resize(targetWidth, targetHeight, Jimp.RESIZE_NEAREST_NEIGHBOR);
            }
        }
        await saveAnimatedCubeIcon(newAnimation, targetFileName, targetFilePath, 10);
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
 * @returns A single compiled prefix frame layer
 */
async function compileHeadsForFrame(prefixImage: Jimp, cachePath: string, allHeads: CCOIcons.anchorPointSchema["heads"][number], targetedHeadData: { x: number, y: number, width: number }): Promise<CCOIcons.compiledPrefixFrames["frontFrames"][number]> {
    let returnArray: CCOIcons.compiledPrefixFrames["frontFrames"][number] = [];
    for (let frameHeadIndex = 0; frameHeadIndex < allHeads.positions.length; frameHeadIndex++) {
        const head = allHeads.positions[frameHeadIndex];

        const headSizeResizeFactor = head.width / targetedHeadData.width;
        let headFrameImage = new Jimp(1, 1, 0x000000ff);

        let targetWidth = Math.ceil(prefixImage.bitmap.width * headSizeResizeFactor);
        let targetHeight = Math.ceil(prefixImage.bitmap.height * headSizeResizeFactor);
        headFrameImage = (await getResizedPrefixAnimation(targetWidth, targetHeight, cachePath, [prefixImage]))[0];

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
 * @returns A single compiled prefix frame layer
 * 
 * @note This just calls {@link compileHeadsForFrame} because the mouths and heads share the same data format, however this is declared separately just in case I need to change the scheme of the mouths or heads.
 */
async function compileMouthsForFrame(prefixImage: Jimp, cachePath: string, allMouths: CCOIcons.anchorPointSchema["mouths"][number], targetedMouthData: { x: number, y: number, width: number }): Promise<CCOIcons.compiledPrefixFrames["frontFrames"][number]> {
    return await compileHeadsForFrame(prefixImage, cachePath, allMouths, targetedMouthData);
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
    frameOutlines: []
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
            let cacheDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/prefixcache/based${seed}/`);
            if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });

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
    /*
    "Leafy": {
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
    "Cruel": {
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
    "Orbital": {
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
    "Flaming": {
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

export {
    prefixes,
    getNeededPaddingFromCompiledFrames
}