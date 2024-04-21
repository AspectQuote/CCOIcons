import * as CCOIcons from './../typedefs';
import * as fs from 'fs-extra';
import * as path from 'path';
import Jimp from 'jimp';
import { JimpBitmap } from 'gifwrap';
let seedrandom = require('seedrandom');

const cubes: { [key in CCOIcons.cubeID]: CCOIcons.cubeDefinition } = fs.readJSONSync('./config/cubes.json');
const prefixes: { [key in CCOIcons.prefixID]: CCOIcons.cubeDefinition } = fs.readJSONSync('./config/prefixes.json');
const rarityConfig: { [key in CCOIcons.rarityID]: CCOIcons.rarityDefinition } = fs.readJSONSync('./config/rarityConfig.json');
const patternSchema: { [key in CCOIcons.patternedCubeID]: CCOIcons.patternedCubeDefinition } = fs.readJSONSync('./config/patterneditems.json');
const patternedCubeIDs: CCOIcons.patternedCubeID[] = Object.keys(patternSchema) as CCOIcons.patternedCubeID[];

const patternIndexLimit = 1000;
const patternAtlasRoot = Math.ceil(Math.sqrt(patternIndexLimit));
const patternAtlasPadding = 1;

const relativeRootDirectory = `${__dirname}/../../..`;
const sourceImagesDirectory = './sourceicons/cubes/';

function clampRandomHiLo(low: number, high: number, seed: any) {
    return ((high - low) * seed) + low;
}

type cubeSeedValues = {
    brightness: number
    saturation: number
    scale: number
    hue: number
    rotation: number
    cropX: number
    cropY: number
    maskImage: number[]
}
function getSeededIconRNGValues(cubeID: CCOIcons.patternedCubeID, seed: number, offset: number): cubeSeedValues {
    const RNGenerator = new seedrandom(`${cubeID}${seed.toString()}${offset.toString()}`);
    const seedValuesObj: cubeSeedValues = {
        brightness: RNGenerator(),
        saturation: RNGenerator(),
        scale: RNGenerator(),
        hue: RNGenerator(),
        rotation: RNGenerator(),
        cropX: RNGenerator(),
        cropY: RNGenerator(),
        maskImage: [RNGenerator(), RNGenerator(), RNGenerator(), RNGenerator(), RNGenerator(), RNGenerator(), RNGenerator(), RNGenerator(), RNGenerator(), RNGenerator()]
    }
    return seedValuesObj;
}

const xAtlasTypes = ["base", "accents", "eyes", "mouths"] as const;
function getPatternAtlasCoordinates(iconWidth: number, iconHeight: number, patternIndex: number, type: typeof xAtlasTypes[number]): {x: number, y: number} {
    const xPatternTypeCoordinateAddition = xAtlasTypes.indexOf(type) * iconWidth * patternAtlasRoot;
    const x = xPatternTypeCoordinateAddition + (iconWidth * (patternIndex % patternAtlasRoot));
    const y = iconHeight * Math.floor(patternIndex / patternAtlasRoot);
    return {x, y};
}

