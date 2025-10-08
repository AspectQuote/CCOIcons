import Jimp from 'jimp';
import { createBSideImage, deltaE, prepareImageForBSideV1 } from './bside';
import { bSideMaxPixels } from './schematics/config';

function twoColorsAreSimilar(color1: number, color2: number, deltaMax: number) {
    // r = COLOR >> 24 & 0xff
    // g = COLOR >> 16 & 0xff
    // b = COLOR >> 8 & 0xff
    return deltaE(
        [color1 >> 24 & 0xff, color1 >> 16 & 0xff, color1 >> 8 & 0xff],
        [color2 >> 24 & 0xff, color2 >> 16 & 0xff, color2 >> 8 & 0xff]
    ) <= deltaMax;
}

/**
 * Creates an "average" color between two colors (RGB blending)
 * @param color1 The first color to be blended, takes color in the form 0xRRGGBBAA
 * @param color2 The second color to be blended, takes color in the form 0xRRGGBBAA
 * @returns The blended color
 */
function dumbBlend(color1: number, color2: number) {
    // Creates erroneous colors. probably needs to be reworked.
    return [
        Math.min(256, Math.max(0, Math.ceil(((color1 >> 24 & 0xff) + (color2 >> 24 & 0xff)) / 2))).toString(16),
        Math.min(256, Math.max(0, Math.ceil(((color1 >> 16 & 0xff) + (color2 >> 16 & 0xff)) / 2))).toString(16),
        Math.min(256, Math.max(0, Math.ceil(((color1 >> 8 & 0xff) + (color2 >> 8 & 0xff)) / 2))).toString(16),
    ].join('');
}

/**
 * Creates a B-Side image from an input image. Input image doesn't have to be posterized or downscaled.
 * @param originalImage The image to be b-side-ified
 * @param similarThereshold a number 0-100, tells the algorithm what colors are "similar" enough to count as the same.
 * @param maxIteration The number of times to run the algorithm (higher number increases the quality but takes much, much more time to render.)
 * @param blendType The blending algorithm to use. "random" creates splotchy images, "gradient" has the highest performance cost but creates the smoothest blending, "dithered" creates a patterned dithering effect to blend colors.
 * @param iteration Used by the function to control the current iteration, do not pass this.
 * @param resizeMode The resize algorithm to use. Bicubic is default, but nearest-neighbor and bilinear create interesting effects
 * @returns The b-side-ified image.
 */
