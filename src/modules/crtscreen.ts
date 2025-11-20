import Jimp from "jimp";

const CRTConfig = {
    channelWidth: 4,
    pixelGap: 1
}

export async function CRTEffect(image: Jimp) {
    const CRTKernelWidth = (CRTConfig.channelWidth * 3) + CRTConfig.pixelGap;
    const newImage = new Jimp(image.bitmap.width, image.bitmap.height, 0x000000ff);

    for (let xIndex = 0; xIndex < image.bitmap.width; xIndex++) {
        for (let yIndex = 0; yIndex < image.bitmap.height; yIndex++) {
            if (xIndex % CRTKernelWidth !== 0 && yIndex % CRTKernelWidth !== 0) {
                const usingPixelIndex = image.getPixelIndex(xIndex - (xIndex % CRTKernelWidth), yIndex - (yIndex % CRTKernelWidth));
                const usingChannel = Math.floor(((xIndex % CRTKernelWidth) / CRTKernelWidth) * 3);
                const newPixelIndex = newImage.getPixelIndex(xIndex, yIndex);
                newImage.bitmap.data[newPixelIndex + usingChannel] = image.bitmap.data[usingPixelIndex + usingChannel];
            }
        }
    }

    return newImage;
}