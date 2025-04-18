import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import * as path from 'node:path';
import * as Jimp from 'jimp';
import * as fs from 'fs-extra';
import { methods } from '@jimp/plugin-quantize';

import { createBSideImage } from './../modules/bside';

const outputDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/custombsideicons`);
const sourceDirectory = path.resolve(`${config.sourceImagesDirectory}/images`)

const route: CCOIcons.documentedRoute = {
    routes: ['/custombsideicon/:image/'],
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
        parameterDocs: [
            {
                parameter: ':image',
                name: "Image Name",
                subtitle: "The name of any image in the custom image directory",
                description: "Treats this string as the path to a .png file on disk. You do not need to include the file extension.",
                required: true,
                requiredNote: "You need an image to get a custom b-side image, obviously.",
                examples: [
                    {
                        name: "May Icon",
                        example: "/custombsideicon/may",
                        description: "Will return the custom b-side variant of the may background image."
                    }
                ],
                requestBuilderPossibs: fs.readdirSync(sourceDirectory).map(item => item.split('.')[0])
            }
        ],
        queryDocs: []
    },
    responseFunction: async (req, res) => {
        const iconName = req.params.image;
        let imagePath: string = '';
        const sourceFile = `${sourceDirectory}/${iconName}.png`;
        const outputFile = `${outputDirectory}/${iconName}.png`;
        
        if (!fs.existsSync(outputFile) || config.devmode) {
            if (fs.existsSync(sourceFile)) {
                try {
                    // Create the image (if needed)
                    const sourceFileImage = await Jimp.read(sourceFile);
                    const outputImage = await createBSideImage(methods.quantize(sourceFileImage, {
                        colors: 22,
                        imageQuantization: "nearest",
                        paletteQuantization: "wuquant",
                        colorDistanceFormula: "manhattan"
                    }), 3);
                    await outputImage.writeAsync(outputFile);
                    imagePath = outputFile;
                } catch (e) {
                    console.log(e);
                    res.status(403);
                    return res.send('Failed to get this image. Internal error: ' + e);
                }
            } else {
                return res.send('Image was not found.');
            }
        } else {
            imagePath = outputFile;
        }
        // Finally, send the file.
        if (!config.devmode) res.set('Cache-Control', 'max-age=360000,must-revalidate');
        res.sendFile(imagePath);
        return;
    }
}

export {
    route as customBSideIconRoute
}