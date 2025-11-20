import Jimp from "jimp";
import { deltaE } from "./bside";
import { rgbaFromNumberLiteral } from "./imageutils";

export async function mosaicEffect(image: Jimp, tileWidth: number = 10, doX: boolean = true, doY: boolean = true, deltaMax: number = 4) {
    const newImage = new Jimp(image.bitmap.width, image.bitmap.height, 0x000000ff);

    for (let xIndex = 0; xIndex < image.bitmap.width; xIndex++) {
        for (let yIndex = 0; yIndex < image.bitmap.height; yIndex++) {
            if (xIndex % tileWidth !== 0 && yIndex % tileWidth !== 0) {
                const usingPixelIndex = image.getPixelIndex(xIndex - (xIndex % tileWidth), yIndex - (yIndex % tileWidth));
                const newPixelIndex = newImage.getPixelIndex(xIndex, yIndex);
                newImage.bitmap.data[newPixelIndex + 0] = image.bitmap.data[usingPixelIndex + 0];
                newImage.bitmap.data[newPixelIndex + 1] = image.bitmap.data[usingPixelIndex + 1];
                newImage.bitmap.data[newPixelIndex + 2] = image.bitmap.data[usingPixelIndex + 2];
            }
        }
    }

    newImage.scan(0, 0, newImage.bitmap.width, newImage.bitmap.height, function(x, y, idx) {
        if (doY && y % tileWidth === 0) {
            const aboveColor = rgbaFromNumberLiteral(newImage.getPixelColor(x, y - 1));
            const belowColor = rgbaFromNumberLiteral(newImage.getPixelColor(x, y + 1));
            const verticalDelta = deltaE([aboveColor.red, aboveColor.green, aboveColor.blue], [belowColor.red, belowColor.green, belowColor.blue]);

            // console.log(verticalDelta);
            if (verticalDelta < deltaMax) {
                newImage.bitmap.data[idx + 0] = aboveColor.red;
                newImage.bitmap.data[idx + 1] = aboveColor.green;
                newImage.bitmap.data[idx + 2] = aboveColor.blue;
            }
        }

        if (doX && x % tileWidth === 0) {
            const leftColor = rgbaFromNumberLiteral(newImage.getPixelColor(x - 1, y));
            const rightColor = rgbaFromNumberLiteral(newImage.getPixelColor(x + 1, y));
            const verticalDelta = deltaE([leftColor.red, leftColor.green, leftColor.blue], [rightColor.red, rightColor.green, rightColor.blue]);

            // console.log(verticalDelta);
            if (verticalDelta < deltaMax) {
                newImage.bitmap.data[idx + 0] = leftColor.red;
                newImage.bitmap.data[idx + 1] = leftColor.green;
                newImage.bitmap.data[idx + 2] = leftColor.blue;
            }
        }

        if (doX && doY && x % tileWidth === 0 && y % tileWidth === 0) {
            const topRightColor = rgbaFromNumberLiteral(newImage.getPixelColor(x + 1, y + 1));
            const topLeftColor = rgbaFromNumberLiteral(newImage.getPixelColor(x - 1, y + 1));
            const bottomRightColor = rgbaFromNumberLiteral(newImage.getPixelColor(x + 1, y - 1));
            const bottomLeftColor = rgbaFromNumberLiteral(newImage.getPixelColor(x - 1, y - 1));

            if (
                deltaE([topRightColor.red, topRightColor.green, topRightColor.blue], [topLeftColor.red, topLeftColor.green, topLeftColor.blue]) < deltaMax &&

                deltaE([bottomRightColor.red, bottomRightColor.green, bottomRightColor.blue], [bottomLeftColor.red, bottomLeftColor.green, bottomLeftColor.blue]) < deltaMax &&

                deltaE([topLeftColor.red, topLeftColor.green, topLeftColor.blue], [bottomLeftColor.red, bottomLeftColor.green, bottomLeftColor.blue]) < deltaMax &&

                deltaE([topRightColor.red, topRightColor.green, topRightColor.blue], [bottomRightColor.red, bottomRightColor.green, bottomRightColor.blue]) < deltaMax
            ) {
                newImage.bitmap.data[idx + 0] = bottomLeftColor.red;
                newImage.bitmap.data[idx + 1] = bottomLeftColor.green;
                newImage.bitmap.data[idx + 2] = bottomLeftColor.blue;
            }
        }
    })

    return newImage;
}