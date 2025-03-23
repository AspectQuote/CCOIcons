import { strokeMatrix } from 'src/typedefs';
import { fillRect } from './imageutils';
import Jimp from 'jimp';

/**
 * B-Side Cube Configuration
 */
const bSideConfig = {
    /**
     * Determines the scale of the B-Side resize, in pixels (1x1 Pixel from the original image = resizeSizexresizeSize Pixel for the B-Side image) NOTE: When this number is set very high, the performance of the algorithm dramatically drops.
     */
    resizeSize: 4,

    /**
     * Determines how far the algorithm can go to find pixels that are similar enough to create a triangle. Higher numbers don't effect algorithm efficiency (much), however, they can create very uncanny-looking visuals.
     */
    pixelReach: 3
}

/**
 * A base type that describes a B-Side triangle.
 */
type bSideTriangleBase = {
    /**
     * The start coordinate of the triangle, pinned to the origin pixel.
     */
    start: { x: number, y: number },
    /**
     * The end coordinate of the triangle, pushed away from the 'start' when a triangle position is validated.
     */
    end: { x: number, y: number },
    /**
     * Which side the algorithm should fill-in. Above fills all the pixels above the slope of the start/end coordinates, and below fills the pixels below.
     */
    side: "above" | "below"
}

/**
 * The rough coordinates for a triangle, instead of a 'color' attribute, a 'use' attribute is instantiated instead.
 */
interface roughTriangle extends bSideTriangleBase {
    /**
     * This attribute controls whether or not this triangle should be used. This is filtered out by the algorithm if it is set to 'false'
     */
    use: boolean
};

/**
 * A full B-Side triangle, denoted by the fact that it has the 'color' attribute.
 */
interface bSideTriangle extends bSideTriangleBase {
    /**
     * A number literal for the 'color' of this triangle, with an extra two hex bytes to denote the alpha channel. (e.g. 0xffffffff is an opaque white color, and 0x00ff00ff is an opaque green color)
     */
    color: number
}

/**
 * A B-Side color group, describes a group of pixels and triangles that are connected to each other.
 */
type bSideColorGroup = {
    /**
     * A number literal that describes what color each pixel is. (Each triangle stores its own color)
     */
    color: number,

    /**
     * The coordinates of all the pixels in this group. This is used to write the pixels back to the generated B-Side image, and to decide which groups go on top of other groups.
     */
    coordinates: { x: number, y: number }[],

    /**
     * The triangles that touch all the pixels in this group. This is used to actually write the triangles to the image.
     */
    triangles: bSideTriangle[]
}

/**
 * Get the normalized B-Side coordinates of a pixel. Feed coordinates from the original icon to here.
 * @param pixelX The Y Coordinate of the pixel
 * @param pixelY The X Coordinate of the pixel
 * @param scale The scale of the B-Side image
 * @returns An object representing each of the relevant points on a B-side pixel
 */
function getBSideCornerCoordinates(pixelX: number, pixelY: number, scale: number) {
    let topLeftOfPixel = { x: pixelX * scale, y: pixelY * scale };
    let corners = {
        topLeft: topLeftOfPixel, // Top-Left
        topRight: { x: topLeftOfPixel.x + (scale - 1), y: topLeftOfPixel.y }, // Top-Right
        bottomRight: { x: topLeftOfPixel.x + (scale - 1), y: topLeftOfPixel.y + (scale - 1) }, // Bottom-Right
        bottomLeft: { x: topLeftOfPixel.x, y: topLeftOfPixel.y + (scale - 1) },  // Bottom-Left
        center: { x: topLeftOfPixel.x + Math.floor(scale / 2), y: topLeftOfPixel.y + Math.floor(scale / 2) }
    };
    return corners;
}

/**
 * Search for triangles from a specific coordinate and image
 * @param image The image you want to find triangles from
 * @param coordinate The coordinate you want to start searching for triangles from
 * @param xAxisDirection The x increment direction you want to search in (-1 for left, 1 for right, 0 to keep the same X-Axis)
 * @param yAxisDirection The y increment direction you want to search in (-1 for up, 1 for down, 0 to keep the same Y-Axis)
 * @param scale The scale of the B-Side output image
 * @returns An array of triangles that were found, up to 2.
 */
