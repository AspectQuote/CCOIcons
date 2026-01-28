import { methods } from "@jimp/plugin-quantize";
import { clampForRGB, generateGaussianMatrix, luminanceFromColor } from './cubeiconutils';
import Jimp from "jimp";
import { quantizeImage, quantizePixel } from "./quantize";
import { sourceImagesDirectory } from "./schematics/config";

let bayer2x2 = [
    [0, 2],
    [3, 1],
]

bayer2x2 = bayer2x2.map(item => {
    return item.map(item => {
        return item / 4;
    })
})

let bayer4x4 = [
    [0 , 8 , 2 , 10],
    [12, 4 , 14, 6 ],
    [3 , 11, 1 , 9 ],
    [15, 7 , 13, 5 ]
]

bayer4x4 = bayer4x4.map(item => {
    return item.map(item => {
        return item/16;
    })
})

let bayer8x8 = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21]
]

bayer8x8 = bayer8x8.map(item => {
    return item.map(item => {
        return item / 64;
    })
})

// Non-functioning.
function generateBayerMatrix(magnitude: number) {
    const dimensions = magnitude;
    const returnArray: number[][] = [];
    const requiredBitLength = Math.ceil(Math.log2(magnitude));

    for (let y = 0; y < dimensions; y++) {
        const row: number[] = [];
        for (let x = 0; x < dimensions; x++) {
            let XORBits = (x ^ y).toString(2).split('');
            let xBits = (x).toString(2).split('');

            while (XORBits.length < requiredBitLength) {
                XORBits.push('0');
            }

            while (xBits.length < requiredBitLength) {
                xBits.push('0');
            }

            let interleavedBits: string = ``;
            for (let bitIndex = 0; bitIndex < requiredBitLength; bitIndex++) {
                interleavedBits = `${xBits[bitIndex]}${XORBits[bitIndex]}${interleavedBits}`;
            }

            interleavedBits = interleavedBits.split('').reverse().join('');

            console.log((bayer8x8[y][x] * 64).toString(2), interleavedBits);

            row.push(parseInt(interleavedBits, 2)/(dimensions ** 2));
        }
        returnArray.push(row);
    }

    return returnArray;
}

// console.log(generateBayerMatrix(8));

let screenToneMatrix = (() => {
    let outputMatrix: number[][] = [];
    const matrixRadius = 4;
    const maxDistance = ((matrixRadius * 2) * Math.SQRT2);

    for (let yIndex = -matrixRadius; yIndex < matrixRadius + 1; yIndex++) {
        const newRow: number[] = [];
        for (let xIndex = -matrixRadius; xIndex < matrixRadius + 1; xIndex++) {
            const distance = Math.sqrt((yIndex ** 2) + (xIndex ** 2));
            newRow.push((1-(distance/maxDistance)) ** 2);
        }
        outputMatrix.push(newRow);
    }

    // outputMatrix.push(...structuredClone(outputMatrix));

    // const shiftOperations = matrixRadius + 1;
    // for (let rowIndex = 0; rowIndex < matrixRadius * 2 + 1; rowIndex++) {
    //     for (let shiftIndex = 0; shiftIndex < shiftOperations; shiftIndex++) {
    //         outputMatrix[rowIndex].push(outputMatrix[rowIndex].shift() ?? 0);
    //     }
    // }

    return outputMatrix;
})()

export async function getDitheringMatrix(matrix: 2 | 4 | 8 | "stripes" | "screentone" | "45") {
    let usingMatrix: number[][];
    switch (matrix) {
        case 2:
            usingMatrix = structuredClone(bayer2x2);
            break;
        case 4:
            usingMatrix = structuredClone(bayer4x4);
            break;
        case 8:
            usingMatrix = structuredClone(bayer8x8);
            break;
        case "stripes":
            usingMatrix = (() => {
                const outputMatrix: number[][] = [];
                const width = 128;
                const baseRow: number[] = [];
                while (baseRow.length < width) {
                    baseRow.push(Math.random() * 0.95);
                }
    
                while (outputMatrix.length < width) {
                    baseRow.unshift(baseRow.pop() ?? 0);
                    const newBaseRow = structuredClone(baseRow).map(thereshold => {
                        return (Math.random() > 0.95) ? thereshold/2 : thereshold;
                    });

                    outputMatrix.push(newBaseRow);
                }

                // console.log(outputMatrix);
                return outputMatrix;
            })()
            break;
        case "screentone":
            return screenToneMatrix;
        case "45":
            const image = await Jimp.read(`${sourceImagesDirectory}/images/45dither.png`);
            const constructedMatrix: number[][] = [];

            for (let yIndex = 0; yIndex < image.bitmap.height; yIndex++) {
                const newRow: number[] = [];
                for (let xIndex = 0; xIndex < image.bitmap.height; xIndex++) {
                    const pixelIndex = image.getPixelIndex(xIndex, yIndex);
                    newRow.push(image.bitmap.data[pixelIndex] / 255);
                }
                constructedMatrix.push(newRow);
            }

            return constructedMatrix;
        default:
            usingMatrix = [[1]];
            break;
    }

    return usingMatrix;
}

