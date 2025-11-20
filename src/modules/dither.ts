import { methods } from "@jimp/plugin-quantize";
import { generateGaussianMatrix, luminanceFromColor } from './cubeiconutils';
import Jimp from "jimp";

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
    const maxDistance = (matrixRadius) * Math.SQRT2;

    for (let yIndex = -matrixRadius; yIndex < matrixRadius + 1; yIndex++) {
        const newRow: number[] = [];
        for (let xIndex = -matrixRadius; xIndex < matrixRadius + 1; xIndex++) {
            const distance = Math.sqrt((yIndex ** 2) + (xIndex ** 2));
            newRow.push(1-(distance/maxDistance));
        }
        outputMatrix.push(newRow);
    }

    outputMatrix.push(...structuredClone(outputMatrix));

    const shiftOperations = matrixRadius + 1;
    for (let rowIndex = 0; rowIndex < matrixRadius * 2 + 1; rowIndex++) {
        for (let shiftIndex = 0; shiftIndex < shiftOperations; shiftIndex++) {
            outputMatrix[rowIndex].push(outputMatrix[rowIndex].shift() ?? 0);
        }
    }

    return outputMatrix;
})()

function getDitheringMatrix(matrix: 2 | 4 | 8 | "stripes" | "screentone") {
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
            break;
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
    let usingMatrix: number[][] = getDitheringMatrix(matrix);

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

export async function ditherImage(image: Jimp, matrix: Parameters<typeof getDitheringMatrix>[0] = 4, scaleFactor: number = 4, colors: number = 64) {
    const trueScaleFactor = Math.max(scaleFactor, Math.ceil(Math.sqrt(image.bitmap.width * image.bitmap.height) / 256));
    const resizedImage = image.resize(image.bitmap.width * (1 / trueScaleFactor), image.bitmap.height * (1 / trueScaleFactor));
    let usingMatrix: number[][] = getDitheringMatrix(matrix);

    const maskImage = new Jimp(resizedImage.bitmap.width, resizedImage.bitmap.height, 0x00000000);
    resizedImage.scan(0, 0, resizedImage.bitmap.width, resizedImage.bitmap.height, function(x, y, idx) {
        const matrixValue = usingMatrix[x % usingMatrix.length][y % usingMatrix.length];
        const luminance = luminanceFromColor(this.getPixelColor(x, y));
        if (luminance < matrixValue) maskImage.bitmap.data[idx + 3] = Math.floor(255/8);
    });

    return methods.quantize(resizedImage.composite(maskImage, 0, 0), { colors: Math.floor(colors) }).resize(resizedImage.bitmap.width * trueScaleFactor, resizedImage.bitmap.height * trueScaleFactor, Jimp.RESIZE_NEAREST_NEIGHBOR);
}

export async function fakeDither(image: Jimp, matrix: Parameters<typeof getDitheringMatrix>[0] = 4, scaleFactor: number = 2) {
    const ditherToneImage = await generateTwoToneImage(image.clone(), matrix, scaleFactor, 0x00000000, 0x00000022);
    
    return image.composite(ditherToneImage, 0, 0);
}