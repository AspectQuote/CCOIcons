import Jimp from "jimp"
import { generateContrastMask } from "./contrastmask"
import { luminanceFromColor } from "./cubeiconutils";

export async function pixelSortFilter(image: Jimp, direction: "ltr" | "rtl" | "ttb" | "btt" = "btt", contrastMaskLow: number = 0.55, contrastMaskHigh: number = 0.9) {
    const maskImage = await generateContrastMask(image, contrastMaskLow, contrastMaskHigh);
    const newImage = new Jimp(image.bitmap.width, image.bitmap.height, 0x00000000);
    const maskColor = 0xffffffff;
    
    const sortingMethod = (["rtl", "btt"].includes(direction)) ? ((a: number, b: number) => {
        if (luminanceFromColor(a) < luminanceFromColor(b)) return -1;
        return 1;
    }) : ((a: number, b: number) => {
        if (luminanceFromColor(a) > luminanceFromColor(b)) return -1;
        return 1;
    })

    if (direction === "ltr" || direction === "rtl") {
        for (let yPosition = 0; yPosition < image.bitmap.height; yPosition++) {
            for (let xPosition = 0; xPosition < image.bitmap.width; xPosition++) {
                if (maskImage.getPixelColor(xPosition, yPosition) === maskColor) {
                    let rowEnded = false;
                    let indexOffsetAccumulator = 0;
                    let foundColors: number[] = [];
                    while (!rowEnded) {
                        if (maskImage.getPixelColor(xPosition + indexOffsetAccumulator, yPosition) === maskColor && xPosition + indexOffsetAccumulator < image.bitmap.width) {
                            foundColors.push(image.getPixelColor(xPosition + indexOffsetAccumulator, yPosition));
                            indexOffsetAccumulator++;
                        } else {
                            rowEnded = true;
                        }
                    }
                    foundColors.sort(sortingMethod);
                    for (let foundColorIndex = 0; foundColorIndex < foundColors.length; foundColorIndex++) {
                        const foundColor = foundColors[foundColorIndex];
                        newImage.setPixelColor(foundColor, xPosition + foundColorIndex, yPosition);
                    }
                    xPosition += indexOffsetAccumulator - 1;
                } else {
                    newImage.setPixelColor(image.getPixelColor(xPosition, yPosition), xPosition, yPosition);
                }
            }
        }
    } else {
        for (let xPosition = 0; xPosition < image.bitmap.width; xPosition++) {
            for (let yPosition = 0; yPosition < image.bitmap.height; yPosition++) {
                if (maskImage.getPixelColor(xPosition, yPosition) === maskColor) {
                    let columnEnded = false;
                    let indexOffsetAccumulator = 0;
                    let foundColors: number[] = [];
                    while (!columnEnded) {
                        if (maskImage.getPixelColor(xPosition, yPosition + indexOffsetAccumulator) === maskColor && yPosition + indexOffsetAccumulator < image.bitmap.height) {
                            foundColors.push(image.getPixelColor(xPosition, yPosition + indexOffsetAccumulator));
                            indexOffsetAccumulator++;
                        } else {
                            columnEnded = true;
                        }
                    }
                    foundColors.sort(sortingMethod);
                    for (let foundColorIndex = 0; foundColorIndex < foundColors.length; foundColorIndex++) {
                        const foundColor = foundColors[foundColorIndex];
                        newImage.setPixelColor(foundColor, xPosition, yPosition + foundColorIndex);
                    }
                    yPosition += indexOffsetAccumulator - 1;
                } else {
                    newImage.setPixelColor(image.getPixelColor(xPosition, yPosition), xPosition, yPosition);
                }
            }
        }
    }

    return newImage;
}