async function getSeededIconAtlas(cubeID: CCOIcons.patternedCubeID): Promise<Jimp> {
    const patternInfo: undefined | CCOIcons.patternedCubeDefinition = patternSchema[cubeID];
    const patternAtlasDirectory = path.resolve(`${relativeRootDirectory}/ccicons/patternatlases`);
    if (!fs.existsSync(patternAtlasDirectory)) fs.mkdirSync(patternAtlasDirectory, { recursive: true });
    const patternAtlasFilePath = path.resolve(`${patternAtlasDirectory}/${cubeID}patternatlas.png`);
    if (fs.existsSync(patternAtlasFilePath)) {
        return await Jimp.read(patternAtlasFilePath);
    } else {
        // Image Directory
        const imageDirectory = `./sourceicons/seededcubetextures/${cubeID}`;
        // Load the base cube image from the seeded cube directory.
        const baseImage = await Jimp.read(`${imageDirectory}/base.png`)

        const iconWidth = (baseImage.bitmap.width + (patternAtlasPadding * 2));
        const iconHeight = (baseImage.bitmap.height + (patternAtlasPadding * 2));
        
        const newPatternAtlas: Jimp = new Jimp((patternAtlasRoot * iconWidth * xAtlasTypes.length) - (patternAtlasPadding * 2), (patternAtlasRoot * iconHeight) - (patternAtlasPadding * 2), 0x00000000);
        // Read mask overlay image and put that over the composite later
        const overlayImage = await Jimp.read(`${imageDirectory}/finaloverlay.png`);

        for (let patternIndex = 0; patternIndex < patternIndexLimit; patternIndex++) {
            let patternImages: { [key in typeof xAtlasTypes[number]]?: undefined | Jimp }[] = []
            const overallPatternSeedRNG = getSeededIconRNGValues(cubeID, patternIndex, 0);
            for (let patternImageIndex = 0; patternImageIndex < patternInfo.patternimages.length; patternImageIndex++) {
                const individualPatternSeedRNG = getSeededIconRNGValues(cubeID, patternIndex, patternImageIndex);
                const patternImageData = patternInfo.patternimages[patternImageIndex];

                let patternImageLayers: { [key in typeof xAtlasTypes[number]]?: Jimp | undefined} = {}

                for (let patternImageLayerIndex = 0; patternImageLayerIndex < Object.keys(patternImageLayers).length; patternImageLayerIndex++) {
                    const key: keyof typeof patternImageLayers = Object.keys(patternImageLayers)[patternImageLayerIndex] as keyof typeof patternImageLayers;
                    const imageFilePath = `./sourceicons/textures/${patternImageData.path}/${key}.png`;
                    if (fs.existsSync(imageFilePath)) {
                        patternImageLayers[key] = await Jimp.read(imageFilePath);
                        // I love typedefs!!!
                        let imageManipulations: { apply: "lighten" | "brighten" | "darken" | "desaturate" | "saturate" | "greyscale" | "spin" | "hue" | "mix" | "tint" | "shade" | "xor" | "red" | "green" | "blue", params: [number] }[] = [];
                        if (key === "base") {
                
                            // Brighten the pattern image
                            if (patternImageData.seedbrightness) {
                                const brightness = clampRandomHiLo(patternImageData.seedbrightnessrange[0], patternImageData.seedbrightnessrange[1], individualPatternSeedRNG.brightness);
                                const manipulationMethod = brightness > 0 ? "lighten" : "darken";
                                imageManipulations.push({ apply: manipulationMethod, params: [Math.abs(brightness)] });
                            }
                
                            // Saturate the pattern image
                            if (patternImageData.seedsaturate) {
                                const saturation = clampRandomHiLo(patternImageData.seedsaturaterange[0], patternImageData.seedsaturaterange[1], individualPatternSeedRNG.saturation);
                                const manipulationMethod = saturation > 0 ? "saturate" : "desaturate";
                                imageManipulations.push({ apply: manipulationMethod, params: [saturation] });
                            }
                
                            // Hue-Rotate the pattern image
                            if (patternImageData.seedhuerotate) {
                                imageManipulations.push({ apply: "hue", params: [Math.round(individualPatternSeedRNG.hue * 360)] });
                            }
                        }
                        if (patternImageLayers[key] !== undefined) {
                            const JimpImg: Jimp = patternImageLayers[key] as Jimp;
                            // Scale the pattern image
                            if (patternImageData.seedscale) {
                                const scale = clampRandomHiLo(patternImageData.seedscalerange[0], patternImageData.seedscalerange[1], individualPatternSeedRNG.scale);
                                JimpImg.resize(JimpImg.bitmap.width * scale, JimpImg.bitmap.height * scale, Jimp.RESIZE_NEAREST_NEIGHBOR);
                            }
                
                            // Rotate pattern image
                            if (patternImageData.seedrotate) {
                                let degrees = Math.floor(individualPatternSeedRNG.rotation * 360);
                                const imageSizeTarget = Math.sqrt(Math.pow((JimpImg.bitmap.width / 2), 2) + Math.pow((JimpImg.bitmap.height / 2), 2));
                                JimpImg.rotate(degrees, false)
                                JimpImg.crop((JimpImg.bitmap.width - imageSizeTarget) / 2, (JimpImg.bitmap.height - imageSizeTarget) / 2, imageSizeTarget, imageSizeTarget);
                            }
    
                            // Create cropped pattern image to the size of the pattern mask, at a random(seeded) position
                            const cropXPos = Math.floor(individualPatternSeedRNG.cropX * (JimpImg.bitmap.width - baseImage.bitmap.width));
                            const cropYPos = Math.floor(individualPatternSeedRNG.cropY * (JimpImg.bitmap.height - baseImage.bitmap.height));
                            JimpImg.crop(cropXPos, cropYPos, baseImage.bitmap.height, baseImage.bitmap.width);
            
                            // Apply color manimpulatons, if they exist.
                            if (imageManipulations.length > 0) JimpImg.color(imageManipulations);
                        }
                    }
                }

    
                patternImages.push(patternImageLayers);
            }
            const newBaseImage = baseImage.clone();
            for (let maskImageIndex = 0; maskImageIndex < patternInfo.masks.length; maskImageIndex++) {
                const maskInfo = patternInfo.masks[maskImageIndex];
                // Read random(seeded) mask image
                let maskImage = await Jimp.read(`${imageDirectory}/${maskInfo.images[Math.floor(maskInfo.images.length * overallPatternSeedRNG.maskImage[maskImageIndex % overallPatternSeedRNG.maskImage.length])]}.png`);
                
                for (let patternImageLayerIndex = 0; patternImageLayerIndex < Object.keys(patternImages[maskInfo.patternimage]).length; patternImageLayerIndex++) {
                    const key: keyof typeof patternImages[number] = Object.keys(patternImages[maskInfo.patternimage])[patternImageLayerIndex] as keyof typeof patternImages[number];
                    // Mask the pattern image with the mask image and composite the modified masked image
                    if (patternImages[maskInfo.patternimage][key] !== undefined) {
                        // @ts-ignore 'key' is a dynamic object property... it's OK!!!
                        const maskedImage = patternImages[maskInfo.patternimage][key].clone().mask(maskImage, 0, 0);
                        if (key === "base") {
                            newBaseImage.composite(maskedImage, 0, 0);
                        } else {
                            const atlasCoordinates = getPatternAtlasCoordinates(iconWidth, iconHeight, patternIndex, key);
                            newPatternAtlas.composite(maskedImage, atlasCoordinates.x, atlasCoordinates.y);
                        }
                    }
                }
            }
            const atlasCoordinates = getPatternAtlasCoordinates(iconWidth, iconHeight, patternIndex, "base");
            console.log(`Generated atlas image for pattern index ${patternIndex} and cube ID ${cubeID}.`)
            newBaseImage.composite(overlayImage, 0, 0);
            newPatternAtlas.composite(newBaseImage, atlasCoordinates.x, atlasCoordinates.y);
        }
        await newPatternAtlas.writeAsync(patternAtlasFilePath);
        return newPatternAtlas;
    }
}

