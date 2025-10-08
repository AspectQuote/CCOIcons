import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import * as path from 'node:path';
import Jimp from 'jimp';
import { methods } from '@jimp/plugin-quantize';
import * as fs from 'fs-extra';

import { createBSideV2Image, generateBSideV2BlendAndInterpolationComparison, generateBSideV2InterpolationComparison, generateBSideV2TheresholdComparison, generateBSideVersionComparison, generateV2BlendComparison } from './../modules/bsidev2';
import { randomInRange } from 'src/modules/maths';

function consoleHighlight(input: string) {
    return `\x1b[33m${input}\x1b[0m`;
}

const route: CCOIcons.documentedRoute = {
    routes: ['/randombsidev2fromdirectory/'],
    documentation: {
        title: "Get custom B-Side V2 icon",
        subtitle: "GETs custom images with the second version of the B-Side algorithm applied.",
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
                    example: "/randombsidev2fromdirectory?dir=C:",
                    description: "Will scan C:\\ for images and return a random image from that directory, b-side-ified."
                }
            ],
            requestBuilderPossibs: []
        }, {
            query: "quality",
            name: "B-Side Algorithm Quality",
            subtitle: "The quality of the generated image.",
            description: "The number of times to run the image through the b-side algorithm. Higher numbers result in a higher quality image. Provide an integer above 0. Integers above 6 can take a very long time to run the algorithm through.",
            examples: [
                {
                    name: "Quality 2",
                    example: "/randombsidev2fromdirectory?dir=C:&quality=2",
                    description: "Will scan C:\\ for images and return a random image from that directory, b-side-ified at quality 2."
                }
            ],
            requestBuilderPossibs: []
        }]
    },
    responseFunction: async (req, res) => {
        if (!config.devmode) return res.json({ success: false, message: "Server must be in devmode." });
        if (!("dir" in req.query)) return res.json({ success: false, message: "No directory supplied." });

        console.clear();
        const desiredQuality = parseInt(("quality" in req.query) ? req.query.quality as string : "3");
        if (Number.isNaN(desiredQuality) || desiredQuality < 1) return res.json({ success: false, message: "The desired quality provided is not valid." });
        const dirName = req.query.dir as string;
        if (typeof dirName !== "string") return res.json({ success: false, message: "Failed to parse ?dir query parameter." });
        if (!fs.existsSync(dirName)) return res.json({ success: false, message: `Directory '${dirName}' does not exist.` });
        try {
            const acceptableFileExtensions = ['.png', '.jpeg', '.jpg'];
            const outputFileExtension = '.png';

            const files = fs.readdirSync(dirName).filter(file => acceptableFileExtensions.some(fileExtension => file.endsWith(fileExtension))).map(item => path.resolve(`${dirName}/${item}`));
            if (files.length === 0) return res.json({ success: false, message: "Provided directory does not contain any valid files." });
            
            const inputFile = files[Math.floor(Math.random() * files.length)];
            const outputDirectory = `${config.relativeRootDirectory}/ccicons/custombsideicons`;
            if (!fs.existsSync(outputDirectory)) fs.mkdirSync(outputDirectory, { recursive: true });

            const outputFile = path.resolve(`${outputDirectory}/${Math.floor(Math.random() * 5000)}${path.basename(inputFile).replace(acceptableFileExtensions.find(fileExtension => inputFile.endsWith(fileExtension)) as string, outputFileExtension)}`);
            const inputImage = await Jimp.read(inputFile);
            console.log(`\nFile Information:\nPath: ${consoleHighlight(inputFile)}\nDimensions (original): ${consoleHighlight(`${(inputImage.bitmap.width.toLocaleString())}px x ${(inputImage.bitmap.height.toLocaleString())}px`)}`);

            // const bSideImage = await generateV2BlendComparison(inputImage, desiredQuality);
            // const bSideImage = await generateBSideVersionComparison(inputImage, desiredQuality);
            // const bSideImage = await generateBSideV2TheresholdComparison(inputImage, 20, 1, 50, 4);
            // const bSideImage = await generateBSideV2InterpolationComparison(inputImage, desiredQuality);
            // const bSideImage = await generateBSideV2BlendAndInterpolationComparison(inputImage, desiredQuality - 1);
            const bSideImage = await createBSideV2Image(inputImage, 7.5, desiredQuality, "dithered");

            console.log(`\nOutput Information:\nFinal Dimensions: ${consoleHighlight(`${(bSideImage.bitmap.width.toLocaleString())}px x ${(bSideImage.bitmap.height.toLocaleString())}px`)}\nPixel Count: ${consoleHighlight(`${(bSideImage.bitmap.width * bSideImage.bitmap.height).toLocaleString()}px`)}`);
            console.log(`Output Directory: ${consoleHighlight(outputFile)}`);
            await bSideImage.writeAsync(outputFile);
            return res.sendFile(outputFile);
        } catch (error) {
            console.log(error)
            return res.json({ success: false, message: error.stack });
        }
    }
}

export {
    route as randomBSideV2FromDirectory
}