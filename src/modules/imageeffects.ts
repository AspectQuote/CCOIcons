import { brightenImage, generateImageComparison, hsv2rgb, hueShiftImage, numberLiteralFromRGBA, saturateImage, setImageSaturate, vibrantizeImage } from './imageutils';
import { clampForRGB, gaussianBlur } from './cubeiconutils';
import Jimp from 'jimp';

import { ditherImage, fakeDither, generateTwoToneImage } from './../modules/dither';
import { pixelSortFilter } from './../modules/pixelsortfilter';
import { basicKuwaharaFilter } from './basickuwahara';
import { generateContrastMask, generateContrastMaskComparison } from './contrastmask';
import { createBSideV2Image } from './bsidev2';
import { generatePopArtFourSquare } from './popartfoursquare';
import { gaussianEdgeDetection, sharpenedImageComparison, sharpenImage } from './sharpness';
import { sepia } from './sepia';
import { chromaticAbberation } from './abberation';
import { CRTEffect } from './crtscreen';
import { mosaicEffect } from './mosaic';
import { quantizeImage } from './quantize';

export const filterIDs = ["quantize", "fakescreentone", "specialscreentone", "random", "kuwahara", "pixelsort", "contrastmask", "bside", "contrastmaskcomparison", "dither", "twotone", "popartfoursquare", "sharpen", "edgedetection", "sepia", "sharpenanddither", "sepiaandsharpen", "extremesharpen", "hueshift", "brighten", "saturate", "vibrantize", "custom", "chromaticabberate", "crtscreen", "mosaic", "fakedither", "screentone"] as const;
export type filterID = typeof filterIDs[number];