async function getSeededCubeIconType(cubeID: CCOIcons.patternedCubeID, seed: number, type: typeof xAtlasTypes[number]): Promise<Jimp> {
    // Load the base cube image from the seeded cube directory, for the width/height
    const baseImage = await Jimp.read(`./sourceicons/seededcubetextures/${cubeID}/base.png`)
    const atlas = await getSeededIconAtlas(cubeID);
    const iconPosition = getPatternAtlasCoordinates((baseImage.bitmap.width + (patternAtlasPadding * 2)), (baseImage.bitmap.height + (patternAtlasPadding * 2)), seed, type);
    return atlas.crop(iconPosition.x, iconPosition.y, baseImage.bitmap.width, baseImage.bitmap.height);
}

const bSideConfig = {
    resizeSize: 30,
    pixelReach: 2,
    colorGapThereshold: 5
}

function getBSideCornerCoordinates(pixelX: number, pixelY: number) {
    let topLeftOfPixel = {x: pixelX * bSideConfig.resizeSize, y: pixelY * bSideConfig.resizeSize};
    let corners = {
        topLeft: topLeftOfPixel, // Top-Left
        topRight: { x: topLeftOfPixel.x + (bSideConfig.resizeSize - 1), y: topLeftOfPixel.y }, // Top-Right
        bottomRight: { x: topLeftOfPixel.x + (bSideConfig.resizeSize - 1), y: topLeftOfPixel.y + (bSideConfig.resizeSize - 1) }, // Bottom-Right
        bottomLeft: { x: topLeftOfPixel.x, y: topLeftOfPixel.y + (bSideConfig.resizeSize - 1) },  // Bottom-Left
        center: { x: topLeftOfPixel.x + Math.floor(bSideConfig.resizeSize / 2), y: topLeftOfPixel.y + Math.floor(bSideConfig.resizeSize / 2) }
    };
    return corners;
}

function rgbaFromNumberLiteral(num: number) {
    return {
        red: (num >> 24 & 255),
        green: (num >> 16 & 255),
        blue: (num >> 8 & 255),
        alpha: (num & 255),
    }
}

function gracefulPixelRGBA(bitmap: JimpBitmap, idx: number) {
    return {
        red: bitmap.data[idx + 0],
        green: bitmap.data[idx + 1],
        blue: bitmap.data[idx + 2],
        alpha: bitmap.data[idx + 3]
    }
}

function colorsCloseEnough(color1: { red: number, green: number, blue: number, alpha: number }, color2: { red: number, green: number, blue: number, alpha: number }) {
    return (
        Math.abs(color1.red - color2.red) < bSideConfig.colorGapThereshold &&
        Math.abs(color1.green - color2.green) < bSideConfig.colorGapThereshold &&
        Math.abs(color1.blue - color2.blue) < bSideConfig.colorGapThereshold &&
        Math.abs(color1.alpha - color2.alpha) < bSideConfig.colorGapThereshold 
    );
}

