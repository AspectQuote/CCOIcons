import Jimp from "jimp";

function modifyChannel(val: number, nM1: number) {
    return Math.floor((Math.floor((val * nM1) + 0.5) / nM1) * 255);
}

export async function quantizeImage(image: Jimp, colorsPerChannel: number): Promise<Jimp> {
    const nM1 = Math.floor(colorsPerChannel) - 1;
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
        image.bitmap.data[idx + 0] = modifyChannel(image.bitmap.data[idx + 0]/255, nM1);
        image.bitmap.data[idx + 1] = modifyChannel(image.bitmap.data[idx + 1]/255, nM1);
        image.bitmap.data[idx + 2] = modifyChannel(image.bitmap.data[idx + 2]/255, nM1);
    })

    return image;
}