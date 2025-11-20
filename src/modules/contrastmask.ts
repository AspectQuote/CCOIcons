import Jimp from "jimp";
import { luminanceFromColor } from './cubeiconutils'

export async function generateContrastMask(image: Jimp, lowThereshold: number = 0.2, highThereshold: number = 0.6) {
    const newImage = new Jimp(image.bitmap.width, image.bitmap.height, 0x000000ff);

    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        const luminance = luminanceFromColor(this.getPixelColor(x, y));
        if (luminance > lowThereshold && luminance < highThereshold) newImage.setPixelColor(0xffffffff, x, y);
        // const val = Math.floor(luminance * 255);
        // newImage.bitmap.data[idx] = val;
        // newImage.bitmap.data[idx + 1] = val;
        // newImage.bitmap.data[idx + 2] = val;
    });

    return newImage;
}

export async function generateContrastMaskComparison(image: Jimp, lowThereshold?: number, highThereshold?: number) {
    const newImage = new Jimp(image.bitmap.width * 2, image.bitmap.height, 0x00000000);
    newImage.composite(image, 0, 0);
    newImage.composite(await generateContrastMask(image, lowThereshold, highThereshold), image.bitmap.width, 0);
    return newImage;
}