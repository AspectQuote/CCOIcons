import Jimp from "jimp";
import { kuwaharaMaxPixels } from "./schematics/config";
import { deltaE } from "./bside";

export async function basicKuwaharaFilter(sourceImage: Jimp) {
    if (sourceImage.bitmap.width * sourceImage.bitmap.height > kuwaharaMaxPixels) {
        const scaleChange = Math.sqrt(kuwaharaMaxPixels / (sourceImage.bitmap.width * sourceImage.bitmap.height));
        console.log(`\n[Kuwahara] Scale Change Applied. Original Pixel Count: ${sourceImage.bitmap.width * sourceImage.bitmap.height}\nNew Pixel Count: ${sourceImage.bitmap.width * scaleChange * sourceImage.bitmap.height * scaleChange}`);
        sourceImage.resize(Math.ceil(sourceImage.bitmap.width * scaleChange), Math.ceil(sourceImage.bitmap.height * scaleChange), Jimp.RESIZE_BILINEAR);
    }
    
    const outputImage = new Jimp(sourceImage.bitmap.width, sourceImage.bitmap.height, 0x00000000);
    const kernelSize = 5;
    console.log(`[Kuwahara] Kernel size: ${kernelSize}`);
    
    sourceImage.scan(0, 0, sourceImage.bitmap.width, sourceImage.bitmap.height, function (sourceX, sourceY, sourceIDX) {
        // if (x > kernelSize && y > kernelSize && x < sourceImage.bitmap.width - 1 - kernelSize && y < sourceImage.bitmap.height - 1 - kernelSize) {
            const adjacentColorGroups: { r: number, g: number, b: number, deviation: number }[] = [];

            for (let quadrantIndex = 0; quadrantIndex < 4; quadrantIndex++) {
                const xKernelMultiplier = (quadrantIndex % 2 == 1) ? 0 : -1;
                const yKernelMultiplier = (Math.floor(quadrantIndex / 2) == 1) ? 0 : -1;

                const colorGroup = {
                    r: [] as number[],
                    g: [] as number[],
                    b: [] as number[],
                    deviation: 0
                }

                sourceImage.scan(sourceX + (kernelSize * xKernelMultiplier), sourceY + (kernelSize * yKernelMultiplier), kernelSize, kernelSize, function(kernelX, kernelY, kernelIDX) {
                    if (sourceImage.bitmap.data[kernelIDX + 3] > 0) {
                        colorGroup.r.push(sourceImage.bitmap.data[kernelIDX]);
                        colorGroup.g.push(sourceImage.bitmap.data[kernelIDX + 1]);
                        colorGroup.b.push(sourceImage.bitmap.data[kernelIDX + 2]);
                    }
                })
                if (colorGroup.r.length !== 0) {
                    const totalR = colorGroup.r.reduce((a, b) => { return a + b }, 0);
                    const meanR = totalR / colorGroup.r.length;
                    const RDeviation = Math.sqrt(colorGroup.r.reduce((a, b) => { return Math.pow(b - meanR, 2) + a }, 0) / colorGroup.r.length);
    
                    const totalG = colorGroup.g.reduce((a, b) => { return a + b }, 0);
                    const meanG = totalG / colorGroup.g.length;
                    const GDeviation = Math.sqrt(colorGroup.g.reduce((a, b) => { return Math.pow(b - meanG, 2) + a }, 0) / colorGroup.g.length);
    
                    const totalB = colorGroup.b.reduce((a, b) => { return a + b }, 0);
                    const meanB = totalB / colorGroup.b.length;
                    const BDeviation = Math.sqrt(colorGroup.b.reduce((a, b) => { return Math.pow(b - meanB, 2) + a }, 0) / colorGroup.b.length);
    
                    const finalColorGroup = {
                        r: meanR,
                        g: meanG,
                        b: meanB,
                        deviation: (RDeviation + GDeviation + BDeviation) / 3
                    }
                    // colorGroup.deviation = deltaE(middlePixelColor, [ finalColorGroup.r, finalColorGroup.g, finalColorGroup.b ]);
                    adjacentColorGroups.push(finalColorGroup);
                }
            }
            if (adjacentColorGroups.length > 0) {
                const minDeviation = Math.min(...adjacentColorGroups.map(group => group.deviation));
                const lowestDevColorGroup = adjacentColorGroups[adjacentColorGroups.findIndex(colorGroup => colorGroup.deviation === minDeviation)];
                // const lowestDevColorGroup = adjacentColorGroups[0];
                // console.log(lowestDevColorGroup);
    
                outputImage.bitmap.data[sourceIDX] = lowestDevColorGroup.r;
                outputImage.bitmap.data[sourceIDX + 1] = lowestDevColorGroup.g;
                outputImage.bitmap.data[sourceIDX + 2] = lowestDevColorGroup.b;
                outputImage.bitmap.data[sourceIDX + 3] = sourceImage.bitmap.data[sourceIDX + 3];
            }
        // }
    })

    return outputImage;
}