function createBSideTriangles(image: Jimp, coordinate: { x: number, y: number }, xAxisDirection: -1 | 1 | 0, yAxisDirection: -1 | 1 | 0, scale: number, useAccurateColorComparison: boolean = false, edgeImage: Jimp): roughTriangle[] {
    const centerColor = image.getPixelColor(coordinate.x, coordinate.y);
    const centerPixelRGBA = Jimp.intToRGBA(centerColor);
    const centerBSideCoordinates = getBSideCornerCoordinates(coordinate.x, coordinate.y, scale);
    const edgesDetected: Jimp = edgeImage;
    function checkEdge(x: number, y: number) {
        if (edgesDetected.bitmap.width === 1) return -1;
        return edgesDetected.getPixelColor(x % edgesDetected.bitmap.width, y % edgesDetected.bitmap.height);
    }
    const centerEdge = checkEdge(coordinate.x, coordinate.y);
    // Each pixel from the original image is checked for triangles in one direction at a time, therefore we can assume there are at max two triangles branching from it.
    let primaryTriangle: roughTriangle = {
        start: { x: 0, y: 0 },
        end: { x: 0, y: 0 },
        side: "above",
        use: true
    }
    let secondaryTriangle: roughTriangle = {
        start: { x: 0, y: 0 },
        end: { x: 0, y: 0 },
        side: "below",
        use: true
    }

    // In order to check pixels that are adjacent on an axis (with reusable code), we just create an increment tracker that is the opposite of the passed arguments.
    let triangleCheckingDirection = {
        x: yAxisDirection,
        y: xAxisDirection
    }

    // Tracker aux variables to make sure we keep track of each triangle properly.
    let countingPrimary = true;
    let countingSecondary = true;
    let checkingPixelCoordinateChange = { x: 1 * triangleCheckingDirection.x, y: 1 * triangleCheckingDirection.y };
    // Below is a few hardcoded cases for the possible x-y incrementors. I had to do this because typescript HATES dynamic object keys. Yipee!!
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

        // Triangle that starts from the top left of the pixel /|
        primaryTriangle.start = structuredClone(centerBSideCoordinates.topLeft);
        primaryTriangle.end = structuredClone(centerBSideCoordinates.bottomLeft);
        primaryTriangle.side = "below";

        // Triangle that starts from the bottom left of the pixel \|
        secondaryTriangle.start = structuredClone(centerBSideCoordinates.bottomLeft);
        secondaryTriangle.end = structuredClone(centerBSideCoordinates.topLeft);
        secondaryTriangle.side = "above";
    } else if (yAxisDirection === 1) {
        // Checking below the center

        // Triangle that starts from the bottom right of the pixel -/
        primaryTriangle.start = structuredClone(centerBSideCoordinates.bottomRight);
        primaryTriangle.end = structuredClone(centerBSideCoordinates.bottomLeft);
        primaryTriangle.side = "above";

        // Triangle that starts from the bottom left of the pixel \-
        secondaryTriangle.start = structuredClone(centerBSideCoordinates.bottomLeft);
        secondaryTriangle.end = structuredClone(centerBSideCoordinates.bottomRight);
        secondaryTriangle.side = "above";
    } else if (yAxisDirection === -1) {
        // Checking above the center

        // Triangle that starts from the top left of the pixel /_
        primaryTriangle.start = structuredClone(centerBSideCoordinates.topLeft);
        primaryTriangle.end = structuredClone(centerBSideCoordinates.topRight);
        primaryTriangle.side = "below";

        // Triangle that starts from the top right of the pixel _\
        secondaryTriangle.start = structuredClone(centerBSideCoordinates.topRight);
        secondaryTriangle.end = structuredClone(centerBSideCoordinates.topLeft);
        secondaryTriangle.side = "below";
    }

    // Loop through the axis incrementor based on how far the pixel reach is.
    for (let axisOffset = 1; axisOffset <= bSideConfig.pixelReach; axisOffset++) {
        // Determine the offset for each direction. This means this code would work for x and y movements at the same time, if only the above cases didn't have to be hardcoded. YAY! (not that that matters anyway, I'm not really sure if there's a practical use for that.)
        const xAxisOffset = axisOffset * xAxisDirection;
        const yAxisOffset = axisOffset * yAxisDirection;
        
        // Determine the coordinate of the pixel across from the center pixel, along with its color and bitmap index
        const adjacentPixelCoordinate = { x: coordinate.x + xAxisOffset, y: coordinate.y + yAxisOffset };
        const adjacentPixelColor = image.getPixelColor(adjacentPixelCoordinate.x, adjacentPixelCoordinate.y);
        const adjacentPixelIndex = image.getPixelIndex(adjacentPixelCoordinate.x, adjacentPixelCoordinate.y);
        const adjacentPixelRGBA = Jimp.intToRGBA(adjacentPixelColor);
        const adjacentEdge = checkEdge(adjacentPixelCoordinate.x, adjacentPixelCoordinate.y);

        // If the color across is the same color as the center color, stop looping
        if (adjacentPixelColor === centerColor || (useAccurateColorComparison && deltaE([adjacentPixelRGBA.r, adjacentPixelRGBA.g, adjacentPixelRGBA.b], [centerPixelRGBA.r, centerPixelRGBA.g, centerPixelRGBA.b]) <= 20)) {
            if (axisOffset === 1) {
                // Additionaly, if it was the first loop, then don't use either triangle (they were never changed.)
                primaryTriangle.use = false;
                secondaryTriangle.use = false;
            }
            break;
        } else {
            // Determine how far to move the end pixel (This ternary here is some weird index shit. If you remove it you'll see that lines get some strange rounding errors, causing 'random' bumps! Very cool!)
            const endMovement = scale - ((axisOffset === 1) ? 1 : 0)

            // This code here is identical to the code below for the secondary pixel

            // Determine what pixel we're checking
            const primaryCheckingPixelCoordinate = { x: adjacentPixelCoordinate.x + (checkingPixelCoordinateChange.x * -1), y: adjacentPixelCoordinate.y + (checkingPixelCoordinateChange.y * -1) };
            // Determine that pixel's color
            const primaryCheckingPixelColor = image.getPixelColor(primaryCheckingPixelCoordinate.x, primaryCheckingPixelCoordinate.y);
            // Determine that pixel's bitmap index
            const primaryCheckingPixelColorIndex = image.getPixelIndex(primaryCheckingPixelCoordinate.x, primaryCheckingPixelCoordinate.y);
            // If we're still working with the primary triangle, and if the pixel is the same as the center pixel, OR, if it's attached to a transparent pixel and is on axis loop 1, and the pixel is within bounds, then we can push the triangle's end coordinate farther from the start.
            if (countingPrimary === true && ((checkEdge(primaryCheckingPixelCoordinate.x, primaryCheckingPixelCoordinate.y) === centerEdge && adjacentEdge !== centerEdge && centerEdge === 0 && axisOffset === 1) || primaryCheckingPixelColor === centerColor || ((image.bitmap.data[primaryCheckingPixelColorIndex + 3] > 0) && (image.bitmap.data[adjacentPixelIndex + 3] === 0)) && axisOffset === 1) && primaryCheckingPixelCoordinate.x < image.bitmap.width && primaryCheckingPixelCoordinate.x > 0 && primaryCheckingPixelCoordinate.y < image.bitmap.height && primaryCheckingPixelCoordinate.y > 0) {
                primaryTriangle.end.x += endMovement * xAxisDirection;
                primaryTriangle.end.y += endMovement * yAxisDirection;
            } else {
                // If not, we stop working with it.
                countingPrimary = false;
                // Additionally, if we are on loop 1, don't even use this triangle. (it wasn't changed)
                if (axisOffset === 1) primaryTriangle.use = false;
            }

            const secondaryCheckingPixelCoordinate = { x: adjacentPixelCoordinate.x + (checkingPixelCoordinateChange.x), y: adjacentPixelCoordinate.y + (checkingPixelCoordinateChange.y) };
            const secondaryCheckingPixelColor = image.getPixelColor(secondaryCheckingPixelCoordinate.x, secondaryCheckingPixelCoordinate.y);
            const secondaryCheckingPixelColorIndex = image.getPixelIndex(secondaryCheckingPixelCoordinate.x, secondaryCheckingPixelCoordinate.y);
            if (countingSecondary === true && ((checkEdge(secondaryCheckingPixelCoordinate.x, secondaryCheckingPixelCoordinate.y) === centerEdge && adjacentEdge !== centerEdge && centerEdge === 0 && axisOffset === 1) || secondaryCheckingPixelColor === centerColor || ((image.bitmap.data[secondaryCheckingPixelColorIndex + 3] > 0) && (image.bitmap.data[adjacentPixelIndex + 3] === 0)) && axisOffset === 1) && secondaryCheckingPixelCoordinate.x < image.bitmap.width && secondaryCheckingPixelCoordinate.x > 0 && secondaryCheckingPixelCoordinate.y < image.bitmap.height && secondaryCheckingPixelCoordinate.y > 0) {
                secondaryTriangle.end.x += endMovement * xAxisDirection;
                secondaryTriangle.end.y += endMovement * yAxisDirection;
            } else {
                if (axisOffset === 1) secondaryTriangle.use = false;
                countingSecondary = false;
            }
        }
        // If we aren't counting either triangle, stop looping (slight optimization)
        if (countingPrimary === false && countingSecondary === false) break;
    }
    // Put both triangles into an array, and return it.
    let outcome: roughTriangle[] = [primaryTriangle, secondaryTriangle];
    return outcome;
}

