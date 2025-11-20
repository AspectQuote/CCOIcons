import Jimp from "jimp";
import { luminanceFromColor } from "./cubeiconutils";
import { ditherImage, generateTwoToneImage } from "./dither";

export async function generatePopArtFourSquare(image: Jimp) {
    const usingImage = image.resize(image.bitmap.width/2, image.bitmap.height/2);
    const outputImage = new Jimp(image.bitmap.width * 2, image.bitmap.height * 2, 0x000000ff);

    const offsets = [
        { positionOffset: { x: 0, y: 0 }, indices: [ 0 ]},
        { positionOffset: { x: image.bitmap.width, y: 0 }, indices: [ 1 ]},
        { positionOffset: { x: 0, y: image.bitmap.height }, indices: [ 2 ]},
        { positionOffset: { x: image.bitmap.width, y: image.bitmap.height }, indices: [ 0, 1, 2 ]},
    ];

    const ditherToneImage = await generateTwoToneImage(image.clone(), 8, 1, 0x00000000, 0x00000022);
    
    usingImage.scan(0, 0, usingImage.bitmap.width, usingImage.bitmap.height, function(x, y, idx) {
        const luminance = Math.floor(luminanceFromColor(usingImage.getPixelColor(x, y)) * 255);
        for (let offsetIndex = 0; offsetIndex < offsets.length; offsetIndex++) {
            const currentOffset = offsets[offsetIndex];
            const outputIndex = outputImage.getPixelIndex(x + currentOffset.positionOffset.x, y + currentOffset.positionOffset.y);
            for (let bitmapOffsetIndex = 0; bitmapOffsetIndex < currentOffset.indices.length; bitmapOffsetIndex++) {
                const indexOffset = currentOffset.indices[bitmapOffsetIndex];
                outputImage.bitmap.data[outputIndex + indexOffset] = usingImage.bitmap.data[idx + indexOffset];
                // outputImage.bitmap.data[outputIndex + indexOffset] = luminance;
            }
        }
    })

    for (let offsetIndex = 0; offsetIndex < offsets.length; offsetIndex++) {
        const offsetData = offsets[offsetIndex];
        outputImage.composite(ditherToneImage, offsetData.positionOffset.x, offsetData.positionOffset.y);
    }

    return outputImage;
}