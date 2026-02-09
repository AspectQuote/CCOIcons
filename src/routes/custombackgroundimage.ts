import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import * as path from 'node:path';
import Jimp from 'jimp';
import * as fs from 'fs-extra';

import { applyImageEffect, filterID, filterIDs } from '../modules/imageeffects';

const blacklistedFilterEffectsForBackgrounds: filterID[] = [
    "random",
    "contrastmask",
    "contrastmaskcomparison",
    "popartfoursquare",
    "edgedetection",
    "sharpenanddither",
    "sepiaandsharpen",
    "extremesharpen",
    "brighten",
    "saturate",
    "vibrantize",
    "custom",
    "sharpen"
];

const route: CCOIcons.documentedRoute = {
    routes: ['/custombackgroundimage/:image/:filter'],
    documentation: {
        title: "Get Custom Background Image",
        subtitle: "GETs custom images with the a supplied filtering algorithm applied.",
        resolves: "image",
        author: "AspectQuote",
        description: "Generates a filtered version of an image in the provided directory. The server does not search the supplied directory recursively.",
        examples: [],
        parameterDocs: [{
            parameter: ":image",
            name: "Image to Use",
            subtitle: "The image to use",
            description: "Tells the server what image to use. files can be found in the image source directory.",
            examples: [],
            requestBuilderPossibs: [],
            required: true
        }, {
            parameter: ":filter",
            name: "Filter to Use",
            subtitle: "The filter to apply",
            description: "Tells the server what filter to apply to the image.",
            examples: [],
            requestBuilderPossibs: [...filterIDs],
            required: true
        }],
        queryDocs: []
    },
    responseFunction: async (req, res) => {
        let filterName = req.params.filter as filterID;
        let imageName = req.params.image;
        if (typeof imageName !== "string") return res.json({ success: false, message: "Failed to parse imageName parameter." });
        if (imageName.includes('.')) return res.json({ success: false, message: "Image name is invalid." });
        if (!filterIDs.includes(filterName) || blacklistedFilterEffectsForBackgrounds.includes(filterName)) return res.json({ success: false, message: "Invalid filter supplied." });
        let sourceFile = path.resolve(`${config.sourceImagesDirectory}/images/${imageName}.jpg`);
        const outputFile = path.resolve(`${config.relativeRootDirectory}/ccicons/custombackgrounds/${filterName}${imageName}1.jpg`);
        if (!fs.existsSync(outputFile) || config.devmode) {
            if (fs.existsSync(sourceFile)) {
                try {
                    const sourceFileImage = await Jimp.read(sourceFile);
                    const outputImage = await applyImageEffect(sourceFileImage, filterName, false);
                    outputImage.quality(70);
                    await outputImage.writeAsync(outputFile);
                    sourceFile = outputFile;
                } catch (e) {
                    console.log(e);
                    res.status(403);
                    return res.send('Failed to get this image. Internal error: ' + e);
                }
            } else {
                return res.send('Image was not found.');
            }
        } else {
            sourceFile = outputFile;
        }
        if (!config.devmode) res.set('Cache-Control', 'max-age=360000,must-revalidate');
        res.sendFile(sourceFile);
        return;
    }
}

export {
    route as customBackgroundImage
}