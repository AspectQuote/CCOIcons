import Jimp from "jimp";
import { clampForRGB, generateGaussianMatrix } from "./cubeiconutils";

function generateOneDimensionalWeightedMatrix(radius: number = 3) {
    const matrixWidth = (radius * 2) + 1;
    const matrix: number[] = [];

    for (let matrixIndex = -radius; matrixIndex < radius; matrixIndex++) {
        const normalizedPosition = 1-(Math.abs(matrixIndex * 2)/(matrixWidth));
        matrix.push(normalizedPosition);
    }
    console.log(matrix);
    console.log(generateGaussianMatrix(radius)[radius])
    return matrix;
}

export async function separatedGaussianBlur(sourceImage: Jimp, radius: number = 3): Promise<Jimp> {
    let halfMatrix = generateGaussianMatrix(radius)[radius];
    // WARNING: EXTREMELY STUPID WAY TO "SCALE" THE GENERATED GAUSSIAN TO NORMALIZE IT.
    // console.log("Matrix Weight (Before): " + halfMatrix.reduce((a, b) => { return a + b }, 0));
    // let iterationCount = 1;
    const iterationPower = 1.005;
    while (halfMatrix.reduce((a, b) => { return a + b }, 0) < 1) {
        // iterationCount++;
        halfMatrix = halfMatrix.map(item => item * iterationPower);
    }
    // console.log(`Matrix Weight (After): ${halfMatrix.reduce((a, b) => { return a + b; }, 0)} (${iterationPower}^${iterationCount})`);
    const separatedClone = new Jimp(sourceImage.bitmap.width, sourceImage.bitmap.height, 0x000000ff);

    separatedClone.scan(0, 0, sourceImage.bitmap.width, sourceImage.bitmap.height, function(x, y, idx) {
        let accumulatedRGB: [number, number, number] = [0, 0, 0];
        for (let matrixIndex = -radius; matrixIndex < radius + 1; matrixIndex++) {
            const sourceIndex = sourceImage.getPixelIndex(x + matrixIndex, y);
            const matrixValue = halfMatrix[matrixIndex + radius];

            accumulatedRGB[0] += sourceImage.bitmap.data[sourceIndex + 0] * matrixValue;
            accumulatedRGB[1] += sourceImage.bitmap.data[sourceIndex + 1] * matrixValue;
            accumulatedRGB[2] += sourceImage.bitmap.data[sourceIndex + 2] * matrixValue;
        }

        separatedClone.bitmap.data[idx + 0] = clampForRGB(accumulatedRGB[0]);
        separatedClone.bitmap.data[idx + 1] = clampForRGB(accumulatedRGB[1]);
        separatedClone.bitmap.data[idx + 2] = clampForRGB(accumulatedRGB[2]);
    })

    separatedClone.scan(0, 0, separatedClone.bitmap.width, separatedClone.bitmap.height, function (x, y, idx) {
        let accumulatedRGB: [number, number, number] = [0, 0, 0];
        for (let matrixIndex = -radius; matrixIndex < radius + 1; matrixIndex++) {
            const sourceIndex = separatedClone.getPixelIndex(x, y + matrixIndex);
            const matrixValue = halfMatrix[matrixIndex + radius];

            accumulatedRGB[0] += separatedClone.bitmap.data[sourceIndex + 0] * matrixValue;
            accumulatedRGB[1] += separatedClone.bitmap.data[sourceIndex + 1] * matrixValue;
            accumulatedRGB[2] += separatedClone.bitmap.data[sourceIndex + 2] * matrixValue;
        }

        separatedClone.bitmap.data[idx + 0] = clampForRGB(accumulatedRGB[0]);
        separatedClone.bitmap.data[idx + 1] = clampForRGB(accumulatedRGB[1]);
        separatedClone.bitmap.data[idx + 2] = clampForRGB(accumulatedRGB[2]);
    })

    return separatedClone;
}