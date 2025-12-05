import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import * as path from 'node:path';
import Jimp from 'jimp';
import * as fs from 'fs-extra';

import { applyImageEffect, filterID, filterIDs } from '../modules/imageeffects';

function consoleHighlight(input: string) {
    return `\x1b[33m${input}\x1b[0m`;
}

const route: CCOIcons.documentedRoute = {
    routes: ['/randomfilterfromdirectory/:filter'],
    documentation: {
        title: "Get Filtered Image",
        subtitle: "GETs custom images with the a supplied filtering algorithm applied.",
        resolves: "image",
        author: "AspectQuote",
        description: "Generates a filtered version of an image in the provided directory. The server does not search the supplied directory recursively.",
        examples: [],
        parameterDocs: [{
            parameter: ":filter",
            name: "Filter to Use",
            subtitle: "The filter to apply",
            description: "Tells the server what filter to apply to the image.",
            examples: [],
            requestBuilderPossibs: [...filterIDs],
            required: true
        }],
        queryDocs: [{
            query: 'dir',
            name: "Directory Name",
            subtitle: "The name of any directory to get images from.",
            description: "Treats this string as the path to a directory containing image files. Does not search recursively.",
            examples: [
                {
                    name: "Directory",
                    example: "/randomfilterfromdirectory/kuwahara?dir=C:",
                    description: "Will scan C:\\ for images and return a random image from that directory, filtered."
                }
            ],
            requestBuilderPossibs: []
        }]
    },
    responseFunction: async (req, res) => {
        if (!config.devmode) return res.json({ success: false, message: "Server must be in devmode." });
        if (!("dir" in req.query)) return res.json({ success: false, message: "No directory supplied." });

        console.clear();
        const dirName = req.query.dir as string;
        let filterName = req.params.filter as filterID;
        if (typeof dirName !== "string") return res.json({ success: false, message: "Failed to parse ?dir query parameter." });
        if (!fs.existsSync(dirName)) return res.json({ success: false, message: `Directory '${dirName}' does not exist.` });
        if (!filterIDs.includes(filterName)) return res.json({ success: false, message: "Invalid filter supplied." })

        try {
            const acceptableFileExtensions = ['.png', '.jpeg', '.jpg'];
            const outputFileExtension = '.png';

            const files = fs.readdirSync(dirName).filter(file => acceptableFileExtensions.some(fileExtension => file.endsWith(fileExtension))).map(item => path.resolve(`${dirName}/${item}`));
            if (files.length === 0) return res.json({ success: false, message: "Provided directory does not contain any valid files." });

            const inputFile = files[Math.floor(Math.random() * files.length)];
            console.log(`Total Files: ${files.length}`);
            const outputDirectory = `${config.relativeRootDirectory}/ccicons/customfiltericons`;
            if (!fs.existsSync(outputDirectory)) fs.mkdirSync(outputDirectory, { recursive: true });

            console.log(`\n- [${filterName} Filter] -\nFile Information:\nPath: ${consoleHighlight(inputFile)}`);
            const outputFile = path.resolve(`${outputDirectory}/${Math.floor(Math.random() * 5000)}${filterName}${path.basename(inputFile).replace(acceptableFileExtensions.find(fileExtension => inputFile.endsWith(fileExtension)) as string, outputFileExtension)}`);
            const inputImage = await Jimp.read(inputFile);
            console.log(`Dimensions (original): ${consoleHighlight(`${(inputImage.bitmap.width.toLocaleString())}px x ${(inputImage.bitmap.height.toLocaleString())}px`)}`);

            let outputImage = await applyImageEffect(inputImage, filterName, true);

            console.log(`\nOutput Information:\nFinal Dimensions: ${consoleHighlight(`${(outputImage.bitmap.width.toLocaleString())}px x ${(outputImage.bitmap.height.toLocaleString())}px`)}\nPixel Count: ${consoleHighlight(`${(outputImage.bitmap.width * outputImage.bitmap.height).toLocaleString()}px`)}`);
            console.log(`Output Directory: ${consoleHighlight(outputFile)}`);
            await outputImage.writeAsync(outputFile);
            return res.sendFile(outputFile);
        } catch (error) {
            console.log(error)
            return res.json({ success: false, message: error.stack });
        }
    }
}

export {
    route as randomKuwaharaFromDirectory
}