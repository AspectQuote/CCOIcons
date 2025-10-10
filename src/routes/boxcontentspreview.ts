import * as CCOIcons from './../typedefs';
import * as config from '../modules/schematics/config';
import fs from 'fs-extra';
import { generateCubeIcon  } from 'src/modules/cubeiconutils';
import { loadAnimatedCubeIcon, saveAnimatedCubeIcon } from 'src/modules/imageutils';
import Jimp from 'jimp';
import path from 'path';
import { boxID, boxSchema } from 'src/modules/schematics/boxes';
import { leastCommonMultipleOfArray } from 'src/modules/maths';
import { methods } from '@jimp/plugin-quantize';

const route: CCOIcons.documentedRoute = {
    routes: ['/boxcontentspreview/:boxid'],
    documentation: {
        title: "Box Contents Preview",
        subtitle: "GETs an image displaying the contents of a box. Warning: This takes a while to complete",
        resolves: "image",
        author: "AspectQuote",
        description: "",
        examples: [],
        parameterDocs: [],
        queryDocs: []
    },
    responseFunction: async (req, res) => {
        if (!config.devmode) return res.json({ message: "devmode must be enabled for this to function" });
        const boxID = req.params.boxid as boxID;
        if (!(boxID in boxSchema)) return res.json({ message: `BoxID '${boxID}' not found.` });
        
        const pool = structuredClone(boxSchema[boxID].contents);

        const iconPadding = 10;
        const iconsPerRow = Math.ceil(Math.sqrt(pool.length));
        const rowCount = Math.ceil(pool.length/iconsPerRow);

        const compositeFrames: Jimp[] = [];
        const cubeIcons: Jimp[][] = [];
        
        for (let poolIndex = 0; poolIndex < pool.length; poolIndex++) {
            const cubeID = pool[poolIndex];
            if (!["unrealgreen", "oddmush", "sublime", "plaguecapsule", "glacial"].includes(cubeID)) {
                cubeIcons.push(await loadAnimatedCubeIcon(await generateCubeIcon({}, cubeID, 0, false)));
            }
        }

        const neededSpacePerCube = Math.max(...cubeIcons.map(cubeFrames => cubeFrames[0].bitmap.width));
        const neededFrames = leastCommonMultipleOfArray(cubeIcons.map(cubeFrames => cubeFrames.length));

        const baseFrame = new Jimp((iconsPerRow * neededSpacePerCube) + ((iconPadding + 3) * iconsPerRow), (rowCount * neededSpacePerCube) + ((iconPadding + 3) * rowCount));

        for (let cubeIconIndex = 0; cubeIconIndex < cubeIcons.length; cubeIconIndex++) {
            const cubeIcon = cubeIcons[cubeIconIndex];
            if (cubeIcon.length === 1) {
                const columnIndex = cubeIconIndex % iconsPerRow;
                const rowIndex = Math.floor(cubeIconIndex/iconsPerRow);
                const baseXPosition = (iconPadding) + (iconPadding * columnIndex) + (neededSpacePerCube * columnIndex) + (neededSpacePerCube / 2) - (cubeIcon[0].bitmap.width / 2);
                const baseYPosition = (iconPadding) + (iconPadding * rowIndex) + (neededSpacePerCube * rowIndex) + (neededSpacePerCube / 2) - (cubeIcon[0].bitmap.height / 2);

                baseFrame.composite(cubeIcon[0], Math.round(baseXPosition), Math.round(baseYPosition));
            }
        }

        for (let frameIndex = 0; frameIndex < neededFrames; frameIndex++) {
            const newFrame = baseFrame.clone();
            for (let cubeIconIndex = 0; cubeIconIndex < cubeIcons.length; cubeIconIndex++) {
                const cubeIcon = cubeIcons[cubeIconIndex];
                if (cubeIcon.length !== 1) {
                    const cubeFrame = frameIndex % cubeIcon.length;
                    const columnIndex = cubeIconIndex % iconsPerRow;
                    const rowIndex = Math.floor(cubeIconIndex / iconsPerRow);
                    const baseXPosition = (iconPadding) + (iconPadding * columnIndex) + (neededSpacePerCube * columnIndex) + (neededSpacePerCube / 2) - (cubeIcon[0].bitmap.width / 2);
                    const baseYPosition = (iconPadding) + (iconPadding * rowIndex) + (neededSpacePerCube * rowIndex) + (neededSpacePerCube / 2) - (cubeIcon[0].bitmap.height / 2);
    
                    newFrame.composite(cubeIcon[cubeFrame], Math.round(baseXPosition), Math.round(baseYPosition));
                }
            }
            compositeFrames.push(methods.quantize(newFrame, { colors: 256 }).resize(newFrame.bitmap.width * 2, newFrame.bitmap.height * 2, Jimp.RESIZE_NEAREST_NEIGHBOR));
        }

        const outputFileName = `boxcontentpreview${boxID}.${(compositeFrames.length === 1) ? 'png' : 'gif'}`;
        const outputDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/boxcontentpreviews/`);
        if (!fs.existsSync(outputDirectory)) fs.mkdirSync(outputDirectory, { recursive: true });

        const outcome = await saveAnimatedCubeIcon(compositeFrames, outputFileName, outputDirectory, 10, false);

        if (outcome) {
            return res.sendFile(path.resolve(`${outputDirectory}/${outputFileName}`));
        } else {
            return res.json({ success: false, message: "Output image save failed." });
        }
    }
}

export {
    route as boxContentsPreview
}