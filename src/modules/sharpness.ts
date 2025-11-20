import Jimp from "jimp";
import { clampForRGB, gaussianBlur } from "./cubeiconutils";

export async function gaussianEdgeDetection(image: Jimp, radius: number) {
    const edgeImage = await gaussianBlur(image, radius);

    edgeImage.scan(0, 0, edgeImage.bitmap.width, edgeImage.bitmap.height, function (x, y, idx) {
        const sourceIndex = image.getPixelIndex(x, y);

        // console.log(centerRGB);
        edgeImage.bitmap.data[idx + 0] = clampForRGB(Math.floor(image.bitmap.data[sourceIndex + 0] - edgeImage.bitmap.data[idx + 0]));
        edgeImage.bitmap.data[idx + 1] = clampForRGB(Math.floor(image.bitmap.data[sourceIndex + 1] - edgeImage.bitmap.data[idx + 1]));
        edgeImage.bitmap.data[idx + 2] = clampForRGB(Math.floor(image.bitmap.data[sourceIndex + 2] - edgeImage.bitmap.data[idx + 2]));
        // usingImage.bitmap.data[idx + 3] = Math.floor((centerRGB[0] + centerRGB[1] + centerRGB[2])/3);
    });

    return edgeImage;
}

export async function sharpenImage(image: Jimp, magnitude: number, edgeRadius: number) {
    const detailImage = await gaussianEdgeDetection(image, edgeRadius);
    const trueMagnitude = magnitude * 4;

    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        const detailIndex = detailImage.getPixelIndex(x, y);
        image.bitmap.data[idx + 0] = clampForRGB(Math.floor(image.bitmap.data[idx + 0] + (detailImage.bitmap.data[detailIndex + 0] * trueMagnitude)));
        image.bitmap.data[idx + 1] = clampForRGB(Math.floor(image.bitmap.data[idx + 1] + (detailImage.bitmap.data[detailIndex + 1] * trueMagnitude)));
        image.bitmap.data[idx + 2] = clampForRGB(Math.floor(image.bitmap.data[idx + 2] + (detailImage.bitmap.data[detailIndex + 2] * trueMagnitude)));
    })
    return image;
}