type createdTriangle = { use: boolean, start: { x: number, y: number }, side: "above" | "below", occupying: { x: number, y: number }[], end: { x: number, y: number } };
function createBSideTriangles(image: Jimp, coordinate: { x: number, y: number }, xAxisDirection: -1 | 1 | 0, yAxisDirection: -1 | 1 | 0): createdTriangle[] {
    const centerColor = image.getPixelColor(coordinate.x, coordinate.y);
    const centerBSideCoordinates = getBSideCornerCoordinates(coordinate.x, coordinate.y);
    let primaryTriangle: createdTriangle = {
        start: {x: 0, y: 0},
        end: {x: 0, y: 0},
        occupying: [structuredClone(coordinate)],
        side: "above",
        use: true
    }
    let secondaryTriangle: createdTriangle = {
        start: { x: 0, y: 0 },
        end: { x: 0, y: 0 },
        occupying: [structuredClone(coordinate)],
        side: "below",
        use: true
    }
    let triangleCheckingDirection = {
        x: yAxisDirection,
        y: xAxisDirection
    }
    let countingPrimary = true;
    let countingSecondary = true;
    let checkingPixelCoordinateChange = { x: 1 * triangleCheckingDirection.x, y: 1 * triangleCheckingDirection.y };
    if (xAxisDirection === 1) {
        // Checking to the right of the center
        
        // Triangle that starts from the bottom right of the pixel |/
        primaryTriangle.start = structuredClone(centerBSideCoordinates.bottomRight);
        primaryTriangle.end = structuredClone(centerBSideCoordinates.topRight);
        primaryTriangle.side = "above";

        // Triangle that starts from the top right of the pixel |\
        secondaryTriangle.start = structuredClone(centerBSideCoordinates.topRight);
        secondaryTriangle.end = structuredClone(centerBSideCoordinates.bottomRight);
        secondaryTriangle.side = "below";
    } else if (xAxisDirection === -1) {
        // Checking to the left of the center

        // Triangle that starts from the bottom left of the pixel \|
        primaryTriangle.start = structuredClone(centerBSideCoordinates.topLeft);
        primaryTriangle.end = structuredClone(centerBSideCoordinates.bottomLeft);
        primaryTriangle.side = "below";

        // Triangle that starts from the top left of the pixel /|
        secondaryTriangle.start = structuredClone(centerBSideCoordinates.bottomLeft);
        secondaryTriangle.end = structuredClone(centerBSideCoordinates.topLeft);
        secondaryTriangle.side = "above";
    } else if (yAxisDirection === 1) {
        // Checking below the center

        // Triangle that starts from the bottom left of the pixel \-
        primaryTriangle.start = structuredClone(centerBSideCoordinates.bottomRight);
        primaryTriangle.end = structuredClone(centerBSideCoordinates.bottomLeft);
        primaryTriangle.side = "above";

        // Triangle that starts from the bottom right of the pixel -/
        secondaryTriangle.start = structuredClone(centerBSideCoordinates.bottomLeft);
        secondaryTriangle.end = structuredClone(centerBSideCoordinates.bottomRight);
        secondaryTriangle.side = "above";
    } else if (yAxisDirection === -1) {
        // Checking above the center

        // Triangle that starts from the bottom left of the pixel _\
        primaryTriangle.start = structuredClone(centerBSideCoordinates.topLeft);
        primaryTriangle.end = structuredClone(centerBSideCoordinates.topRight);
        primaryTriangle.side = "below";

        // Triangle that starts from the bottom right of the pixel /_
        secondaryTriangle.start = structuredClone(centerBSideCoordinates.topRight);
        secondaryTriangle.end = structuredClone(centerBSideCoordinates.topLeft);
        secondaryTriangle.side = "below";
    }

    for (let axisOffset = 1; axisOffset <= bSideConfig.pixelReach; axisOffset++) {
        let xAxisOffset = axisOffset * xAxisDirection;
        let yAxisOffset = axisOffset * yAxisDirection;
        let adjacentPixelCoordinate = { x: coordinate.x + xAxisOffset, y: coordinate.y + yAxisOffset };
        let adjacentPixelColor = image.getPixelColor(adjacentPixelCoordinate.x, adjacentPixelCoordinate.y);
        if (adjacentPixelColor === centerColor) {
            if (axisOffset === 1) {
                primaryTriangle.use = false;
                secondaryTriangle.use = false;
            }
            break;
        } else {
            let endMovement = bSideConfig.resizeSize - ((axisOffset === 1) ? 1 : 0)

            let primaryCheckingPixelCoordinate = { x: adjacentPixelCoordinate.x + (checkingPixelCoordinateChange.x * -1), y: adjacentPixelCoordinate.y + (checkingPixelCoordinateChange.y * -1) };
            let primaryCheckingPixelColor = image.getPixelColor(primaryCheckingPixelCoordinate.x, primaryCheckingPixelCoordinate.y);
            if (primaryCheckingPixelColor === centerColor && countingPrimary === true && primaryCheckingPixelCoordinate.x < image.bitmap.width && primaryCheckingPixelCoordinate.x > 0 && primaryCheckingPixelCoordinate.y < image.bitmap.height && primaryCheckingPixelCoordinate.y > 0) {
                primaryTriangle.end.x += endMovement * xAxisDirection;
                primaryTriangle.end.y += endMovement * yAxisDirection;
                primaryTriangle.occupying.push(structuredClone(adjacentPixelCoordinate));
            } else {
                if (axisOffset === 1) primaryTriangle.use = false;
                countingPrimary = false;
            }

            let secondaryCheckingPixelCoordinate = { x: adjacentPixelCoordinate.x + (checkingPixelCoordinateChange.x), y: adjacentPixelCoordinate.y + (checkingPixelCoordinateChange.y) };
            let secondaryCheckingPixelColor = image.getPixelColor(secondaryCheckingPixelCoordinate.x, secondaryCheckingPixelCoordinate.y);
            if (secondaryCheckingPixelColor === centerColor && countingSecondary === true && secondaryCheckingPixelCoordinate.x < image.bitmap.width && secondaryCheckingPixelCoordinate.x > 0 && secondaryCheckingPixelCoordinate.y < image.bitmap.height && secondaryCheckingPixelCoordinate.y > 0) {
                secondaryTriangle.end.x += endMovement * xAxisDirection;
                secondaryTriangle.end.y += endMovement * yAxisDirection;
                secondaryTriangle.occupying.push(structuredClone(adjacentPixelCoordinate));
            } else {
                if (axisOffset === 1) secondaryTriangle.use = false;
                countingSecondary = false;
            }
        }
    }
    let outcome: createdTriangle[] = [primaryTriangle, secondaryTriangle];

    return outcome;
}

type bSideTriangle = {
    occupying: { x: number, y: number }[],
    start: { x: number, y: number },
    end: { x: number, y: number },
    side: "above" | "below",
    color: number
}