/**
 * Creates a B-Side image from an input image, returns the new image
 * @param originalJimp The Jimp image you want to be turned B-Side. This won't be modified, instead, the function will return a new image with the algorithm applied.
 * @param qualityScale How much more resolution you want to scale with the B-Side config, only really used to generate custom images with higher quality.
 * @param useAccurateColorComparison Whether or not to use accurate color comparisons when creating the triangles. Has moderate performance impact.
 * @param edgeImage An image with a black background that shows where the edges on the image are. The algorithm will use these as additions for edge detection.
 */
async function createBSideImage(originalJimp: Jimp, qualityScale: number = 1, useAccurateColorComparison: boolean = false, edgeImage: Jimp | false = false, minutia: (-1 | 1) = 1): Promise<Jimp> {
    // Read the original icon
    const originalIcon = originalJimp;

    // The pixel-bside resolution ratio
    const computedScale = bSideConfig.resizeSize * qualityScale;

    // Create the new icon, using the resize size and the original icon's size.
    const newIcon = new Jimp(originalIcon.bitmap.width * computedScale, originalIcon.bitmap.height * computedScale, 0x00000000);

    // An array of color groups, this will be sorted and used to decide which pixels/triangles go on top of what pixels/triangles.
    const colorGroups: bSideColorGroup[] = [];

    // Scan each pixel in the original image (from left to right, top to bottom)
    originalIcon.scan(0, 0, originalIcon.bitmap.width, originalIcon.bitmap.height, function (x, y, idx) {
        // This checks if the alpha value of the pixel is greater than 0. Obviously, we don't want to create triangles for invisible pixels! That would be LAME! and SLOW!
        if (originalIcon.bitmap.data[idx + 3] > 0) {
            // Determine what color the center pixel is, in number literal format.
            const centerPixelColor = originalIcon.getPixelColour(x, y);
            
            // Find a color group that this pixel belongs to.
            let colorGroupIndex = 0;
            // This search method creates some extra 'jaggy' pixels because it can include pixels that are far away, but only if they're close enough on either axis. I think this is abstract enough where a pattern won't be noticed! Maybe!
            colorGroupIndex = colorGroups.findIndex(colorGroup => colorGroup.color === centerPixelColor && colorGroup.coordinates.find(coordinate => (coordinate.x - x === -1) != (coordinate.y - y === -1)));
            if (colorGroupIndex === -1) {
                // If no group was found matching the pixel's criteria, just create a new group and change the index to the last index of all groups.
                colorGroups.push({
                    color: centerPixelColor,
                    coordinates: [{ x, y }],
                    triangles: []
                })
                colorGroupIndex = colorGroups.length - 1;
            } else {
                // If a group was found, add this pixel to that group.
                colorGroups[colorGroupIndex].coordinates.push({ x, y })
            }

            // Find the triangles related to this pixel in each direction.
            const passedEdgeImage = edgeImage ? edgeImage : new Jimp(1, 1, 0);
            const trianglesToTheRight: roughTriangle[] = createBSideTriangles(originalIcon, { x, y }, 1, 0, computedScale, useAccurateColorComparison, passedEdgeImage);
            const trianglesToTheLeft: roughTriangle[] = createBSideTriangles(originalIcon, { x, y }, -1, 0, computedScale, useAccurateColorComparison, passedEdgeImage);
            const trianglesBelow: roughTriangle[] = createBSideTriangles(originalIcon, { x, y }, 0, 1, computedScale, useAccurateColorComparison, passedEdgeImage);
            const trianglesAbove: roughTriangle[] = createBSideTriangles(originalIcon, { x, y }, 0, -1, computedScale, useAccurateColorComparison, passedEdgeImage);

            // Merge all the arrays and filter them all out based on whether they should be used or not.
            let newTriangles: typeof trianglesAbove = [];
            newTriangles = newTriangles.concat(trianglesAbove).concat(trianglesBelow).concat(trianglesToTheLeft).concat(trianglesToTheRight).filter((triangleCandidate => triangleCandidate.use === true));

            // For each of the new triangles that was found, add them to the group.
            newTriangles.forEach((triangleCandidate) => {
                colorGroups[colorGroupIndex].triangles.push({
                    start: triangleCandidate.start,
                    end: triangleCandidate.end,
                    color: centerPixelColor,
                    side: triangleCandidate.side
                })
            })
        }
    })

    // Uncomment this block to see how many triangles were found in total when requesting a B-Side icon.
    /*
    console.log(colorGroups.reduce((prev, curr) => {
        return prev + curr.triangles.length;
    }, 0))
   */

    // Sort each group by how many pixels they encompass, most goes first. This prevents small details from being hidden by the icon. This comes with the drawback that larger groups can have their shape 'changed' by having smaller groups ovewrite their edges. Not a huge deal, but can look strange on a couple cubes.
    // If you want to see what I am talking about, look at the 'orange' cube's B-Side icon and then reverse the -1 and 1 below, then clear the cached image and reload. You'll see that the pixels on the original that signify texture get reduced to absolutely tiny pinpricks because the larger group (the skin) overwrote their groups because it was ordered after.
    colorGroups.sort((a, b) => {
        if (a.coordinates.length > b.coordinates.length) {
            return -minutia
        } else {
            return minutia
        }
    }).forEach(colorGroup => {
        // This simply fills the pixel's position, basically accomplishes the same thing as resizing, but applies this pixel in the order of groups.
        colorGroup.coordinates.forEach((coordinate) => {
            const bSidePosition = getBSideCornerCoordinates(coordinate.x, coordinate.y, computedScale);
            fillRect(newIcon, bSidePosition.topLeft.x, bSidePosition.topLeft.y, computedScale, computedScale, colorGroup.color)
        })

        colorGroup.triangles.forEach((triangleData) => {
            //    m     =  y2                   - y1                  /  x2                   - x1
            const slope = (triangleData.start.y - triangleData.end.y) / (triangleData.start.x - triangleData.end.x);
            // Determine the 'Domain' of the triangle (as in the cartesian domain)
            const loopTimes = Math.abs(Math.abs(triangleData.start.x) - Math.abs(triangleData.end.x));

            // Determine where to start our graph from, which coordinate we can use to match our domain.
            let startCoordinate = ((triangleData.start.x < triangleData.end.x) ? triangleData.start : triangleData.end);

            // Determine the 'Range' of our triangle (as in the cartesian range)
            let triangleTopBounds = Math.min(triangleData.start.y, triangleData.end.y);
            let triangleBottomBounds = Math.max(triangleData.start.y, triangleData.end.y);

            for (let triangleXIndex = 0; triangleXIndex <= loopTimes; triangleXIndex++) {
                // Determine where to plot the point of the triangle, using y=mx+b
                let plotPosition = { y: (slope * triangleXIndex) + startCoordinate.y, x: triangleXIndex + startCoordinate.x };
                // heh,             y = m      * x               + b <- Look, I used it! The slope-intercept formula!!!!! (my high-school math teacher would be so proud!!!)
                if (triangleData.side === "below") {
                    // If we are filling below the line, then fill the height necessary to reach the bottom bounds.
                    fillRect(newIcon, plotPosition.x, plotPosition.y, 1, triangleBottomBounds - plotPosition.y + 1, triangleData.color);
                } else {
                    // If we are filling above the line, move the Y position the top, then fill the height necessary to reach the line. 
                    fillRect(newIcon, plotPosition.x, triangleTopBounds, 1, plotPosition.y - triangleTopBounds + 1, triangleData.color);
                }
            }
            // Uncomment the next two lines if you want to see the starting and ending points of triangles on the cube icon. It looks strange, but makes sense. I think.
            // newIcon.setPixelColor(0xff0000ff, triangleData.start.x, triangleData.start.y);
            // newIcon.setPixelColor(0x00ff00ff, triangleData.end.x, triangleData.end.y);
        })
    })

    // Return the Icon
    return newIcon;
}