async function createBSideV2Image(originalImage: Jimp, similarThereshold: number = 5, maxIteration: number = 3, blendType: "random" | "gradient" | "dithered" = "dithered", iteration: number = 1, resizeMode: "hermiteInterpolation" | "bezierInterpolation" | "bicubicInterpolation" | "bilinearInterpolation" | "nearestNeighbor" = Jimp.RESIZE_BICUBIC) {
    // const before = performance.now();
    if (iteration === 1) {
        const maxPixels = bSideMaxPixels;
        if (originalImage.bitmap.width * originalImage.bitmap.height > maxPixels) {
            const scaleChange = Math.sqrt(maxPixels / (originalImage.bitmap.width * originalImage.bitmap.height));
            console.log(`\nScale Change Applied. Original Pixel Count: ${originalImage.bitmap.width * originalImage.bitmap.height}\nNew Pixel Count: ${originalImage.bitmap.width * scaleChange * originalImage.bitmap.height * scaleChange}`);
            originalImage.resize(Math.ceil(originalImage.bitmap.width * scaleChange), Math.ceil(originalImage.bitmap.height * scaleChange), resizeMode);
        }
    }

    const newImage = new Jimp(originalImage.bitmap.width * 2, originalImage.bitmap.height * 2, 0x000000ff);
    newImage.scan(0, 0, newImage.bitmap.width, newImage.bitmap.height, function(x, y, idx) {
        const originalImageX = Math.floor(x/2);
        const originalImageY = Math.floor(y/2);

        const adjacentPixelColor1 = originalImage.getPixelColor(originalImageX + (((x % 2) === 1) ? 1 : -1), originalImageY);
        const adjacentPixelColor2 = originalImage.getPixelColor(originalImageX, originalImageY + (((y % 2) === 1) ? 1 : -1));

        // console.log(`\nPosition: (${x}, ${y}) (${oddY ? 'B' : 'T'}${oddX ? 'R' : 'L'}) | (${originalImagePosition.x}, ${originalImagePosition.y}) checks:\n(${originalImagePosition.x + checkingXNum}, ${originalImagePosition.y}) and (${originalImagePosition.x}, ${originalImagePosition.y + checkingYNum})`)

        if ((adjacentPixelColor1 >> 0 & 0xff) === 0 || (adjacentPixelColor2 >> 0 & 0xff) === 0 || (adjacentPixelColor1 !== adjacentPixelColor2 && !twoColorsAreSimilar(adjacentPixelColor1, adjacentPixelColor2, similarThereshold))) {
            newImage.setPixelColor(originalImage.getPixelColor(originalImageX, originalImageY), x, y);
        } else {
            switch (blendType) {
                case "random":
                    newImage.setPixelColor((Math.random() > 0.5) ? adjacentPixelColor1 : adjacentPixelColor2, x, y);
                    break;
                case 'gradient':
                    const newColor = Jimp.cssColorToHex(`#${dumbBlend(adjacentPixelColor1, adjacentPixelColor2)}`);
                    newImage.setPixelColor(newColor, x, y);
                    break;
                case 'dithered':
                    newImage.setPixelColor(((( x + y ) % 2) == 0) ? adjacentPixelColor2 : adjacentPixelColor1, x, y);
                    break;
                default:
                    break;
            }
        }
    })


    // const after = performance.now();
    // console.log(`B-Side V2: Finished Iteration #${iteration} in ${after-before}ms.`);
    if (iteration === maxIteration) {
        return newImage;
        // return newImage.resize(newImage.bitmap.width * 6, newImage.bitmap.height * 6, Jimp.RESIZE_NEAREST_NEIGHBOR);
    } else {
        return createBSideV2Image(newImage, similarThereshold, maxIteration, blendType, iteration + 1);
    }
}

async function generateBSideVersionComparison(image: Jimp, quality: number) {
    const beforeFirstVersion = performance.now();
    const originalBSideImage = await createBSideImage(prepareImageForBSideV1(image.clone(), 0.075, 20), quality);
    const beforeSecondVersion = performance.now();
    console.log(`Version 1: ${beforeSecondVersion - beforeFirstVersion}ms`);
    const newBSideImage = await createBSideV2Image(image.clone(), undefined, quality);
    const afterBoth = performance.now();
    console.log(`Version 2: ${afterBoth - beforeSecondVersion}ms`);
    const compositeImage = new Jimp(originalBSideImage.bitmap.width + newBSideImage.bitmap.width, Math.max(originalBSideImage.bitmap.height, newBSideImage.bitmap.height));
    compositeImage.composite(originalBSideImage, 0, 0);
    compositeImage.composite(newBSideImage, originalBSideImage.bitmap.width, 0);
    return compositeImage;
}

async function generateV2BlendComparison(image: Jimp, quality: number) {
    const blendTypes = ["random", "gradient", "dithered"] as const;
    const outputImages: Jimp[] = [];

    for (let blendTypeIndex = 0; blendTypeIndex < blendTypes.length; blendTypeIndex++) {
        const before = performance.now();
        const blendType = blendTypes[blendTypeIndex];
        const newImage = await createBSideV2Image(image.clone(), 10, quality, blendType);
        // console.log(newImage.bitmap.width, newImage.bitmap.height, newImageWidth);
        outputImages.push(newImage);
        const after = performance.now();
        console.log(`${blendType.toUpperCase()}: ${after - before}ms`);
    }

    const newImageWidth = outputImages[0].bitmap.width;
    const compositeImage = new Jimp(newImageWidth * blendTypes.length, outputImages[0].bitmap.height);
    for (let outputImageIndex = 0; outputImageIndex < outputImages.length; outputImageIndex++) {
        const outputImage = outputImages[outputImageIndex];
        compositeImage.composite(outputImage, outputImage.bitmap.width * outputImageIndex, 0);
    }

    return compositeImage;
}

