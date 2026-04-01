import Jimp from "jimp";
import { gaussianBlur, luminanceFromColor } from "./cubeiconutils";
import { quantizeImage } from "./quantize";

const celSize = 8;
const maxExponent = 64;
const darkColor = 0x00000022;
const lightColor = 0xffffff22;
export async function trueScreenTone(image: Jimp) {
    // image = await quantizeImage(image, 13);
    image = image.resize(image.bitmap.width/(celSize/2), image.bitmap.height/(celSize/2), Jimp.RESIZE_BICUBIC);
    image = image.resize(image.bitmap.width * (celSize/2), image.bitmap.height * (celSize/2), Jimp.RESIZE_NEAREST_NEIGHBOR)
    const newImage = await gaussianBlur(image.clone(), 4);
    newImage.scan(0, 0, newImage.bitmap.width, newImage.bitmap.height, (x, y, idx) => {
        const luminance = luminanceFromColor(newImage.getPixelColor(x, y));
        // const luminance = 0.7;
        const celX = Math.floor(x / celSize);
        const celY = Math.floor(y / celSize);
        const oddXQuadrant = (celX % 2) === 1;
        const oddYQuadrant = (celY % 2) === 1;
        const gridX = Math.floor(celX / 2);
        const gridY = Math.floor(celY / 2);
        if (((gridX + celX + gridY + (luminance > 0.5 ? 1 : 0)) % 2) === 0) {
            if (luminance > 0.5) {
                newImage.setPixelColor(lightColor, x, y);
            } else {
                newImage.setPixelColor(darkColor, x, y);
            }
        } else {
            let pixelX = (x % celSize)/celSize;
            if (oddXQuadrant) pixelX -= 1;
            let pixelY = (celSize - (y % celSize))/celSize;
            if (oddYQuadrant) pixelY -= 1;
            let normalizedLuminance = (1 - (2 * Math.abs(luminance - 0.5))) - 0.15;
            normalizedLuminance = Math.max(normalizedLuminance, 0);
            let luminanceExponent = normalizedLuminance * maxExponent;
            luminanceExponent = Math.floor(luminanceExponent / 2)*2;
            if (luminanceExponent < 2) {
                if (luminance > 0.5) {
                    newImage.setPixelColor(lightColor, x, y);
                } else {
                    newImage.setPixelColor(darkColor, x, y);
                }
            } else {
                // console.log(luminanceExponent)
                const pixelThereshold = 1 / Math.sqrt((maxExponent/4) * luminanceExponent);
                const pixelMeetsThereshold = (Math.pow(pixelX, luminanceExponent) + Math.pow(pixelY, luminanceExponent)) >= pixelThereshold;
                // console.log(pixelMeetsThereshold)
                if (luminance > 0.5) {
                    if (pixelMeetsThereshold) {
                        newImage.setPixelColor(lightColor, x, y);
                    } else {
                        newImage.setPixelColor(darkColor, x, y);
                    }
                } else {
                    if (pixelMeetsThereshold) {
                        newImage.setPixelColor(darkColor, x, y);
                    } else {
                        newImage.setPixelColor(lightColor, x, y);
                    }
                }
            }
        }
    })
    return image.composite(newImage, 0, 0);
}