export async function generateTwoToneImage(image: Jimp, matrix: Parameters<typeof getDitheringMatrix>[0] = 4, scaleFactor: number = 4, toneLight: number = 0xffffffff, toneDark: number = 0x000000ff) {
    const resizedImage = image.resize(image.bitmap.width * (1 / scaleFactor), image.bitmap.height * (1 / scaleFactor));
    // const newImage = methods.quantize(resizedImage, { colors });
    const newImage = resizedImage;
    let usingMatrix: number[][] = await getDitheringMatrix(matrix);

    newImage.scan(0, 0, newImage.bitmap.width, newImage.bitmap.height, function (x, y, idx) {
        const matrixValue = usingMatrix[y % usingMatrix.length][x % usingMatrix[y % usingMatrix.length].length];
        const luminance = luminanceFromColor(this.getPixelColor(x, y));
        if (luminance > matrixValue) {
            this.setPixelColor(toneLight, x, y);
        } else {
            this.setPixelColor(toneDark, x, y);
        }
    });

    return newImage.resize(newImage.bitmap.width * scaleFactor, newImage.bitmap.height * scaleFactor, Jimp.RESIZE_NEAREST_NEIGHBOR);
}

export async function ditherImage(image: Jimp, matrix: Parameters<typeof getDitheringMatrix>[0] = 8, spread: number = 0.1, colorsPerChannel: number = 4, scaleFactor: number = 3) {
    let usingMatrix: number[][] = await getDitheringMatrix(matrix);

    image.resize(Math.floor(image.bitmap.width/scaleFactor), Math.floor(image.bitmap.height/scaleFactor), Jimp.RESIZE_BILINEAR);
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        const matrixValue = Math.max(0, Math.min(1, (usingMatrix[y % usingMatrix.length][x % usingMatrix[y % usingMatrix.length].length] - 0.5) * spread));
        image.bitmap.data[idx + 0] = clampForRGB(Math.floor(((image.bitmap.data[idx + 0] / 255) + matrixValue) * 255));
        image.bitmap.data[idx + 1] = clampForRGB(Math.floor(((image.bitmap.data[idx + 1] / 255) + matrixValue) * 255));
        image.bitmap.data[idx + 2] = clampForRGB(Math.floor(((image.bitmap.data[idx + 2] / 255) + matrixValue) * 255));
    });

    // return image
    return (await quantizeImage(image, colorsPerChannel)).resize(Math.floor(image.bitmap.width * scaleFactor), Math.floor(image.bitmap.height * scaleFactor), Jimp.RESIZE_NEAREST_NEIGHBOR);
}

export async function fakeDither(image: Jimp, matrix: Parameters<typeof getDitheringMatrix>[0] = 4, scaleFactor: number = 2) {
    const ditherToneImage = await generateTwoToneImage(image.clone(), matrix, scaleFactor, 0x00000000, 0x00000044);

    return image.composite(ditherToneImage, 0, 0);
}

function generateTwoDimensionalArray(width: number, height: number): number[][] {
    console.log(`Creating array of width: ${width} and height: ${height}`);
    const columns: number[] = [];
    while (columns.length < height) {
        columns.push(0);
    }
    const rows: number[][] = [];
    while (rows.length < width) {
        rows.push(structuredClone(columns));
    }
    return rows;
}

const errorDiffusionMatrices = {
    "Floyd-Steinberg": [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 7 / 16, 0],
        [0, 3 / 16, 5 / 16, 1 / 16, 0],
        [0, 0, 0, 0, 0],
    ],
    "Atkinson": [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 1 / 8, 1 / 8],
        [0, 1 / 8, 1 / 8, 1 / 8, 0],
        [0, 0, 1 / 8, 0, 0],
    ],
    "Custom": [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 3 / 8, 3 / 8],
        [0, 0, 2 / 8, 0, 0],
        [0, 0, 0, 0, 0],
    ]
} as const satisfies {
    [key: string]: [
        [number, number, number, number, number],
        [number, number, number, number, number],
        [number, number, number, number, number],
        [number, number, number, number, number],
        [number, number, number, number, number],
]};

