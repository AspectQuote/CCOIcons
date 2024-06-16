import Jimp from 'jimp';
import * as fs from 'fs-extra';
import path from 'path';
import * as gifwrap from 'gifwrap';
import { coordinate } from 'src/typedefs';

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
function strokeImage(image: Jimp, color: number, thickness: number, strokeOnly: boolean = false): Jimp {
    let outlineCoords: { x: number, y: number }[] = [];
    let strokeWidth = Math.max(thickness, 1);
    let newImage = new Jimp(image.bitmap.width + (strokeWidth * 2), image.bitmap.height + (strokeWidth * 2), 0x00000000);
    if (!strokeOnly) newImage.composite(image, strokeWidth, strokeWidth);

    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        if (this.bitmap.data[idx + 3] != 0) {
            for (let pixelXOffset = -1; pixelXOffset <= 1; pixelXOffset++) {
                let checkingCoords: { x: number, y: number }[] = [
                    { x: x - 1, y: y },
                    { x: x + 1, y: y },
                    { x: x, y: y - 1 },
                    { x: x, y: y + 1 }
                ];

                checkingCoords.forEach(coord => {
                    if (coord.x < 0 || coord.y < 0 || coord.x >= this.bitmap.width || coord.y >= this.bitmap.height || this.bitmap.data[this.getPixelIndex(coord.x, coord.y) + 3] === 0) {
                        outlineCoords.push({x: coord.x + strokeWidth, y: coord.y + strokeWidth});
                    }
                })
            }
        }
    })

    outlineCoords.forEach(coordinate => newImage.setPixelColor(color, coordinate.x, coordinate.y));

    for (let strokeIndex = 0; strokeIndex < strokeWidth-1; strokeIndex++) {
        let newOutlineCoords: typeof outlineCoords = [];
        outlineCoords.forEach(coord => {
            let checkingCoords: { x: number, y: number }[] = [
                { x: coord.x - 1, y: coord.y },
                { x: coord.x + 1, y: coord.y },
                { x: coord.x, y: coord.y - 1 },
                { x: coord.x, y: coord.y + 1 }
            ];

            checkingCoords.forEach(newCoord => {
                if (newCoord.x < 0 || newCoord.y < 0 || newCoord.x >= newImage.bitmap.width || newCoord.y >= newImage.bitmap.height || newImage.bitmap.data[newImage.getPixelIndex(newCoord.x, newCoord.y) + 3] === 0) {
                    newOutlineCoords.push({ x: newCoord.x, y: newCoord.y });
                }
            })
        })

        outlineCoords = newOutlineCoords;
        outlineCoords.forEach(coordinate => newImage.setPixelColor(color, coordinate.x, coordinate.y));
    }

    return newImage;
}

function drawLine(image: Jimp, color: number, startPoint: coordinate, endPoint: coordinate, thickness: number) {

}

export {
    fillRect,
    rgbaFromNumberLiteral,
    loadAnimatedCubeIcon,
    saveAnimatedCubeIcon,
    strokeImage,
    drawLine
}