export async function applyImageEffect(inputImage: Jimp, filterName: filterID, randomParameters: boolean) {
    const blackListedRandomFilters: filterID[] = ["random", "contrastmask", "contrastmaskcomparison", "edgedetection", "custom"];
    if (filterName == "random") {
        const validFilterIDs = filterIDs.filter(filter => !blackListedRandomFilters.includes(filter));
        filterName = validFilterIDs[Math.floor(Math.random() * validFilterIDs.length)];
    }

    const pixelSortDirections = ["rtl", "ltr", "btt", "ttb"] as const;
    const contrastMaskLow = 0.05;
    const contrastMaskHigh = 0.8;
    const gaussianRadius = 5;
    const usingDitherMatrix = 8;
    const quantizeColors = 12;
    const ditherSpread = 0.1;
    const ditherScaleFactor = 3;
    const sharpnessIntensity = 2;

    let twoToneHSV: number[];

    if (randomParameters) {
        twoToneHSV = [Math.random() * 360, 0.2, 0.5];
    } else {
        twoToneHSV = [0, 0, 1];
    }
    const twoTonesHighRGB = hsv2rgb(twoToneHSV[0], twoToneHSV[1], twoToneHSV[2]).map(num => Math.floor(clampForRGB(num * 255)));
    const twoTonesLowRGB = hsv2rgb(twoToneHSV[0], twoToneHSV[1], twoToneHSV[2] * 0.5).map(num => Math.floor(clampForRGB(num * 255)));
    const twoTonesHighTone = numberLiteralFromRGBA(twoTonesHighRGB[0], twoTonesHighRGB[1], twoTonesHighRGB[2], 0xff);
    const twoTonesLowTone = numberLiteralFromRGBA(twoTonesLowRGB[0], twoTonesLowRGB[1], twoTonesLowRGB[2], 0xff);

    const maxPixels = 1100 ** 2;
    const scaleChange = Math.sqrt(maxPixels / (inputImage.bitmap.width * inputImage.bitmap.height));
    console.log(`\n[Filters] Scale Change Applied. Original Pixel Count: ${inputImage.bitmap.width * inputImage.bitmap.height}\nNew Pixel Count: ${inputImage.bitmap.width * scaleChange * inputImage.bitmap.height * scaleChange}`);
    inputImage.resize(Math.ceil(inputImage.bitmap.width * scaleChange), Math.ceil(inputImage.bitmap.height * scaleChange), Jimp.RESIZE_BICUBIC);

    let outputImage: Jimp;

    switch (filterName) {
        case "kuwahara":
            outputImage = await basicKuwaharaFilter(inputImage);
            break;
        case "pixelsort":
            outputImage = await pixelSortFilter(inputImage, randomParameters ?  pixelSortDirections[Math.floor(Math.random() * pixelSortDirections.length)] : "btt", contrastMaskLow, contrastMaskHigh);
            break;
        case "contrastmask":
            outputImage = await generateContrastMask(inputImage, contrastMaskLow, contrastMaskHigh);
            break;
        case "contrastmaskcomparison":
            outputImage = await generateContrastMaskComparison(inputImage, contrastMaskLow, contrastMaskHigh);
            break;
        case "bside":
            outputImage = await createBSideV2Image(inputImage, undefined, 4);
            // outputImage = await quantizeImage(outputImage, quantizeColors);
            break;
        case "dither":
            outputImage = await ditherImage(inputImage, usingDitherMatrix, ditherSpread, quantizeColors, ditherScaleFactor);
            break;
        case "twotone":
            outputImage = await generateTwoToneImage(inputImage, usingDitherMatrix, undefined, twoTonesHighTone, twoTonesLowTone);
            break;
        case "popartfoursquare":
            outputImage = await generatePopArtFourSquare(inputImage);
            break;
        case "sharpen":
            // const oldInput = inputImage.clone();
            outputImage = await sharpenImage(inputImage, sharpnessIntensity, gaussianRadius);
            // outputImage = await generateImageComparison(oldInput, outputImage);
            // outputImage = await sharpenedImageComparison(inputImage);
            break;
        case "extremesharpen":
            outputImage = await sharpenImage(inputImage, sharpnessIntensity * 1.5, gaussianRadius);
            break;
        case "edgedetection":
            outputImage = await gaussianEdgeDetection(inputImage, gaussianRadius);
            break;
        case "sepia":
            outputImage = await sepia(inputImage);
            break;
        case "sharpenanddither":
            outputImage = await sharpenImage(inputImage, sharpnessIntensity, gaussianRadius);
            outputImage = await ditherImage(outputImage, usingDitherMatrix, ditherSpread, quantizeColors, ditherScaleFactor);
            break;
        case "sepiaandsharpen":
            outputImage = await sharpenImage(inputImage, sharpnessIntensity, gaussianRadius);
            outputImage = await sepia(outputImage);
            break;
        case "hueshift":
            const hueShift = randomParameters ? (Math.random() * 300) + 40 : 180;
            outputImage = await hueShiftImage(inputImage, hueShift);
            break;
        case "brighten":
            const brightnessChange = 0.2;
            outputImage = await brightenImage(inputImage, brightnessChange);
            break;
        case "saturate":
            const saturationChange = 0.2;
            outputImage = await saturateImage(inputImage, saturationChange);
            break;
        case "vibrantize":
            const vibranceChange = 0.2;
            outputImage = await vibrantizeImage(inputImage, vibranceChange);
            break;
        case "chromaticabberate":
            outputImage = await chromaticAbberation(inputImage, {
                x: 5,
                y: 5
            }, 0);
            break;
        case "crtscreen":
            outputImage = await CRTEffect(inputImage);
            break;
        case "mosaic":
            const doX = Math.random() > 0.5;
            outputImage = await mosaicEffect(inputImage, 15, doX, randomParameters ? (doX ? Math.random() > 0.5 : true) : true);
            break;
        case "fakedither":
            outputImage = await fakeDither(inputImage, undefined, 3);
            break;
        case "fakescreentone":
            outputImage = await setImageSaturate(inputImage, 0);
            outputImage = await fakeDither(outputImage, "screentone", 1);
            break;
        case "screentone":
            outputImage = await generateTwoToneImage(inputImage, "screentone", 1, twoTonesHighTone, twoTonesLowTone);
            break;
        case "specialscreentone":
            outputImage = await vibrantizeImage(inputImage, -0.2);
            outputImage = await sharpenImage(outputImage, 3, gaussianRadius);
            outputImage = await generateTwoToneImage(outputImage, "screentone", 1, twoTonesHighTone, twoTonesLowTone);
            outputImage = await gaussianBlur(outputImage, 2);
            break;
        case "custom":
            const originalCustomImage = inputImage.clone();

            outputImage = inputImage;
            outputImage = await vibrantizeImage(outputImage, -0.2);
            outputImage = await sharpenImage(outputImage, 3, gaussianRadius);
            outputImage = await generateTwoToneImage(outputImage, "screentone", 1, twoTonesHighTone, twoTonesLowTone);
            outputImage = await gaussianBlur(outputImage, 2);
            // outputImage = await mosaicEffect(outputImage, 3, undefined, undefined, 8);
            outputImage = new Jimp(outputImage.bitmap.width * 2, outputImage.bitmap.height)
                .composite(outputImage, 0, 0)
                .composite(originalCustomImage, outputImage.bitmap.width, 0);
            break;
        case "quantize":
            outputImage = await quantizeImage(inputImage, quantizeColors);
            break;
        default:
            outputImage = inputImage.clone();
            break;
    }

    return outputImage;
}