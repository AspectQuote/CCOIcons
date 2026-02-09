import Jimp from "jimp";
import { lerpColors, numberLiteralFromRGBA, rgbaFromNumberLiteral } from "./imageutils";
import { luminanceFromColor } from "./cubeiconutils";

const blueprintColors = [
    rgbaFromNumberLiteral(0xb0b3ffff),
    rgbaFromNumberLiteral(0xb0b3ffff),
    rgbaFromNumberLiteral(0x000c69ff),
    rgbaFromNumberLiteral(0x000c69ff),
    rgbaFromNumberLiteral(0xb0b3ffff),
    rgbaFromNumberLiteral(0x6b69ffff),
    rgbaFromNumberLiteral(0x6b69ffff),
    rgbaFromNumberLiteral(0xb0b3ffff),
];

function getBlueprintColorFromLuminance(luminance: number) {
    const blueprintColorIndexValue = 1/blueprintColors.length;
    let startingColorIndex = 0;
    while (startingColorIndex * blueprintColorIndexValue < luminance) {
        startingColorIndex++;
    }
    if (startingColorIndex > 0) startingColorIndex--;
    if (startingColorIndex === (blueprintColors.length - 1)) startingColorIndex--;
    const endingColorIndex = startingColorIndex + 1;
    const lerpAlpha = (luminance - (startingColorIndex * blueprintColorIndexValue))/blueprintColorIndexValue;
    // console.log(lerpAlpha);
    const lerpedChannels = lerpColors(blueprintColors[startingColorIndex], blueprintColors[endingColorIndex], lerpAlpha);
    return numberLiteralFromRGBA(lerpedChannels[0], lerpedChannels[1], lerpedChannels[2], lerpedChannels[3]);
}

export async function blueprintify(image: Jimp) {
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        const beforeAlpha = image.bitmap.data[idx + 3];
        image.setPixelColor(getBlueprintColorFromLuminance(luminanceFromColor(image.getPixelColor(x, y))), x, y)
        image.bitmap.data[idx + 3] = beforeAlpha;
    })
    return image;
}