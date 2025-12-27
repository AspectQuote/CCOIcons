import Jimp from "jimp";

export type LinearMatrix = [
    [number, number],
    [number, number]
];

export async function rotateImage(image: Jimp, radians: number) {
    return applyLinearMatrix(image, [
        [Math.cos(radians), -Math.sin(radians)],
        [Math.sin(radians), Math.cos(radians)]
    ]);
}

export async function applyLinearMatrix(image: Jimp, matrix: LinearMatrix) {
    const newImage = new Jimp(image.bitmap.width, image.bitmap.height, 0x00000000);

    const inverseMatrix: LinearMatrix = generateInverseLinearMatrix(matrix);

    const halfMeasures = {
        width: (image.bitmap.width / 2),
        height: (image.bitmap.height / 2)
    };

    newImage.scan(0, 0, newImage.bitmap.width, newImage.bitmap.height, function (x, y, idx) {
        const pixelX = x - halfMeasures.width;
        const pixelY = y - halfMeasures.height;

        const sourcePixelX = (pixelX * inverseMatrix[0][0]) + (pixelY * inverseMatrix[0][1]) + halfMeasures.width;
        const sourcePixelY = (pixelX * inverseMatrix[1][0]) + (pixelY * inverseMatrix[1][1]) + halfMeasures.height;

        if (sourcePixelX < 0 || sourcePixelX >= image.bitmap.width || sourcePixelY < 0 || sourcePixelY >= image.bitmap.height) {
        } else {
            newImage.setPixelColor(image.getPixelColor(sourcePixelX, sourcePixelY), x, y);
        }
    });

    return newImage;
}

export async function applyShear(image: Jimp, shearFactorX: number = 0, shearFactorY: number = 0) {
    return applyLinearMatrix(image, [
        [1, shearFactorX],
        [shearFactorY, 1]
    ]);
}

export function generateInverseLinearMatrix(matrix: LinearMatrix) {
    const inversionConstant = 1 / ((matrix[0][0] * matrix[1][1]) - (matrix[0][1] * matrix[1][0]))
    return [
        [ matrix[1][1] * inversionConstant, -matrix[0][1] * inversionConstant ],
        [ -matrix[1][0] * inversionConstant, matrix[0][0] * inversionConstant ]
    ] satisfies LinearMatrix;
}