async function generateBSideV2TheresholdComparison(originalImage: Jimp, steps: number, min: number, max: number, quality: number) {
    const incrementor = (max - min) / steps;

    const scalar = (2 ** quality);
    const finalImage = new Jimp(originalImage.bitmap.width * scalar * steps, originalImage.bitmap.height * scalar);

    for (let stepIndex = 0; stepIndex < steps; stepIndex++) {
        finalImage.composite(await createBSideV2Image(originalImage, min + (incrementor * stepIndex), quality), originalImage.bitmap.width * scalar * stepIndex, 0);
    }

    return finalImage;
}

async function generateBSideV2InterpolationComparison(image: Jimp, quality: number) {
    const interpolationTypes = [Jimp.RESIZE_BEZIER, Jimp.RESIZE_BICUBIC, Jimp.RESIZE_HERMITE] as const;
    const outputImages: Jimp[] = [];
    
    for (let interpolationTypeIndex = 0; interpolationTypeIndex < interpolationTypes.length; interpolationTypeIndex++) {
        const before = performance.now();
        const interpolationType = interpolationTypes[interpolationTypeIndex];
        const newImage = await createBSideV2Image(image.clone(), undefined, quality, "dithered", 1, interpolationType);
        // console.log(newImage.bitmap.width, newImage.bitmap.height, newImageWidth);
        outputImages.push(newImage);
        const after = performance.now();
        console.log(`${interpolationType.toUpperCase()}: ${after - before}ms`);
    }

    const newImageWidth = outputImages[0].bitmap.width;
    const compositeImage = new Jimp(newImageWidth * interpolationTypes.length, outputImages[0].bitmap.height);
    for (let outputImageIndex = 0; outputImageIndex < outputImages.length; outputImageIndex++) {
        const outputImage = outputImages[outputImageIndex];
        compositeImage.composite(outputImage, outputImage.bitmap.width * outputImageIndex, 0);
    }

    return compositeImage;
}

async function generateBSideV2BlendAndInterpolationComparison(image: Jimp, quality: number) {
    const blendTypes = ["random", "gradient", "dithered"] as const;
    const interpolationTypes = [Jimp.RESIZE_BEZIER, Jimp.RESIZE_BICUBIC, Jimp.RESIZE_BILINEAR, Jimp.RESIZE_HERMITE, Jimp.RESIZE_NEAREST_NEIGHBOR] as const;

    const outputRows: Jimp[] = [];

    for (let blendTypeIndex = 0; blendTypeIndex < blendTypes.length; blendTypeIndex++) {
        const blendType = blendTypes[blendTypeIndex];
        const outputImages: Jimp[] = [];
        for (let interpolationTypeIndex = 0; interpolationTypeIndex < interpolationTypes.length; interpolationTypeIndex++) {
            const before = performance.now();
            const interpolationType = interpolationTypes[interpolationTypeIndex];
            const newImage = await createBSideV2Image(image.clone(), undefined, quality, blendType, 1, interpolationType);
            // console.log(newImage.bitmap.width, newImage.bitmap.height, newImageWidth);
            outputImages.push(newImage);
            const after = performance.now();
            console.log(`${interpolationType.toUpperCase()}: ${after - before}ms`);
        }
    
        const newImageWidth = outputImages[0].bitmap.width;
        const rowImage = new Jimp(newImageWidth * interpolationTypes.length, outputImages[0].bitmap.height);
        for (let outputImageIndex = 0; outputImageIndex < outputImages.length; outputImageIndex++) {
            const outputImage = outputImages[outputImageIndex];
            rowImage.composite(outputImage, outputImage.bitmap.width * outputImageIndex, 0);
        }
        outputRows.push(rowImage);
    }

    const finalImageHeight = outputRows[0].bitmap.height;
    const finalImage = new Jimp(outputRows[0].bitmap.width, finalImageHeight * blendTypes.length);
    for (let outputRowIndex = 0; outputRowIndex < outputRows.length; outputRowIndex++) {
        const outputRowImage = outputRows[outputRowIndex];
        finalImage.composite(outputRowImage, 0, finalImageHeight * outputRowIndex);
    }

    return finalImage;
}

export {
    createBSideV2Image,
    generateBSideVersionComparison,
    generateBSideV2TheresholdComparison,
    generateV2BlendComparison,
    generateBSideV2InterpolationComparison,
    generateBSideV2BlendAndInterpolationComparison
}