async function createBSideImage(originalPath: string, newImagePath: string): Promise<void> {
    console.log(originalPath, newImagePath);
    const originalIcon = await Jimp.read(originalPath);
    // const newIcon = new Jimp(originalIcon.bitmap.width * bSideConfig.resizeSize, originalIcon.bitmap.height * bSideConfig.resizeSize, 0x00000000) 
    const newIcon = originalIcon.clone().resize(originalIcon.bitmap.width * bSideConfig.resizeSize, originalIcon.bitmap.height * bSideConfig.resizeSize, Jimp.RESIZE_NEAREST_NEIGHBOR);
    const triangleCandidatesList: bSideTriangle[] = [];
    const trianglesToDraw: bSideTriangle[] = [];

    originalIcon.scan(0, 0, originalIcon.bitmap.width, originalIcon.bitmap.height, function(x, y, idx) {
        const centerPixelColor = originalIcon.getPixelColour(x, y);
        const centerPixelRGBA = rgbaFromNumberLiteral(centerPixelColor);
        let adjacentPixelsColor: number[] = [];
        for (let adjacentPixelXOffset = -1; adjacentPixelXOffset <= 1; adjacentPixelXOffset++) {
            for (let adjacentPixelYOffset = -1; adjacentPixelYOffset <= 1; adjacentPixelYOffset++) {
                let adjacentCoordinates = {
                    x: x + adjacentPixelXOffset,
                    y: y + adjacentPixelYOffset
                }
                if (adjacentCoordinates.x < 0 || adjacentCoordinates.x >= originalIcon.bitmap.width || adjacentCoordinates.y < 0 || adjacentCoordinates.y >= originalIcon.bitmap.height) {
                    adjacentPixelsColor.push(0)
                } else {
                    // adjacentPixelsColor.push(originalIcon.getPixelColour(adjacentCoordinates.x, adjacentCoordinates.y));
                    if (adjacentCoordinates.x === x || adjacentCoordinates.y === y) {
                        adjacentPixelsColor.push(originalIcon.getPixelColour(adjacentCoordinates.x, adjacentCoordinates.y));
                    }
                }
            }
        }
        
        const centerDomination = adjacentPixelsColor.filter(color => color === centerPixelColor).length;
        const centerIsMinority = -1 === adjacentPixelsColor.findIndex(color => adjacentPixelsColor.filter(adjColor => adjColor == color && color !== centerPixelColor).length >= centerDomination);

        if (centerPixelRGBA.alpha > 0 && centerDomination < Math.ceil(adjacentPixelsColor.length / 2)) {
            const trianglesToTheRight: createdTriangle[] = createBSideTriangles(originalIcon, { x, y }, 1, 0);
            const trianglesToTheLeft: createdTriangle[] = createBSideTriangles(originalIcon, { x, y }, -1, 0);
            const trianglesBelow: createdTriangle[] = createBSideTriangles(originalIcon, { x, y }, 0, 1);
            const trianglesAbove: createdTriangle[] = createBSideTriangles(originalIcon, { x, y }, 0, -1);

            let newTriangles: typeof trianglesAbove = [];
            newTriangles = newTriangles.concat(trianglesAbove).concat(trianglesBelow).concat(trianglesToTheLeft).concat(trianglesToTheRight).filter((triangleCandidate => triangleCandidate.use === true));

            newTriangles.forEach((triangleCandidate) => {
                triangleCandidatesList.push({
                    start: triangleCandidate.start,
                    end: triangleCandidate.end,
                    occupying: triangleCandidate.occupying,
                    color: centerPixelColor,
                    side: triangleCandidate.side
                })
            })
        }
    })
    console.log(triangleCandidatesList.length);
    triangleCandidatesList.forEach((triangleData) => {
        const slope = (triangleData.start.y - triangleData.end.y) / (triangleData.start.x - triangleData.end.x);
        const loopTimes = Math.abs(Math.abs(triangleData.start.x) - Math.abs(triangleData.end.x));

        let startCoordinate = ((triangleData.start.x < triangleData.end.x) ? triangleData.start : triangleData.end);
        let triangleTopBounds = Math.min(triangleData.start.y, triangleData.end.y);
        let triangleBottomBounds = Math.max(triangleData.start.y, triangleData.end.y);
        for (let triangleXIndex = 0; triangleXIndex <= loopTimes; triangleXIndex++) {
            let plotPosition = { y: (slope * triangleXIndex) + startCoordinate.y, x: triangleXIndex + startCoordinate.x};
            // heh,             y = m      * x               + b <- Look, I used it! The slope-intercept formula!!!!!
            if (triangleData.side === "below") {
                fillRect(newIcon, plotPosition.x, plotPosition.y, 1, triangleBottomBounds - plotPosition.y + 1, triangleData.color);
            } else {
                fillRect(newIcon, plotPosition.x, triangleTopBounds, 1, plotPosition.y - triangleTopBounds + 1, triangleData.color);
            }
            // fillRect(newIcon, plotPosition.x, plotPosition.y, 1, 1, triangleData.color);
        }
        // newIcon.setPixelColor(0xff0000ff, triangleData.start.x, triangleData.start.y);
        // newIcon.setPixelColor(0x00ff00ff, triangleData.end.x, triangleData.end.y);
        // newIcon.setPixelColor(0x0000ffff, triangleData.end.x, triangleData.start.y);
    })
    await newIcon.writeAsync(newImagePath);
}

function fillRect(image: Jimp, rectX: number, rectY: number, width: number, height: number, color: number) {
    image.scan(rectX, rectY, width, height, function(x, y, index) {
        image.setPixelColor(color, x, y);
    })
}

