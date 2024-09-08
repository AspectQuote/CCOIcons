import Jimp from 'jimp';
import * as fs from 'fs-extra';
import path from 'path';
import * as gifwrap from 'gifwrap';
import { coordinate, strokeMatrix } from 'src/typedefs';
import * as config from './schematics/config';
import { distanceBetweenPoints, leastCommonMultiple } from './maths';

/**
 * Get the RGBA representation of a hex literal
 * @param num Number hex literal, including alpha value (0xffffffff)
 * @returns An object representing the RGB of that hex literal
 */
function rgbaFromNumberLiteral(num: number) {
    return {
        // Just bit shifts. Nothing fancy.
        red: (num >> 24 & 255),
        green: (num >> 16 & 255),
        blue: (num >> 8 & 255),
        alpha: (num & 255),
    }
}

/**
 * Place a rectangle onto a Jimp image
 * @param image Jimp image which you want to paste a rectangle onto
 * @param rectX The X position of the rectangle (leftmost pixel of the rectangle)
 * @param rectY The Y position of the rectangle (topmost pixel of the rectangle)
 * @param width The width of the rectangle
 * @param height The height of the rectangle
 * @param color The color of the rectangle
 */
function fillRect(image: Jimp, rectX: number, rectY: number, width: number, height: number, color: number) {
    image.scan(rectX, rectY, width, height, function (x, y, index) {
        image.setPixelColor(color, x, y);
    })
}

/**
 * Load an icon spritesheet
 * @param iconPath Path to the icon you want to load
 * @returns An array of Jimp images
 */
async function loadAnimatedCubeIcon(iconPath: string): Promise<Jimp[]> {
    let cubeFrames: Jimp[] = [];
    if (!fs.existsSync(iconPath)) {
        console.log(`Cube Icon Path not found!\n${path.resolve(iconPath)}`)
        return cubeFrames;
    }
    if (iconPath.endsWith('.gif')) {
        let rawImageFile = await gifwrap.GifUtil.read(iconPath);
        rawImageFile.frames.forEach(frame => {
            cubeFrames.push(new Jimp(frame.bitmap))
        })
    } else {
        let rawImageFile = await Jimp.read(iconPath);
        if (rawImageFile.bitmap.height % rawImageFile.bitmap.width === 0) {
            let framesInAnimation = rawImageFile.bitmap.height / rawImageFile.bitmap.width;
            for (let frameIndex = 0; frameIndex < framesInAnimation; frameIndex++) {
                cubeFrames.push(
                    rawImageFile
                        .clone()
                        .crop(0, rawImageFile.bitmap.width * frameIndex, rawImageFile.bitmap.width, rawImageFile.bitmap.width)
                )
            }
        } else {
            cubeFrames.push(rawImageFile);
        }
    }
    return cubeFrames;
}

/**
 * Save an animated icon, will save two files if there's more than one frame: a .gif and a .png spritesheet.
 * @param frames An array of Jimp images
 * @param iconFileName The name of the icon, if there is a . here, then only the characters before the first . will be used.
 * @param iconPath The path to the directory where the icon should be saved
 * @param delayCentisecs The duration of each frame in an animated icon's .gif file
 * @returns A boolean that describes whether or not the save was successful.
 */
async function saveAnimatedCubeIcon(frames: Jimp[], iconFileName: string, iconPath: string, delayCentisecs: number): Promise<boolean> {
    return new Promise(async (res, rej) => {
        iconFileName = iconFileName.split('.')[0];
        if (frames.length === 1) {
            await frames[0].writeAsync(path.resolve(`${iconPath}/${iconFileName}.png`))
            res(true)
        } else {
            await gifwrap.GifUtil.write(path.resolve(`${iconPath}/${iconFileName}.gif`), frames.map(frame => new gifwrap.GifFrame(frame.bitmap, {delayCentisecs: delayCentisecs}))).catch(e => {
                console.log(e)
            });
            let imageSpriteSheet = new Jimp(frames[0].bitmap.width, frames[0].bitmap.height * frames.length, 0x00000000);
            frames.forEach((frame, idx) => {
                imageSpriteSheet.composite(frame, 0, idx * frames[0].bitmap.height)
            });
            await imageSpriteSheet.writeAsync(path.resolve(`${iconPath}/${iconFileName}.png`));
            res(true)
        }
    })
}

/**
 * Add stroke to an image (an outline)
 * @param image The image you want to add stroke to
 * @param color The color of the stroke you want to add
 * @param thickness How thick the stroke should be.
 * @param strokeOnly Only return an image with the stroke, not the original image
 * @returns The image after the stroke is applied
 */
