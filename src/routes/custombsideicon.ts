import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import * as path from 'node:path';
import * as Jimp from 'jimp';
import * as fs from 'fs-extra';

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
        description: "I will write more about how this works... later.",
        examples: [{
            name: "Large Green Cube Icon",
            example: "/custombsideicon/green?size=512",
            description: "Will resolve into a 512x512 version of the Green Cube icon."
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
                        name: "Red Cube Icon",
                        example: "/custombsideicon/may",
                        description: "Will return the custom b-side variant of the may background image."
                    }
                ]
            }
        ],
        queryDocs: []
    },
    responseFunction: async (req, res) => {
        const iconName = req.params.image;
        let imagePath: string = '';
        const sourceFile = `${sourceDirectory}/${iconName}.png`;
        if (fs.existsSync(sourceFile)) {
            try {
                const outputFile = `${outputDirectory}/${iconName}.png`;
                if (!fs.existsSync(outputFile)) {
                    // Create the image (if needed)
                    const outputImage = await createBSideImage(await Jimp.read(sourceFile), 2);
                    await outputImage.writeAsync(outputFile);
                }
                imagePath = outputFile;
            } catch (e) {
                console.log(e);
                res.status(403);
                return res.send('Failed to get this image. Internal error: ' + e);
            }
        } else {
            return res.send('Image was not found.');
        }
        // Finally, send the file.
        console.log(imagePath);
        res.sendFile(imagePath);
        return;
    }
}

export {
    route as customBSideIconRoute
}