const iconModifiers = {
    baseIcon: {
        directory: '/ccicons',
        modificationFunction: async function (modifyingPath, modifyingID, modifyingIcon, data: { seed: number }) {
            // Get the path of the output of the previous modification 
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${modifyingIcon}`);
            // Create the directory path of the outcome of this modification
            const outcomePath = path.resolve(`${relativeRootDirectory}/ccicons`);
            // If the path to the directory doesn't exist, create it.
            if (!fs.pathExistsSync(outcomePath)) fs.mkdirSync(outcomePath, { recursive: true });

            // If the cube is seeded,
            if (patternedCubeIDs.find(patternedCubeID => patternedCubeID === modifyingID) !== undefined) {
                const cubeSeed = data.seed;
                // Create the outcome path of the file
                const outcomeFile = `${outcomePath}/${modifyingID}${cubeSeed}.png`;
                getSeededIconAtlas(modifyingID as CCOIcons.patternedCubeID);
                if (!fs.existsSync(outcomeFile)) {
                    let iconFile = await getSeededCubeIconType(modifyingID as CCOIcons.patternedCubeID, cubeSeed, "base");
                    await iconFile.writeAsync(outcomeFile);
                }
            } else {
                // Create the outcome path of the file
                const outcomeFile = `${outcomePath}/${modifyingID}.png`;
                // If the icon hasn't been generated yet, then generate it (in this case, it's copying it to the generated icons directory to make sure the original image isn't accidentally modified)
                if (!fs.existsSync(outcomeFile)) fs.copyFileSync(originalImagePath, outcomeFile);
            }
            // Return the directory to add to the icon generation function.
            return `/ccicons/`;
        }
    },
    contraband: {
        directory: '/contraband',
        modificationFunction: async function(modifyingPath, modifyingID, modifyingIcon, data: { seed: number }) {
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${modifyingIcon}`);
            // Create the directory path of the outcome of this modification
            const outcomePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}/contraband`);
            // Create the outcome path of the file
            const outcomeFile = `${outcomePath}/${modifyingIcon}`;
            // If the path to the directory doesn't exist, create it.
            if (!fs.pathExistsSync(outcomePath)) fs.mkdirSync(outcomePath, { recursive: true });
            // If the icon hasn't been generated yet, then generate it (in this case, it's masking the accent image with a 'contraband' image, then compositing the original image with the masked accent image.)
            if (!fs.existsSync(outcomeFile)) {
                let maskImage;
                if (patternedCubeIDs.find(patternedCubeID => patternedCubeID === modifyingID) !== undefined) {
                    maskImage = await getSeededCubeIconType(modifyingID as CCOIcons.patternedCubeID, data.seed, "accents");
                } else {
                    const customMaskImagePath = `${sourceImagesDirectory}${modifyingID}/accents.png`;
                    maskImage = await Jimp.read((!fs.existsSync(customMaskImagePath)) ? `${sourceImagesDirectory}_DEFAULT_/accents.png` : customMaskImagePath);
                }
                const baseImage = await Jimp.read(`${originalImagePath}`);
                const contrabandEffectImage = await Jimp.read(`./sourceicons/attributeeffects/contraband.png`);
                var patternRNG = new seedrandom(`${modifyingID}`);

                const cropX = Math.round(patternRNG() * (contrabandEffectImage.bitmap.width - baseImage.bitmap.width));
                const cropY = Math.round(patternRNG() * (contrabandEffectImage.bitmap.height - baseImage.bitmap.height));
                contrabandEffectImage.crop(cropX, cropY, baseImage.bitmap.width, baseImage.bitmap.height);
                contrabandEffectImage.mask(maskImage, 0, 0);
                baseImage.composite(contrabandEffectImage, 0, 0);
                await baseImage.writeAsync(outcomeFile);
            }
            return `/contraband/`;
        }
    },
    bSide: {
        directory: '/bside',
        modificationFunction: async function (modifyingPath, modifyingID, modifyingIcon, data: any) {
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${modifyingIcon}`);
            const newImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}/bside`);
            if (!fs.existsSync(newImagePath)) fs.mkdirSync(newImagePath, { recursive: true });
            const newIconPath = path.resolve(`${newImagePath}/${modifyingIcon}`);
            // if (!fs.existsSync(newIconPath)) {
                   await createBSideImage(originalImagePath, newIconPath);
            // }
            return `/bside/`;
        }
    },
    tallying: {
        directory: '/tallying',
        modificationFunction: async function (modifyingPath, modifyingID, modifyingIcon, data: {tallies: number}) {
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${modifyingIcon}`);

            return `/tallying`;
        }
    },
    divine: {
        directory: '/divine',
        modificationFunction: async function(modifyingPath, modifyingID, modifyingIcon, data: any) {
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${modifyingIcon}`);
            
            return `/divine`;
        }
    },
    slated: {
        directory: '/slated',
        modificationFunction: async function(modifyingPath, modifyingID, modifyingIcon, data: any) {
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${modifyingIcon}`);
            
            return `/slated`;
        }
    },
    prefixes: {
        directory: '/prefix',
        modificationFunction: async function (modifyingPath, modifyingID, modifyingIcon, data: { prefixes: string[], seed: number }) {
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${modifyingIcon}`);

            return `/prefix`;
        }
    },
    size: {
        directory: '/size',
        modificationFunction: async function (modifyingPath, modifyingID, modifyingIcon, data: { size: number }) {
            // Check if the size is a power of 2, within the bounds of 16-2048. If not, don't resize and don't return a new nested directory
            if (Number.isNaN(data.size) || data.size > 2048 || data.size < 16 || (Math.log(data.size) / Math.log(2)) % 1 !== 0) return '';

            // Get the path of the output of the previous modification
            const originalImagePath = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${modifyingIcon}`);

            // Sizes can be in many forms, so let's create a separate directory for each size.
            const resizeDirectory = `/sizex${data.size}/`;

            // Create the directory path of the outcome of this modification
            const outcomeDirectory = path.resolve(`${relativeRootDirectory}${modifyingPath.join('')}${resizeDirectory}`);

            // Create the outcome path of the file
            const outcomeFile = `${outcomeDirectory}/${modifyingIcon}`;

            // If the path to the directory doesn't exist, create it.
            if (!fs.pathExistsSync(outcomeDirectory)) fs.mkdirSync(outcomeDirectory, { recursive: true });

            // If the icon hasn't been generated yet, then generate it (in this case, it's simply reading the original image then resizing it.)
            if (!fs.existsSync(outcomeFile)) {
                // Read the original icon
                let cubeIcon = await Jimp.read(originalImagePath)

                // Resize the icon
                cubeIcon.resize(data.size, data.size, Jimp.RESIZE_NEAREST_NEIGHBOR)
                
                // Write the icon
                await cubeIcon.writeAsync(outcomeFile);
            }

            // Return the directory to add to the icon generation function.
            return resizeDirectory;
        }
    }
} satisfies {[key: string]: {
    directory: string,
    modificationFunction: (modifyingPath: string[], modifyingID: CCOIcons.cubeID, modifyingIcon: string, data: any) => Promise<string>
}}

