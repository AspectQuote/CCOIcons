import Jimp from "jimp";
import { clampForRGB, gaussianBlur } from "./cubeiconutils";
import { separatedGaussianBlur } from "./separatedgaussian";

export async function gaussianEdgeDetection(image: Jimp, radius: number) {
    const edgeImage = await gaussianBlur(image, radius, 2);

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

export async function separatedGaussianEdgeDetection(image: Jimp, radius: number) {
    const edgeImage = await separatedGaussianBlur(image, radius);

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

export async function theresholdEdgeDetection(image: Jimp, edgeRadius: number, thereshold: number = 0.025, gaussianMethod: "fast" | "quality" = "fast", highColor: number = 0xffffffff, lowColor: number = 0x000000ff) {
    let detailImage: Jimp;
    const usableThereshold = 255 * thereshold;

    if (gaussianMethod == "fast") {
        detailImage = await separatedGaussianEdgeDetection(image, edgeRadius);
    } else {
        detailImage = await gaussianEdgeDetection(image, edgeRadius);
    }

    detailImage.scan(0, 0, detailImage.bitmap.width, detailImage.bitmap.height, function(x, y, idx) {
        if ((detailImage.bitmap.data[idx + 0] > usableThereshold) ||
            (detailImage.bitmap.data[idx + 1] > usableThereshold) ||
            (detailImage.bitmap.data[idx + 2] > usableThereshold)
        ) {
            detailImage.setPixelColor(highColor, x, y);
        } else {
            detailImage.setPixelColor(lowColor, x, y);
        }
    })

    return detailImage;
}

export async function darkenedEdgeImage(image: Jimp, edgeRadius: number, gaussianMethod: "fast" | "quality" = "fast") {
    const originalImage = image.clone();
    const edgeImage = await theresholdEdgeDetection(image, edgeRadius, 0.04, gaussianMethod, 0x00000033, 0x00000000);
    // const secondEdgeImage = await theresholdEdgeDetection(image, Math.ceil(edgeRadius/3), undefined, gaussianMethod, 0x00000022, 0x00000000);

    return originalImage.composite(edgeImage, 0, 0);
}

export async function sharpenImage(image: Jimp, magnitude: number, edgeRadius: number, gaussianMethod: "fast" | "quality" = "fast") {
    let detailImage: Jimp;

    if (gaussianMethod == "fast") {
        detailImage = await separatedGaussianEdgeDetection(image, edgeRadius);
    } else {
        detailImage = await gaussianEdgeDetection(image, edgeRadius);
    }

    // return detailImage;

    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        const detailIndex = detailImage.getPixelIndex(x, y);
        image.bitmap.data[idx + 0] = clampForRGB(Math.floor(image.bitmap.data[idx + 0] + (detailImage.bitmap.data[detailIndex + 0] * magnitude)));
        image.bitmap.data[idx + 1] = clampForRGB(Math.floor(image.bitmap.data[idx + 1] + (detailImage.bitmap.data[detailIndex + 1] * magnitude)));
        image.bitmap.data[idx + 2] = clampForRGB(Math.floor(image.bitmap.data[idx + 2] + (detailImage.bitmap.data[detailIndex + 2] * magnitude)));
    })
    return image;
}

export async function sharpenedImageComparison(image: Jimp) {
    const magnitudes: number[] = [1, 2, 3, 4];
    const edgeRadii: number[] = [4, 5, 6];

    const newImage = new Jimp(image.bitmap.width * magnitudes.length, image.bitmap.height * edgeRadii.length);
    for (let magnitudeIndex = 0; magnitudeIndex < magnitudes.length; magnitudeIndex++) {
        const magnitude = magnitudes[magnitudeIndex];
        for (let edgeRadiusIndex = 0; edgeRadiusIndex < edgeRadii.length; edgeRadiusIndex++) {
            const edgeRadius = edgeRadii[edgeRadiusIndex];
            newImage.composite(await sharpenImage(image.clone(), magnitude, edgeRadius), image.bitmap.width * magnitudeIndex, image.bitmap.height * edgeRadiusIndex);
        }
    }

    return newImage;
}