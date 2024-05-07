import Jimp from 'jimp';
import * as fs from 'fs-extra';
import path from 'path';
import * as gifwrap from 'gifwrap';

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
            console.log(framesInAnimation)
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
 * @param iconFileName The name of the icon, do not include the image extension
 * @param iconPath The path to the directory where the icon should be saved
 * @param delayCentisecs The duration of each frame in an animated icon's .gif file
 * @returns A boolean that describes whether or not the save was successful.
 */
async function saveAnimatedCubeIcon(frames: Jimp[], iconFileName: string, iconPath: string, delayCentisecs: number = 1): Promise<boolean> {
    return new Promise(async (res, rej) => {
        iconFileName = iconFileName.split('.')[0];
        if (frames.length === 1) {
            await frames[0].writeAsync(path.resolve(`${iconPath}/${iconFileName}.png`))
            res(true)
        } else {
            await gifwrap.GifUtil.write(path.resolve(`${iconPath}/${iconFileName}.gif`), frames.map(frame => new gifwrap.GifFrame(frame.bitmap, {delayCentisecs})));
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
 * @returns The image after the stroke is applied
 */
function strokeImage(image: Jimp, color: number, strokeOnly: boolean = false): Jimp {
    let outlineCoords: { x: number, y: number }[] = [];
    let newImage = new Jimp(image.bitmap.width + 2, image.bitmap.height + 2, 0x00000000)
    if (!strokeOnly) newImage.composite(image, 1, 1);
    newImage.scan(0, 0, newImage.bitmap.width, newImage.bitmap.height, (x, y, idx) => {
        if (newImage.bitmap.data[idx + 3] === 0) {
            let pixelIsOutline = false;
            for (let yOffset = -1; yOffset <= 1 && !pixelIsOutline; yOffset++) {
                let yPos = y + yOffset
                let adjacentPixelIndex = newImage.getPixelIndex(x, yPos);
                if (newImage.bitmap.data[adjacentPixelIndex + 3] > 0) {
                    pixelIsOutline = true;
                }
            }
            for (let xOffset = -1; xOffset <= 1 && !pixelIsOutline; xOffset++) {
                let xPos = x + xOffset;
                let adjacentPixelIndex = newImage.getPixelIndex(xPos, y);
                if (newImage.bitmap.data[adjacentPixelIndex + 3] > 0) {
                    pixelIsOutline = true;
                }
            }
            if (pixelIsOutline) {
                outlineCoords.push({ x, y });
            }
        }
    })
    outlineCoords.forEach(coordinate => newImage.setPixelColor(color, coordinate.x, coordinate.y));
    return newImage;
}

export {
    fillRect,
    rgbaFromNumberLiteral,
    loadAnimatedCubeIcon,
    saveAnimatedCubeIcon,
    strokeImage
}