interface cubeIconGenerationParameters {
    contraband: {
        use: boolean,
        data: {
            seed: number
        }
    },
    bSide: {
        use: boolean,
            data: any
    },
    divine: {
        use: boolean,
            data: any
    },
    slated: {
        use: boolean,
            data: any
    },
    prefixes: {
        use: boolean,
        data: {
            prefixes: CCOIcons.prefixID[],
            seed: number
        }
    },
    size: {
        use: boolean,
        data: {
            size: number
        }
    },
    tallying: {
        use: boolean,
        data: {
            tallies: number
        }
    }
}

async function generateCubeIcon(iconAttributes: Partial<cubeIconGenerationParameters>, cubeID: CCOIcons.cubeID, iconSeed: number): Promise<string> {
    let imageDirectories: string[] = [];
    let imageFileName = 'cube.png';
    const baseDirectory = await iconModifiers.baseIcon.modificationFunction([`/CCOIcons/sourceicons/cubes/${cubeID}/`], cubeID, imageFileName, { seed: iconSeed });
    imageFileName = `${cubeID}${(patternedCubeIDs.find(patternedCubeID => patternedCubeID === cubeID) !== undefined) ? iconSeed : ''}.png`;
    imageDirectories.push(baseDirectory);

    // These IF..ELSE statements are set up in this order to enforce the image application filter order... obviously we don't want 'b-side' to be applied after 'size' and stuff like that... it wouldn't look quite right

    if (iconAttributes.prefixes !== undefined && iconAttributes.prefixes.use === true) {
        imageDirectories.push(await iconModifiers.prefixes.modificationFunction(imageDirectories, cubeID, imageFileName, iconAttributes.prefixes.data));
    }
    
    if (iconAttributes.contraband !== undefined && iconAttributes.contraband.use === true) {
        imageDirectories.push(await iconModifiers.contraband.modificationFunction(imageDirectories, cubeID, imageFileName, iconAttributes.contraband.data));
    }
    
    if (iconAttributes.divine !== undefined && iconAttributes.divine.use === true) {
        imageDirectories.push(await iconModifiers.divine.modificationFunction(imageDirectories, cubeID, imageFileName, iconAttributes.divine.data));
    }
    
    if (iconAttributes.slated !== undefined && iconAttributes.slated.use === true) {
        imageDirectories.push(await iconModifiers.slated.modificationFunction(imageDirectories, cubeID, imageFileName, iconAttributes.slated.data));
    }

    if (iconAttributes.tallying !== undefined && iconAttributes.tallying.use === true) {
        imageDirectories.push(await iconModifiers.tallying.modificationFunction(imageDirectories, cubeID, imageFileName, iconAttributes.tallying.data));
    }

    if (iconAttributes.bSide !== undefined && iconAttributes.bSide.use === true) {
        imageDirectories.push(await iconModifiers.bSide.modificationFunction(imageDirectories, cubeID, imageFileName, iconAttributes.bSide.data));
    }

    if (iconAttributes.size !== undefined && iconAttributes.size.use === true) {
        imageDirectories.push(await iconModifiers.size.modificationFunction(imageDirectories, cubeID, imageFileName, iconAttributes.size.data));
    }
    
    return path.resolve(`${relativeRootDirectory}${imageDirectories.join('')}${imageFileName}`);
}