export async function errorDiffusionTwoTone(image: Jimp, algorithm: keyof typeof errorDiffusionMatrices, scaleFactor: number = 2, toneLight: number = 0xffffffff, toneDark: number = 0x000000ff) {
    const resizedImage = image.resize(image.bitmap.width * (1 / scaleFactor), image.bitmap.height * (1 / scaleFactor));
    const errorBitmap = generateTwoDimensionalArray(resizedImage.bitmap.width, resizedImage.bitmap.height);
    // const newImage = methods.quantize(resizedImage, { colors });
    const newImage = resizedImage.clone();

    const diffusionMatrix = errorDiffusionMatrices[algorithm];

    newImage.scan(0, 0, newImage.bitmap.width, newImage.bitmap.height, function (x, y, idx) {
        const luminance = (luminanceFromColor(resizedImage.getPixelColor(x, y)) - 0.5) + errorBitmap[x][y];
        // console.log(errorBitmap[x][y])
        let distributedError = 0;
        if (luminance > 0) {
            this.setPixelColor(toneLight, x, y);
            distributedError = luminance - 0.5;
        } else {
            this.setPixelColor(toneDark, x, y);
            distributedError = luminance + 0.5;
        }

        for (let distributedY = 0; distributedY < 5; distributedY++) {
            for (let distributedX = 0; distributedX < 5; distributedX++) {
                const diffusionFactor = diffusionMatrix[distributedX][distributedY];
                if (diffusionFactor > 0) {
                    const xOffset = distributedX - 2;
                    const yOffset = distributedY - 2;
                    if (errorBitmap[x + xOffset] !== undefined && errorBitmap[x + xOffset][y + yOffset] !== undefined) {
                        errorBitmap[x + xOffset][y + yOffset] += (distributedError * diffusionFactor);
                    }
                }
            }
        }
    });

    return newImage.resize(newImage.bitmap.width * scaleFactor, newImage.bitmap.height * scaleFactor, Jimp.RESIZE_NEAREST_NEIGHBOR);
}

export async function errorDiffusionDither(image: Jimp, algorithm: keyof typeof errorDiffusionMatrices, colorsPerChannel: number = 4, scaleFactor: number = 1) {
    image.resize(Math.floor(image.bitmap.width / scaleFactor), Math.floor(image.bitmap.height / scaleFactor), Jimp.RESIZE_BILINEAR);

    const errorRed = generateTwoDimensionalArray(image.bitmap.width, image.bitmap.height);
    const errorGreen = generateTwoDimensionalArray(image.bitmap.width, image.bitmap.height);
    const errorBlue = generateTwoDimensionalArray(image.bitmap.width, image.bitmap.height);
    const diffusionMatrix = errorDiffusionMatrices[algorithm];

    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
        const pixelIndex = image.getPixelIndex(x, y);
        const oldColor = [
            clampForRGB(image.bitmap.data[pixelIndex] + ((0.5 + errorRed[x][y]) * 255)),
            clampForRGB(image.bitmap.data[pixelIndex + 1] + ((0.5 + errorGreen[x][y]) * 255)),
            clampForRGB(image.bitmap.data[pixelIndex + 2] + ((0.5 + errorBlue[x][y]) * 255))
        ];
        const newColor = quantizePixel(structuredClone(oldColor) as [number, number, number], colorsPerChannel);
        image.bitmap.data[idx + 0] = newColor[0];
        image.bitmap.data[idx + 1] = newColor[1];
        image.bitmap.data[idx + 2] = newColor[2];

        for (let distributedY = 0; distributedY < 5; distributedY++) {
            for (let distributedX = 0; distributedX < 5; distributedX++) {
                const diffusionFactor = diffusionMatrix[distributedX][distributedY];
                if (diffusionFactor > 0) {
                    const xOffset = distributedX - 2;
                    const yOffset = distributedY - 2;
                    if (errorRed[x + xOffset] !== undefined && errorRed[x + xOffset][y + yOffset] !== undefined) {
                        const distributedChannel = ((((oldColor[0] - newColor[0])/255) - 2) * diffusionFactor);
                        errorRed[x + xOffset][y + yOffset] += (distributedChannel * diffusionFactor);
                    }
                    if (errorBlue[x + xOffset] !== undefined && errorBlue[x + xOffset][y + yOffset] !== undefined) {
                        const distributedChannel = ((((oldColor[1] - newColor[1])/255) - 2) * diffusionFactor);
                        errorBlue[x + xOffset][y + yOffset] += (distributedChannel * diffusionFactor);
                    }
                    if (errorGreen[x + xOffset] !== undefined && errorGreen[x + xOffset][y + yOffset] !== undefined) {
                        const distributedChannel = ((((oldColor[2] - newColor[2])/255) - 2) * diffusionFactor);
                        errorGreen[x + xOffset][y + yOffset] += (distributedChannel * diffusionFactor);
                    }
                }
            }
        }
    });

    // return image
    return image.resize(Math.floor(image.bitmap.width * scaleFactor), Math.floor(image.bitmap.height * scaleFactor), Jimp.RESIZE_NEAREST_NEIGHBOR);
}

