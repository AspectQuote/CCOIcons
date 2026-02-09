import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import * as path from 'node:path';
import Jimp from 'jimp';
import * as fs from 'fs-extra';
let seedrandom: new (seed: string) => () => number = require('seedrandom');
import { applyImageEffect, filterID, filterIDs } from '../modules/imageeffects';
import { boxID, boxSchema } from 'src/modules/schematics/boxes';

const cubes: { [key in CCOIcons.cubeID]: CCOIcons.cubeDefinition } = fs.readJSONSync('./config/cubes.json');
const outputDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/boxtesselations/`);

function seededShuffle(array: any[], seed: string) {
    let currentIndex = array.length;
    const RNG = new seedrandom(seed);

    while (currentIndex != 0) {
        let randomIndex = Math.floor(RNG() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
}

const route: CCOIcons.documentedRoute = {
    routes: ['/boxcontentstesselation/:boxid'],
    documentation: {
        title: "Get Box Contents Tesselation Image",
        subtitle: "GETs a custom image that contains each of the box's cubes.",
        resolves: "image",
        author: "AspectQuote",
        description: "Generates an image containing each of the icons of the cubes inside of a provided box.",
        examples: [],
        parameterDocs: [{
            parameter: ":boxid",
            name: "Box to Use",
            subtitle: "The box whose contents you want to see",
            description: "Tells the server which box to use.",
            examples: [],
            requestBuilderPossibs: Object.keys(boxSchema),
            required: true
        }],
        queryDocs: []
    },
    responseFunction: async (req, res) => {
        const boxID: boxID = (!(req.params.boxid in boxSchema)) ? 'series1' : (req.params.boxid as boxID);
        const iconOutput = `${outputDirectory}/${boxID}.png`;
        if (!fs.existsSync(iconOutput) || config.devmode) {
            const cubeIDs = structuredClone(boxSchema[boxID].contents).filter(item => !(cubes[item].rarity === "unreal"));
            const usingCubeIcons: Jimp[] = [];
            const controlIcon = await Jimp.read(`${config.sourceImagesDirectory}/cubes/green/cube.png`);

            for (let cubeIDIndex = 0; cubeIDIndex < cubeIDs.length; cubeIDIndex++) {
                const cubeID = cubeIDs[cubeIDIndex];
                const cubeIcon = await Jimp.read(`${config.sourceImagesDirectory}/cubes/${cubeID}/cube.png`);

                let addIconToCubeIcons = (controlIcon.bitmap.width === cubeIcon.bitmap.width) && (controlIcon.bitmap.height === cubeIcon.bitmap.height);
                
                controlIcon.scan(0, 0, controlIcon.bitmap.width, controlIcon.bitmap.height, (x, y, idx) => {
                    const controlAlpha = controlIcon.bitmap.data[idx + 3];
                    if (controlAlpha !== 0) {
                        const iconAlpha = cubeIcon.bitmap.data[cubeIcon.getPixelIndex(x, y) + 3];
                        if (iconAlpha !== controlAlpha) addIconToCubeIcons = false;
                    }
                })

                if (addIconToCubeIcons) {
                    usingCubeIcons.push(cubeIcon);
                }
            }

            seededShuffle(usingCubeIcons, boxID);
            const iconSize = 32;
            let rows = Math.ceil(usingCubeIcons.length/4);
            if ((rows % 2) === 1) rows += 1;
            const columns = Math.ceil(usingCubeIcons.length/5);

            const outputIcon = new Jimp(columns * iconSize, rows * iconSize * 0.75, 0x00000000);

            for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
                const y = rowIndex;
                for (let columnIndex = 0; columnIndex < columns; columnIndex++) {
                    const x = columnIndex;
                    const cubeIconIndex = (y * columns) + x;
                    const oddRow = rowIndex % 2;
                    let xOffset = oddRow ? 0.5 : 0;
                    const cubeIcon = usingCubeIcons[cubeIconIndex % usingCubeIcons.length];
                    outputIcon.composite(cubeIcon, (x + xOffset) * iconSize, y * iconSize * 0.75);
                    if (x === (columns - 1) && oddRow) outputIcon.composite(cubeIcon, -0.5 * iconSize, y * iconSize * 0.75);
                    if (y === (rows - 1)) outputIcon.composite(cubeIcon, (x + xOffset) * iconSize, iconSize * -0.75);
                    if (x === (columns - 1) && oddRow && y === (rows - 1)) outputIcon.composite(cubeIcon, -0.5 * iconSize, iconSize * -0.75);
                }
            }

            // while (Math.floor(cubeIconIndex / outputSize) * iconSize * 0.75 < outputIcon.bitmap.height) {
            //     let x = cubeIconIndex % outputSize;
            //     let y = Math.floor(cubeIconIndex / outputSize);
            //     const oddRow = (y % 2) === 1;
            //     if (oddRow) x += 0.5;
            //     outputIcon.composite(cubeIcon, x * iconSize, y * iconSize * 0.75);
            //     if (oddRow && Math.floor((cubeIconIndex + 1) / outputSize) !== y) outputIcon.composite(cubeIcon, -0.5 * iconSize, y * iconSize * 0.75);
            //     if (((y + 1) * iconSize * 0.75) + (iconSize * 0.25) > outputIcon.bitmap.height) {
            //         outputIcon.composite(cubeIcon, x * iconSize, -0.75 * iconSize);
            //         if (oddRow && Math.floor((cubeIconIndex + 1) / outputSize) !== y) outputIcon.composite(cubeIcon, -0.5 * iconSize, -0.75 * iconSize);
            //     }
            //     cubeIconIndex++;
            // }
            
            await outputIcon.writeAsync(iconOutput);
        }
        if (!config.devmode) res.set('Cache-Control', 'max-age=36000,must-revalidate');
        return res.sendFile(iconOutput);
    }
}

export {
    route as boxContentsTesselation
}