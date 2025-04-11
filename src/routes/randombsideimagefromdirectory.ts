import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import * as path from 'node:path';
import Jimp from 'jimp';
import { methods } from '@jimp/plugin-quantize';
import * as fs from 'fs-extra';

import { createBSideImage } from './../modules/bside';

const route: CCOIcons.documentedRoute = {
    routes: ['/randombsideiconfromdirectory/'],
    documentation: {
        title: "Get custom B-Side icon",
        subtitle: "GETs custom images with the B-Side algorithm applied.",
        resolves: "image",
        author: "AspectQuote",
        description: "Generates a B-Side version of an icon in the /sourceicons/images directory. Do not supply a file extension, the server assumes the PNG extension.",
        examples: [{
            name: "Death and The Soldier",
            example: "/custombsideicon/deathandthesoldier",
            description: "Will resolve into the B-Side version of deathandthesoldier.png from /sourceicons/images."
        }],
        parameterDocs: [],
        queryDocs: [{
            query: '?dir',
            name: "Image Name",
            subtitle: "The name of any image in the custom image directory",
            description: "Treats this string as the path to a .png file on disk. You do not need to include the file extension.",
            examples: [
                {
                    name: "Directory",
                    example: "/randombsideiconfromdirectory?dir=C:",
                    description: "Will scan C:\\ for images and return a random image from that directory, b-side-ified."
                }
            ],
            requestBuilderPossibs: []
        }]
    },
    responseFunction: async (req, res) => {
        const colorIndices = 20;
        let resizeScale = 0.075;
        // let resizeScale = 0.33;
        let maxHeight = 1000 * resizeScale;
        let minHeight = maxHeight/2;
        const bSideQuality = 8;
        if (!config.devmode) return res.json({success: false, message: "Server must be in devmode."});
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
            const outputFile = path.resolve(`${outputDirectory}/${path.basename(inputFile).replace(acceptableFileExtensions.find(fileExtension => inputFile.endsWith(fileExtension)) as string, outputFileExtension)}`);
            const inputImage = await Jimp.read(inputFile);
            if (inputImage.bitmap.height * resizeScale > maxHeight) resizeScale = (maxHeight/inputImage.bitmap.height);
            if (inputImage.bitmap.height * resizeScale < minHeight) resizeScale = (minHeight/inputImage.bitmap.height);
            console.log(resizeScale)
            inputImage.resize(Math.round(inputImage.bitmap.width * resizeScale), Math.round(inputImage.bitmap.height * resizeScale), Jimp.RESIZE_BICUBIC);
            const jimpImage = methods.quantize(inputImage, {
                colors: colorIndices,
                imageQuantization: "nearest",
                paletteQuantization: "wuquant",
                colorDistanceFormula: "manhattan"
            });
            const bSideImage = await createBSideImage(jimpImage, bSideQuality, false, undefined, -1);
            await bSideImage.writeAsync(outputFile);
            return res.sendFile(outputFile);
        } catch (error) {
            console.log(error)
            return res.json({ success: false, message: error.stack });
        }
    }
}

export {
    route as randomBSideImageFromDirectory
}