async function detectEdgesOnImage(image: Jimp, scanfunc: (x: number, y: number, idx: number, edgecolor: number, matrix: strokeMatrix, source: Jimp, target: Jimp) => void = lazyEdgeDetection, background: number = 0x000000ff, edgecolor: number = 0xffffffff) {
    const edgeJimp = new Jimp(image.bitmap.width, image.bitmap.height, background);
    const edgeMatrix: strokeMatrix = [
        [0, 1, 0],
        [1, 0, 1],
        [0, 1, 0]
    ]
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
        scanfunc(x, y, idx, edgecolor, edgeMatrix, image, edgeJimp)
    });
    return edgeJimp;
}

async function lazyEdgeDetection(x: number, y: number, idx: number, edgecolor: number, matrix: strokeMatrix, source: Jimp, target: Jimp) {
    const centerPixel = source.getPixelColor(x, y);
    for (let rowIndex = 0; rowIndex < matrix.length; rowIndex++) {
        const row = matrix[rowIndex];
        let breakloop = false;
        for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
            const matrixData = row[columnIndex];
            if (matrixData === 1) {
                if (source.getPixelColor(x - 1 + rowIndex, y - 1 + columnIndex) !== centerPixel) {
                    target.setPixelColor(edgecolor, x, y);
                    breakloop = true;
                    break;
                }
            }
        }
        if (breakloop) break;
    }
}

