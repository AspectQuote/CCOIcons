import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import * as path from 'node:path';
import Jimp from 'jimp';
import { methods } from '@jimp/plugin-quantize';
import * as fs from 'fs-extra';

import { createBSideImage, prepareImageForBSideV1 } from './../modules/bside';

const route: CCOIcons.documentedRoute = {
    routes: ['/randombsidecomparisonfromdirectory/'],
    documentation: {
        title: "Get custom B-Side icon",
        subtitle: "GETs random images with the B-Side algorithm applied.",
        resolves: "image",
        author: "AspectQuote",
        description: "Generates a B-Side version of an image in the provided directory. The server does not search the supplied directory recursively.",
        examples: [],
        parameterDocs: [],
        queryDocs: [{
            query: 'dir',
            name: "Directory Name",
            subtitle: "The name of any directory to get images from.",
            description: "Treats this string as the path to a directory containing image files. Does not search recursively.",
            examples: [
                {
                    name: "Directory",
                    example: "/randombsidecomparisonfromdirectory?dir=C:\\",
                    description: "Will scan C:\\ for images and return a random image from that directory, b-side-ified."
                }
            ],
            requestBuilderPossibs: []
        }]
    },
    responseFunction: async (req, res) => {
        const colorIndices = 20;
        const resizeScale = 0.075;
        const bSideQuality = 8;
        if (!config.devmode) return res.json({ success: false, message: "Server must be in devmode." });
        const dirName = req.query.dir as string;
        if (!path.dirname) return res.json({ success: false, message: "No directory supplied." });
        if (typeof dirName !== "string") return res.json({ success: false, message: "Failed to parse ?dir query parameter." });
        if (!fs.existsSync(dirName)) return res.json({ success: false, message: `Directory '${dirName}' does not exist.` });
        try {
            const acceptableFileExtensions = ['.png', '.jpeg', '.jpg'];
            const outputFileExtension = '.png';
            const files = fs.readdirSync(dirName).filter(file => acceptableFileExtensions.some(fileExtension => file.endsWith(fileExtension))).map(item => path.resolve(`${dirName}/${item}`));
            const inputFile = files[Math.floor(Math.random() * files.length)];
            console.log(inputFile)
            const outputDirectory = `${config.relativeRootDirectory}/ccicons/custombsideicons`;
            if (!fs.existsSync(outputDirectory)) fs.mkdirSync(outputDirectory, { recursive: true });
            const outputFile = path.resolve(`${outputDirectory}/${crypto.randomUUID().slice(0, 10)}${path.basename(inputFile).replace(acceptableFileExtensions.find(fileExtension => inputFile.endsWith(fileExtension)) as string, outputFileExtension)}`);
            const inputImage = await Jimp.read(inputFile);
            const originalImage = await Jimp.read(inputFile);
            const jimpImage = prepareImageForBSideV1(inputImage, resizeScale, colorIndices);
            const bSideImage = await createBSideImage(jimpImage, bSideQuality, false, undefined, -1);
            originalImage.resize(bSideImage.bitmap.width, bSideImage.bitmap.height)
            const comparisonImage = new Jimp(bSideImage.bitmap.width * 2, bSideImage.bitmap.height, 0x00000000);
            comparisonImage.composite(bSideImage, 0, 0);
            comparisonImage.composite(originalImage, bSideImage.bitmap.width, 0);
            await comparisonImage.writeAsync(outputFile);
            return res.sendFile(outputFile);
        } catch (error) {
            console.log(error)
            return res.json({ success: false, message: error.stack });
        }
    }
}

export {
    route as randomBSideComparisonFromDirectory
}