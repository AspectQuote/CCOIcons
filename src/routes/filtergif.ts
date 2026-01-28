import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import * as path from 'node:path';
import Jimp from 'jimp';
import * as fs from 'fs-extra';

import { applyImageEffect, filterID, filterIDs } from '../modules/imageeffects';
import { saveAnimatedCubeIcon } from 'src/modules/imageutils';
import { methods } from '@jimp/plugin-quantize';

function consoleHighlight(input: string) {
    return `\x1b[33m${input}\x1b[0m`;
}

const route: CCOIcons.documentedRoute = {
    routes: ['/filtergif'],
    documentation: {
        title: "Get Filter GIF Image",
        subtitle: "GETs a custom image with a variety of different image effects applied in a gif.",
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
                    example: "/filtergif?dir=C:",
                    description: "Will scan C:\\ for images and return a random image from that directory, with many filters applied."
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

            const files = fs.readdirSync(dirName).filter(file => acceptableFileExtensions.some(fileExtension => file.endsWith(fileExtension))).map(item => path.resolve(`${dirName}/${item}`));
            if (files.length === 0) return res.json({ success: false, message: "Provided directory does not contain any valid files." });

            // const inputFile = files[Math.floor(Math.random() * files.length)];
            const inputFile = `C:/Users/joshu/Desktop/transparentpfp.png`;
            console.log(`Total Files: ${files.length}`);
            const outputDirectory = `${config.relativeRootDirectory}/ccicons/filtergifs`;
            if (!fs.existsSync(outputDirectory)) fs.mkdirSync(outputDirectory, { recursive: true });

            const filters: filterID[] = [
                "rotatedscreentone",
                "separatedgaussian",
                "fakescreentone",
                "specialscreentone",
                "kuwahara",
                "pixelsort",
                "contrastmask",
                "bside",
                "dither",
                "twotone",
                "sharpen",
                "darkenededges",
                "sepia",
                "sharpenanddither",
                "sepiaandsharpen",
                "hueshift",
                "brighten",
                "saturate",
                "vibrantize",
                "chromaticabberate",
                "crtscreen",
                "mosaic",
                "fakedither",
                "screentone"
            ];

            const fileName = `${Math.floor(Math.random() * 5000)}filtergif${path.basename(inputFile)}`.split('.')[0];
            const inputImage = await Jimp.read(inputFile);
            console.log(`Dimensions (original): ${consoleHighlight(`${(inputImage.bitmap.width.toLocaleString())}px x ${(inputImage.bitmap.height.toLocaleString())}px`)}`);

            const maxPixels = 1100 ** 2;
            if (inputImage.bitmap.width * inputImage.bitmap.height > maxPixels) {
                const scaleChange = Math.sqrt(maxPixels / (inputImage.bitmap.width * inputImage.bitmap.height));
                console.log(`\n[Filters] Scale Change Applied. Original Pixel Count: ${inputImage.bitmap.width * inputImage.bitmap.height}\nNew Pixel Count: ${inputImage.bitmap.width * scaleChange * inputImage.bitmap.height * scaleChange}`);
                inputImage.resize(Math.floor(inputImage.bitmap.width * scaleChange) - 1, Math.floor(inputImage.bitmap.height * scaleChange) - 1, Jimp.RESIZE_BICUBIC);
            }

            const images: Jimp[] = [methods.quantize(inputImage.clone(), {
                colors: 256,
                imageQuantization: "nearest",
                paletteQuantization: "wuquant",
                colorDistanceFormula: "euclidean"
            })];
            for (let filterIndex = 0; filterIndex < filters.length; filterIndex++) {
                const filterID = filters[filterIndex];
                console.log(`Doing ${filterID}`)
                const outputImage = (await applyImageEffect(inputImage.clone(), filterID, true)).resize(inputImage.bitmap.width, inputImage.bitmap.height);
                images.push(methods.quantize(outputImage, {
                    colors: 256,
                    imageQuantization: "nearest",
                    paletteQuantization: "wuquant",
                    colorDistanceFormula: "euclidean"
                }));
            }

            await saveAnimatedCubeIcon(images, fileName, outputDirectory, 10, false);
            return res.sendFile(path.resolve(`${outputDirectory}/${fileName}.gif`));
        } catch (error) {
            console.log(error)
            return res.json({ success: false, message: error.stack });
        }
    }
}

export {
    route as filterGif
}