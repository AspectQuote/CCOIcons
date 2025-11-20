import Jimp from "jimp";

export async function chromaticAbberation(image: Jimp, vector: {x: number, y: number}, channelOffset: 0 | 1 | 2) {
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        const channelIndex = image.getPixelIndex(x + vector.x, y + vector.y);
        image.bitmap.data[idx + channelOffset] = image.bitmap.data[channelIndex + channelOffset];
    })

    return image;
}