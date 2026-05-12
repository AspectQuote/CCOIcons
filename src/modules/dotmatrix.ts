import Jimp from "jimp";
import { brightenImage, fillCircle, fillRect, numberLiteralFromRGBA } from "./imageutils";

export async function dotMatrix(image: Jimp, kernelSize: number = 16, alphaThereshold: number = 0.5, dumbAverage: boolean = true) {
    const newImageWidth = Math.round(image.bitmap.width / kernelSize) * kernelSize;
    const newImageHeight = Math.round(image.bitmap.height / kernelSize) * kernelSize;
    const newImage = new Jimp(newImageWidth, newImageHeight, 0x00000000);

    const xScalar = newImage.bitmap.width/image.bitmap.width;
    const yScalar = newImage.bitmap.height/image.bitmap.height;
    const xIterations = newImage.bitmap.width/kernelSize;
    const yIterations = newImage.bitmap.height/kernelSize;
    console.log(`X iterations: ${xIterations}, Y iterations: ${yIterations}`);
    const kernelDivisor = dumbAverage ? 4 : kernelSize ** 2;

    for (let xIndex = 0; xIndex < xIterations + 2; xIndex++) {
        for (let yIndex = 0; yIndex < yIterations + 2; yIndex++) {
            let secondaryColorAccumulation = {
                red: 0,
                green: 0,
                blue: 0,
                alpha: 0
            }
            let transparentPixels = 0;

            if (dumbAverage) {
                const baseX = Math.round((((xIndex - 1) * kernelSize) - (kernelSize / 2)) * xScalar);
                const baseY = Math.round((((yIndex - 1) * kernelSize) - (kernelSize / 2)) * yScalar);
                const farX = Math.round((((xIndex) * kernelSize) - (kernelSize / 2)) * xScalar) - 1;
                const farY = Math.round((((yIndex) * kernelSize) - (kernelSize / 2)) * yScalar) - 1;

                let imageIndex = image.getPixelIndex(baseX, baseY);
                secondaryColorAccumulation.red += image.bitmap.data[imageIndex + 0];
                secondaryColorAccumulation.green += image.bitmap.data[imageIndex + 1];
                secondaryColorAccumulation.blue += image.bitmap.data[imageIndex + 2];
                if (image.bitmap.data[imageIndex + 3] === 0) transparentPixels++;
                secondaryColorAccumulation.alpha += image.bitmap.data[imageIndex + 3];

                imageIndex = image.getPixelIndex(baseX, farY);
                secondaryColorAccumulation.red += image.bitmap.data[imageIndex + 0];
                secondaryColorAccumulation.green += image.bitmap.data[imageIndex + 1];
                secondaryColorAccumulation.blue += image.bitmap.data[imageIndex + 2];
                if (image.bitmap.data[imageIndex + 3] === 0) transparentPixels++;
                secondaryColorAccumulation.alpha += image.bitmap.data[imageIndex + 3];

                imageIndex = image.getPixelIndex(farX, baseY);
                secondaryColorAccumulation.red += image.bitmap.data[imageIndex + 0];
                secondaryColorAccumulation.green += image.bitmap.data[imageIndex + 1];
                secondaryColorAccumulation.blue += image.bitmap.data[imageIndex + 2];
                if (image.bitmap.data[imageIndex + 3] === 0) transparentPixels++;
                secondaryColorAccumulation.alpha += image.bitmap.data[imageIndex + 3];

                imageIndex = image.getPixelIndex(farX, farY);
                secondaryColorAccumulation.red += image.bitmap.data[imageIndex + 0];
                secondaryColorAccumulation.green += image.bitmap.data[imageIndex + 1];
                secondaryColorAccumulation.blue += image.bitmap.data[imageIndex + 2];
                if (image.bitmap.data[imageIndex + 3] === 0) transparentPixels++;
                secondaryColorAccumulation.alpha += image.bitmap.data[imageIndex + 3];

            } else {
                newImage.scan((xIndex - 1) * kernelSize, (yIndex - 1) * kernelSize, kernelSize, kernelSize, (x, y, idx) => {
                    const imageIndex = image.getPixelIndex(Math.round((x - (kernelSize/2)) * xScalar), Math.round((y - (kernelSize/2)) * yScalar));
                    secondaryColorAccumulation.red += image.bitmap.data[imageIndex + 0];
                    secondaryColorAccumulation.green += image.bitmap.data[imageIndex + 1];
                    secondaryColorAccumulation.blue += image.bitmap.data[imageIndex + 2];
                    const addedAlpha = image.bitmap.data[imageIndex + 3];
                    if (addedAlpha === 0) transparentPixels++;
                    secondaryColorAccumulation.alpha += addedAlpha;
                });
            }

            const newColor = numberLiteralFromRGBA(Math.floor(secondaryColorAccumulation.red / kernelDivisor), Math.floor(secondaryColorAccumulation.green / kernelDivisor), Math.floor(secondaryColorAccumulation.blue / kernelDivisor), ((transparentPixels / kernelDivisor) < alphaThereshold) ? Math.floor(secondaryColorAccumulation.alpha / kernelDivisor) : 0);
            fillCircle(newImage, ((xIndex - 1) * kernelSize), ((yIndex - 1) * kernelSize), kernelSize / 2, newColor);
        }
    }

    await brightenImage(newImage, -0.3);

    for (let xIndex = 0; xIndex < xIterations; xIndex++) {
        for (let yIndex = 0; yIndex < yIterations; yIndex++) {
            let mainColorAccumulation = {
                red: 0,
                green: 0,
                blue: 0,
                alpha: 0
            }
            let transparentPixels = 0;
            if (dumbAverage) {
                const baseX = Math.round(((xIndex) * kernelSize) * xScalar);
                const baseY = Math.round(((yIndex) * kernelSize) * yScalar);
                const farX = Math.round(((xIndex + 1) * kernelSize) * xScalar) - 1;
                const farY = Math.round(((yIndex + 1) * kernelSize) * yScalar) - 1;

                let imageIndex = image.getPixelIndex(baseX, baseY);
                mainColorAccumulation.red += image.bitmap.data[imageIndex + 0];
                mainColorAccumulation.green += image.bitmap.data[imageIndex + 1];
                mainColorAccumulation.blue += image.bitmap.data[imageIndex + 2];
                if (image.bitmap.data[imageIndex + 3] === 0) transparentPixels++;
                mainColorAccumulation.alpha += image.bitmap.data[imageIndex + 3];

                imageIndex = image.getPixelIndex(baseX, farY);
                mainColorAccumulation.red += image.bitmap.data[imageIndex + 0];
                mainColorAccumulation.green += image.bitmap.data[imageIndex + 1];
                mainColorAccumulation.blue += image.bitmap.data[imageIndex + 2];
                if (image.bitmap.data[imageIndex + 3] === 0) transparentPixels++;
                mainColorAccumulation.alpha += image.bitmap.data[imageIndex + 3];

                imageIndex = image.getPixelIndex(farX, baseY);
                mainColorAccumulation.red += image.bitmap.data[imageIndex + 0];
                mainColorAccumulation.green += image.bitmap.data[imageIndex + 1];
                mainColorAccumulation.blue += image.bitmap.data[imageIndex + 2];
                if (image.bitmap.data[imageIndex + 3] === 0) transparentPixels++;
                mainColorAccumulation.alpha += image.bitmap.data[imageIndex + 3];

                imageIndex = image.getPixelIndex(farX, farY);
                mainColorAccumulation.red += image.bitmap.data[imageIndex + 0];
                mainColorAccumulation.green += image.bitmap.data[imageIndex + 1];
                mainColorAccumulation.blue += image.bitmap.data[imageIndex + 2];
                if (image.bitmap.data[imageIndex + 3] === 0) transparentPixels++;
                mainColorAccumulation.alpha += image.bitmap.data[imageIndex + 3];
            } else {
                newImage.scan(xIndex * kernelSize, yIndex * kernelSize, kernelSize, kernelSize, (x, y, idx) => {
                    const imageIndex = image.getPixelIndex(Math.round(x * xScalar), Math.round(y * yScalar));
                    mainColorAccumulation.red += image.bitmap.data[imageIndex + 0];
                    mainColorAccumulation.green += image.bitmap.data[imageIndex + 1];
                    mainColorAccumulation.blue += image.bitmap.data[imageIndex + 2];
                    mainColorAccumulation.alpha += image.bitmap.data[imageIndex + 3];
                });
            }

            mainColorAccumulation.alpha = Math.floor(mainColorAccumulation.alpha / kernelDivisor);

            const newColor = numberLiteralFromRGBA(Math.floor(mainColorAccumulation.red / kernelDivisor), Math.floor(mainColorAccumulation.green / kernelDivisor), Math.floor(mainColorAccumulation.blue / kernelDivisor), (mainColorAccumulation.alpha >= alphaThereshold) ? mainColorAccumulation.alpha : 0);
            fillCircle(newImage, (xIndex * kernelSize) + (kernelSize / 2), (yIndex * kernelSize) + (kernelSize / 2), kernelSize/2, newColor);
        }
    }

    return newImage;
}