function strokeImage(image: Jimp, color: number, thickness: number, strokeOnly: boolean = false, matrix: strokeMatrix = [
    [0, 1, 0],
    [1, 0, 1],
    [0, 1, 0]
]): Jimp {
    let outlineCoords: { x: number, y: number }[] = [];
    let strokeWidth = Math.max(thickness, 1);
    let newImage = new Jimp(image.bitmap.width + (strokeWidth * 2), image.bitmap.height + (strokeWidth * 2), 0x00000000);
    if (matrix.length !== 3 || matrix[0]?.length !== 3) {
        console.log("stroke Image: bad matrix supplied.", matrix)
        return process.exit(1)
    }
    if (!strokeOnly) newImage.composite(image, strokeWidth, strokeWidth);

    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        if (this.bitmap.data[idx + 3] != 0) {
            for (let matrixYIndex = -1; matrixYIndex < matrix.length - 1; matrixYIndex++) {
                const matrixRow = matrix[matrixYIndex + 1];
                for (let matrixXIndex = -1; matrixXIndex < matrixRow.length - 1; matrixXIndex++) {
                    const matrixCheck = matrixRow[matrixXIndex + 1];
                    if (matrixCheck === 1) {
                        const coord = {
                            x: x + matrixXIndex,
                            y: y + matrixYIndex
                        }
                        if (coord.x !== x || coord.y !== y) {
                            if (coord.x < 0 || coord.y < 0 || coord.x >= this.bitmap.width || coord.y >= this.bitmap.height || this.bitmap.data[this.getPixelIndex(coord.x, coord.y) + 3] === 0) {
                                outlineCoords.push({ x: coord.x + strokeWidth, y: coord.y + strokeWidth });
                            }
                        }
                    }
                }
            }
        }
    })

    outlineCoords.forEach(coordinate => newImage.setPixelColor(color, coordinate.x, coordinate.y));

    for (let strokeIndex = 0; strokeIndex < strokeWidth-1; strokeIndex++) {
        let newOutlineCoords: typeof outlineCoords = [];
        outlineCoords.forEach(coord => {
            for (let matrixYIndex = -1; matrixYIndex < matrix.length - 1; matrixYIndex++) {
                const matrixRow = matrix[matrixYIndex + 1];
                for (let matrixXIndex = -1; matrixXIndex < matrixRow.length - 1; matrixXIndex++) {
                    const matrixCheck = matrixRow[matrixXIndex + 1];
                    if (matrixCheck === 1) {
                        const newCoord = {
                            x: coord.x + matrixXIndex,
                            y: coord.y + matrixYIndex
                        }
                        if (coord.x !== newCoord.x || coord.y !== newCoord.y) {
                            if (newCoord.x < 0 || newCoord.y < 0 || newCoord.x >= newImage.bitmap.width || newCoord.y >= newImage.bitmap.height || newImage.bitmap.data[newImage.getPixelIndex(newCoord.x, newCoord.y) + 3] === 0) {
                                newOutlineCoords.push({ x: newCoord.x, y: newCoord.y });
                            }
                        }
                    }
                }
            }
        })

        outlineCoords = newOutlineCoords;
        outlineCoords.forEach(coordinate => newImage.setPixelColor(color, coordinate.x, coordinate.y));
    }

    return newImage;
}

function parseHorizontalSpriteSheet(image: Jimp, frameCount: number): Jimp[] {
    let parsedFrames: Jimp[] = [];

    const frameWidth = Math.floor(image.bitmap.width/frameCount);
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
        parsedFrames.push(image.clone().crop(frameWidth*frameIndex, 0, frameWidth, image.bitmap.height));
    }

    return parsedFrames;
}

async function generateSmallWordImage(word: string, background: number, color: number, padding: number): Promise<Jimp> {
    const alphabetLetters = parseHorizontalSpriteSheet(await Jimp.read(`${config.relativeRootDirectory}/CCOIcons/${config.sourceImagesDirectory}/misc/smallalphabet.png`), 38);
    return await assembleWordImage(word, alphabetLetters, background, color, padding);
}

