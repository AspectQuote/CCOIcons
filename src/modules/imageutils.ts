import Jimp from 'jimp';
import * as fs from 'fs-extra';
import path from 'path';
import * as gifwrap from 'gifwrap';

function rgbaFromNumberLiteral(num: number) {
    return {
        red: (num >> 24 & 255),
        green: (num >> 16 & 255),
        blue: (num >> 8 & 255),
        alpha: (num & 255),
    }
}

function fillRect(image: Jimp, rectX: number, rectY: number, width: number, height: number, color: number) {
    image.scan(rectX, rectY, width, height, function (x, y, index) {
        image.setPixelColor(color, x, y);
    })
}

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

async function saveAnimatedCubeIcon(frames: Jimp[], iconFileName: string, iconPath: string): Promise<boolean> {
    return new Promise(async (res, rej) => {
        iconFileName = iconFileName.split('.')[0];
        if (frames.length === 1) {
            await frames[0].writeAsync(path.resolve(`${iconPath}/${iconFileName}.png`))
            res(true)
        } else {
            await gifwrap.GifUtil.write(path.resolve(`${iconPath}/${iconFileName}.gif`), frames.map(frame => new gifwrap.GifFrame(frame.bitmap)));
            let imageSpriteSheet = new Jimp(frames[0].bitmap.width, frames[0].bitmap.height * frames.length, 0x00000000);
            frames.forEach((frame, idx) => {
                imageSpriteSheet.composite(frame, 0, idx * frames[0].bitmap.height)
            });
            await imageSpriteSheet.writeAsync(path.resolve(`${iconPath}/${iconFileName}.png`));
            res(true)
        }
    })
}

function strokeImage(image: Jimp, color: number) {
    let outlineCoords: { x: number, y: number }[] = [];
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
        if (image.bitmap.data[idx + 3] === 0) {
            let pixelIsOutline = false;
            for (let yOffset = -1; yOffset <= 1 && !pixelIsOutline; yOffset++) {
                let yPos = y + yOffset
                let adjacentPixelIndex = image.getPixelIndex(x, yPos);
                if (image.bitmap.data[adjacentPixelIndex + 3] > 0) {
                    pixelIsOutline = true;
                }
            }
            for (let xOffset = -1; xOffset <= 1 && !pixelIsOutline; xOffset++) {
                let xPos = x + xOffset;
                let adjacentPixelIndex = image.getPixelIndex(xPos, y);
                if (image.bitmap.data[adjacentPixelIndex + 3] > 0) {
                    pixelIsOutline = true;
                }
            }
            if (pixelIsOutline) {
                outlineCoords.push({ x, y });
            }
        }
    })
    outlineCoords.forEach(coordinate => image.setPixelColor(color, coordinate.x, coordinate.y));
}

export {
    fillRect,
    rgbaFromNumberLiteral,
    loadAnimatedCubeIcon,
    saveAnimatedCubeIcon,
    strokeImage
}