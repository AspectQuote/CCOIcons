import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import * as path from 'node:path';
import Jimp from 'jimp';
import * as fs from 'fs-extra';

import { basicKuwaharaFilter } from 'src/modules/basickuwahara';

function consoleHighlight(input: string) {
    return `\x1b[33m${input}\x1b[0m`;
}

const route: CCOIcons.documentedRoute = {
    routes: ['/randomkuwaharafromdirectory/'],
    documentation: {
        title: "Get Kuwahara-Filtered Image",
        subtitle: "GETs custom images with the Kuwahara filtering algorithm applied.",
        resolves: "image",
        author: "AspectQuote",
        description: "Generates a filtered version of an image in the provided directory. The server does not search the supplied directory recursively.",
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
                    example: "/randomkuwaharafromdirectory?dir=C:",
                    description: "Will scan C:\\ for images and return a random image from that directory, kuwahara-ified."
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
        if (typeof dirName !== "string") return res.json({ success: false, message: "Failed to parse ?dir query parameter." });
        if (!fs.existsSync(dirName)) return res.json({ success: false, message: `Directory '${dirName}' does not exist.` });
        try {
            const acceptableFileExtensions = ['.png', '.jpeg', '.jpg'];
            const outputFileExtension = '.png';

            const files = fs.readdirSync(dirName).filter(file => acceptableFileExtensions.some(fileExtension => file.endsWith(fileExtension))).map(item => path.resolve(`${dirName}/${item}`));
            if (files.length === 0) return res.json({ success: false, message: "Provided directory does not contain any valid files." });

            const inputFile = files[Math.floor(Math.random() * files.length)];
            const outputDirectory = `${config.relativeRootDirectory}/ccicons/kuwaharaicons`;
            if (!fs.existsSync(outputDirectory)) fs.mkdirSync(outputDirectory, { recursive: true });

            const outputFile = path.resolve(`${outputDirectory}/${Math.floor(Math.random() * 5000)}${path.basename(inputFile).replace(acceptableFileExtensions.find(fileExtension => inputFile.endsWith(fileExtension)) as string, outputFileExtension)}`);
            const inputImage = await Jimp.read(inputFile);
            console.log(`\n- [Kuwahara Filter] -\nFile Information:\nPath: ${consoleHighlight(inputFile)}\nDimensions (original): ${consoleHighlight(`${(inputImage.bitmap.width.toLocaleString())}px x ${(inputImage.bitmap.height.toLocaleString())}px`)}`);

            const outputImage = await basicKuwaharaFilter(inputImage);

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