const route: CCOIcons.documentedRoute = {
    routes: ['/cubeicon/:cubeid/', '/cubeicon/'],
    documentation: {
        title: "Cube Icon",
        subtitle: "GETs icons for cubes, generates them if needed.",
        resolves: "image",
        author: "AspectQuote",
        description: "Blurb about icons and what this does",
        examples: [{
            name: "Large Green Cube Icon",
            example: "/cubeicon/green?s=512",
            description: "Will resolve into a 512x512 version of the Green Cube icon."
        }],
        parameterDocs: [
            {
                parameter: ':cubeid',
                name: "Cube ID",
                subtitle: "ID of any Cube",
                description: "Accepts any cube ID. Changes the requested icon to that cube ID. For example, 'green' will give the green cube icon. Similarly, 'red' will return the Red Cube's icon, so on and so forth.",
                required: false,
                requiredNote: "If no cubeid is given the server will return the 'green' cube icon.",
                examples: [
                    {
                        name: "Red Cube Icon",
                        example: "/cubeicon/red",
                        description: "Will return the icon for the red cube."
                    },
                    {
                        name: "Raccoon Cube Icon",
                        example: "/cubeicon/raccoon",
                        description: "Will return the icon for the raccoon cube."
                    }
                ]
            }
        ],
        queryDocs: [
            {
                query: 's',
                name: "Icon Size",
                subtitle: "The desired size.",
                description: "The desired size of the requested icon in pixels. Must be a power of 2, with the minimum being 16, and the maximum being 2048.",
                examples: [
                    {
                        name: "512x512 Cube Icon",
                        example: "/cubeicon?s=512",
                        description: "Will return the 'green' cubeID icon at a size of 512x512px."
                    },
                    {
                        name: "16x16 Cardboard Box Cube Icon",
                        example: "/cubeicon/cardboardbox?s=16",
                        description: "Will return the cardboard box icon at a size of 16x16px. Note: This is the smallest version of any icon you can request."
                    }
                ]
            },
            {
                query: 'c',
                name: "Contraband Attribute",
                subtitle: "Whether or not you want the contraband attribute modification to be applied.",
                description: "You don't have to include anything as part of this parameter, simply including 'c' as a query modifier in the URL is enough.",
                examples: [
                    {
                        name: "Contraband Green Cube Icon",
                        example: "/cubeicon?c",
                        description: "Will return the 'green' cubeID icon in its contraband variant."
                    },
                    {
                        name: "512x512 Contraband Red Cube Icon",
                        example: "/cubeicon/red?c&s=512",
                        description: "Will return the contraband red cube icon at a size of 512x512px. Note: 'c' is simply provided without any value in the URL."
                    }
                ]
            },
            {
                query: 'pattern',
                name: "Pattern Attribute",
                subtitle: "Request a specific pattern index from a cube.",
                description: `The pattern can be any number from 0 to ${patternIndexLimit - 1}. This only affects cubes with seeded patterns, or have a seeded prefix. Supplying a number greater than ${patternIndexLimit - 1} will simply have the modulus of ${patternIndexLimit - 1} taken from that number. Supplying a number less than 0 will simply have its absolute value taken. Supplying 'random' as the parameter will simply make the server take a random seed. NOTE: If no 'pattern' is supplied then the server will default to pattern ID 1.`,
                examples: [
                    {
                        name: "Perfect Eclipse Cube Icon",
                        example: "/cubeicon/eclipse?pattern=984",
                        description: "Will return the 984th pattern index of the eclipse cube (the 'perfect' variant)."
                    },
                    {
                        name: "512x512 Random Chalkboard Cube Icon",
                        example: "/cubeicon/chalkboard?pattern=random",
                        description: "Will return a random Chalkboard Cube icon at a size of 512x512px. Note: 'pattern' is supplied 'random' instead of a pattern index."
                    }
                ]
            }
        ]
    },
    responseFunction: async (req, res) => {
        // Set requested cube ID variable
        let requestedCubeID: CCOIcons.cubeID;
        if (cubes[req.params.cubeid as CCOIcons.cubeID] !== undefined) {
            requestedCubeID = (req.params.cubeid as CCOIcons.cubeID) ?? 'green';
        } else {
            requestedCubeID = 'green';
        }
        console.log(requestedCubeID)
        // Cube icon generation parameters storer
        const cubeIconParams: Partial<cubeIconGenerationParameters> = {};
        let cubeIconSeed = 1;
        if (Object.keys(req.query).length > 0) {
            if (typeof req.query.s === "string") { // Cube Icon Size query modifier
                cubeIconParams.size = {
                    use: true,
                    data: {
                        size: Number.parseInt(req.query.s)
                    }
                }
            }
            if (typeof req.query.pattern === "string") {
                if (req.query.pattern === "random") {
                    cubeIconSeed = Math.floor(Math.random() * 1000);
                } else {
                    let possibleIconSeed = Number.parseInt(req.query.pattern);
                    if (Number.isNaN(possibleIconSeed)) {
                        possibleIconSeed = 1; // If an unparsable pattern was given
                    }
                    if (possibleIconSeed < 0) {
                        possibleIconSeed = Math.abs(possibleIconSeed); // If the seed is less than 0, then set it to the positive version of that number.
                    }
                    if (possibleIconSeed > (patternIndexLimit - 1)) {
                        possibleIconSeed = possibleIconSeed % (patternIndexLimit - 1); // If the number is greater than the pattern limit, then just take the remainder of the number.
                    }
                    cubeIconSeed = possibleIconSeed;
                }
            }
            if (req.query.c !== undefined) {
                cubeIconParams.contraband = {
                    use: true,
                    data: {
                        seed: cubeIconSeed
                    }
                }
            }
            if (req.query.b !== undefined) {
                cubeIconParams.bSide = {
                    use: true,
                    data: {}
                }
            }
        }
        let imagePath = '';
        try {
            // Create the image (if needed) and get its path
            imagePath = await generateCubeIcon(cubeIconParams, requestedCubeID, cubeIconSeed);
        } catch (e) {
            console.log(e);
            res.status(403);
            res.send('Failed to get this image. Internal error: '+e)
        }
        // Finally, send the file.
        console.log(imagePath);
        res.sendFile(imagePath);
        return;
    }
}

export {
    route as cubeIconRoute
}