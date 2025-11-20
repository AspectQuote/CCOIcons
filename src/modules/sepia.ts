import Jimp from "jimp";
import { clampForRGB } from "./cubeiconutils";

export async function sepia(image: Jimp) {
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        const inputRed = image.bitmap.data[idx + 0];
        const inputGreen = image.bitmap.data[idx + 1];
        const inputBlue = image.bitmap.data[idx + 2];
        // code below comes from stackoverflow user Massimiliano https://stackoverflow.com/questions/1061093/how-is-a-sepia-tone-created
        image.bitmap.data[idx + 0] = clampForRGB((inputRed * .393) + (inputGreen * .769) + (inputBlue * .189));
        image.bitmap.data[idx + 1] = clampForRGB((inputRed * .349) + (inputGreen * .686) + (inputBlue * .168));
        image.bitmap.data[idx + 2] = clampForRGB((inputRed * .272) + (inputGreen * .534) + (inputBlue * .131));
    })

    return image;
}