async function slowEdgeDetection(x: number, y: number, idx: number, edgecolor: number, matrix: strokeMatrix, source: Jimp, target: Jimp) {
    const centerPixel = source.getPixelColor(x, y);
    const centerPixelRGBA = Jimp.intToRGBA(centerPixel);
    for (let rowIndex = 0; rowIndex < matrix.length; rowIndex++) {
        const row = matrix[rowIndex];
        let breakloop = false;
        for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
            const matrixData = row[columnIndex];
            if (matrixData === 1) {
                const checkingColor = Jimp.intToRGBA(source.getPixelColor(x - 1 + rowIndex, y - 1 + columnIndex));
                const colorDifference = deltaE([centerPixelRGBA.r, centerPixelRGBA.g, centerPixelRGBA.b], [checkingColor.r, checkingColor.g, checkingColor.b]);
                if (colorDifference < 0.5) {
                    target.setPixelColor(edgecolor, x, y);
                    breakloop = true;
                    break;
                }
            }
        }
        if (breakloop) break;
    }
}

// Thank you user993683 on stackoverflow for this color difference code
// https://stackoverflow.com/questions/13586999/color-difference-similarity-between-two-values-with-js
function deltaE(rgbA: [number, number, number], rgbB: [number, number, number]) {
    let labA = rgb2lab(rgbA);
    let labB = rgb2lab(rgbB);
    let deltaL = labA[0] - labB[0];
    let deltaA = labA[1] - labB[1];
    let deltaB = labA[2] - labB[2];
    let c1 = Math.sqrt(labA[1] * labA[1] + labA[2] * labA[2]);
    let c2 = Math.sqrt(labB[1] * labB[1] + labB[2] * labB[2]);
    let deltaC = c1 - c2;
    let deltaH = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC;
    deltaH = deltaH < 0 ? 0 : Math.sqrt(deltaH);
    let sc = 1.0 + 0.045 * c1;
    let sh = 1.0 + 0.015 * c1;
    let deltaLKlsl = deltaL / (1.0);
    let deltaCkcsc = deltaC / (sc);
    let deltaHkhsh = deltaH / (sh);
    let i = deltaLKlsl * deltaLKlsl + deltaCkcsc * deltaCkcsc + deltaHkhsh * deltaHkhsh;
    return i < 0 ? 0 : Math.sqrt(i);
}
function rgb2lab(rgb: [number, number, number]) {
    let r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255, x, y, z;
    r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    x = (x > 0.008856) ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
    y = (y > 0.008856) ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116;
    z = (z > 0.008856) ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116;
    return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)]
}

export {
    createBSideImage,
    detectEdgesOnImage,
    lazyEdgeDetection,
    slowEdgeDetection
}