async function assembleWordImage(word: string, alphabetLetters: Jimp[], background: number, color: number, padding: number): Promise<Jimp> {
    const lowerCaseCharCodeOffset = 97;
    const upperCaseCharCodeOffset = 65;
    const spaceCharCode = 32;
    const singleQuoteCharCode = 39;
    const doubleQuoteCharCode = 34;
    const exclamationCharCode = 33;
    const questionMarkCharCode = 63;
    const periodCharCode = 46;
    const dashCharCode = 45;
    const underscoreCharCode = 95;
    const equalsCharCode = 61;
    const plusCharCode = 43;
    const openParenthesisCharCode = 40;
    const closedParenthesisCharCode = 41;
    
    const imageWidth = alphabetLetters[0].bitmap.width * word.length;
    const imageHeight = alphabetLetters[0].bitmap.height / 2;
    const image = new Jimp(imageWidth, imageHeight, background);

    const letterArray = word.split('');

    let writeXPosition = 0;
    for (let letterArrayIndex = 0; letterArrayIndex < letterArray.length; letterArrayIndex++) {
        const character = letterArray[letterArrayIndex];
        let letterImageIndex = character.charCodeAt(0);
        let cropYOffset = 0;
        if (!Number.isNaN(parseInt(character))) { // Character is a number
            letterImageIndex = 26 + parseInt(character);
        } else if (letterImageIndex === spaceCharCode) { // Character is a space
            letterImageIndex = 26;
            cropYOffset += imageHeight;
        } else if (letterImageIndex === singleQuoteCharCode) { // Character is a single quote
            letterImageIndex = 27;
            cropYOffset += imageHeight;
        } else if (letterImageIndex === doubleQuoteCharCode) { // Character is a double quote
            letterImageIndex = 28;
            cropYOffset += imageHeight;
        } else if (letterImageIndex === exclamationCharCode) { // Character is an exclamation point
            letterImageIndex = 29;
            cropYOffset += imageHeight;
        } else if (letterImageIndex === questionMarkCharCode) { // Character is a question mark
            letterImageIndex = 30;
            cropYOffset += imageHeight;
        } else if (letterImageIndex === periodCharCode) { // Character is a period
            letterImageIndex = 31;
            cropYOffset += imageHeight;
        } else if (letterImageIndex === dashCharCode) { // Character is a dash
            letterImageIndex = 32;
            cropYOffset += imageHeight;
        } else if (letterImageIndex === underscoreCharCode) { // Character is an underscore
            letterImageIndex = 33;
            cropYOffset += imageHeight;
        } else if (letterImageIndex === equalsCharCode) { // Character is a equals sign
            letterImageIndex = 34;
            cropYOffset += imageHeight;
        } else if (letterImageIndex === plusCharCode) { // Character is a plus sign
            letterImageIndex = 35;
            cropYOffset += imageHeight;
        } else if (letterImageIndex === openParenthesisCharCode) { // Character is an open parenthesis
            letterImageIndex = 36;
            cropYOffset += imageHeight;
        } else if (letterImageIndex === closedParenthesisCharCode) { // Character is a closed parenthesis
            letterImageIndex = 36;
        } else if (character.toUpperCase() === character) { // Character is uppercase
            letterImageIndex -= upperCaseCharCodeOffset;
        } else { // Character is lowercase
            letterImageIndex -= lowerCaseCharCodeOffset;
            cropYOffset += imageHeight;
        }
        if (letterImageIndex < 0 || letterImageIndex >= alphabetLetters.length) {
            letterImageIndex = alphabetLetters.length - 1;
        }

        const characterImage = alphabetLetters[letterImageIndex].clone().crop(0, cropYOffset, alphabetLetters[0].bitmap.width, imageHeight + cropYOffset);

        characterImage.scan(0, 0, characterImage.bitmap.width, characterImage.bitmap.height, function (x, y, idx) {
            if (this.bitmap.data[idx + 3] > 0) {
                image.setPixelColor(color, (x + writeXPosition) % image.bitmap.width, y % image.bitmap.height);
            }
        })

        writeXPosition += characterImage.bitmap.width;
    }

    return strokeImage(image, background, padding);
}

function drawLine(image: Jimp, color: number, startPoint: coordinate, endPoint: coordinate, thickness: number) {
    const yChange = endPoint.y - startPoint.y;
    const xChange = endPoint.x - startPoint.x;
    const loopTimes = Math.ceil(distanceBetweenPoints(startPoint, endPoint));
    for (let linePositionIndex = 0; linePositionIndex < loopTimes; linePositionIndex++) {
        const x = Math.round(startPoint.x + ((xChange/loopTimes) * linePositionIndex));
        const y = Math.round(startPoint.y + ((yChange/loopTimes) * linePositionIndex));
        image.setPixelColor(color, x, y);
    }
}

export {
    fillRect,
    rgbaFromNumberLiteral,
    loadAnimatedCubeIcon,
    saveAnimatedCubeIcon,
    strokeImage,
    drawLine,
    parseHorizontalSpriteSheet,
    generateSmallWordImage
}