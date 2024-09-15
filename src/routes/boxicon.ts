import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import * as path from 'node:path';
import * as Jimp from 'jimp';
import * as fs from 'fs-extra';

import { boxID, boxSchema } from './../modules/schematics/boxes';
import { createBSideImage } from './../modules/bside';
import { loadAnimatedCubeIcon, saveAnimatedCubeIcon } from 'src/modules/imageutils';
import { generatePrefixedCube } from 'src/modules/cubeiconutils';

const outputDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/boxicons/`);

const route: CCOIcons.documentedRoute = {
    routes: ['/boxicon/', '/boxicon/:boxid'],
    documentation: {
        title: "Get Box Icon",
        subtitle: "GETs a box icon without a cube.",
        resolves: "image",
        author: "AspectQuote",
        description: "Generates a box icon if necessary, B-Side variants are also requested from this endpoint.",
        examples: [
            {
                name: "Series #10 Box Icon",
                example: "/boxicon/series10",
                description: "Will return the Series #10 box icon."
            }
        ],
        parameterDocs: [
            {
                parameter: ':boxid',
                name: "Box ID",
                subtitle: "The box to retrieve",
                description: "The ID of the box icon you want to request.",
                required: false,
                requiredNote: "The server will default to the 'series1' box ID if no box ID is given.",
                examples: [
                    {
                        name: "Series #1 Box Icon",
                        example: "/boxicon/series1",
                        description: "Will return the Series #1 box icon."
                    },
                    {
                        name: "Misfit Series Box Icon",
                        example: "/boxicon/misfit",
                        description: "Will return the Misfit Series box icon."
                    }
                ],
                requestBuilderPossibs: Object.keys(boxSchema)
            }
        ],
        queryDocs: [
            {
                query: 'bside',
                name: "B-Side Box Icon",
                subtitle: "Get the B-Side variant of the box.",
                description: `Retrieves the box's B-Side icon variant.`,
                examples: [
                    {
                        name: "B-Side Series #1 Box",
                        example: "/boxicon/series1?bside",
                        description: "Will return the Series #1 box icon's B-Side variant."
                    },
                    {
                        name: "B-Side Series #2 Box",
                        example: "/boxicon/series2?bside",
                        description: "Will return the Series #2 box icon's B-Side variant."
                    }
                ],
                requestBuilderPossibs: [1].map(() => {
                    let validArray: string[] = [];
                    while (validArray.length < config.prefixPatternIndexLimit) {
                        validArray.push(`${validArray.length}`);
                    }
                    return validArray;
                }).flat(1)
            },
            {
                query: 'size',
                name: "Box Icon Size",
                subtitle: "Resize the final box icon.",
                description: `Resizes the final box icon, must be a power of 2, up to ${config.resizeMax}. Minimum is ${config.resizeMin}.`,
                examples: [
                    {
                        name: "Enlarged Series #5 Box",
                        example: "/boxicon/series5?size=512",
                        description: "Will return the Series #5 icon resized to 512x512."
                    }, 
                    {
                        name: "Teensy Series #5 Box",
                        example: "/boxicon/series5?size=16",
                        description: "Will return the Series #5 icon resized to 16x16."
                    }
                ],
                requestBuilderPossibs: [1].map(() => {
                    let validArray: number[] = [Math.log2(config.resizeMin)];
                    while (2 ** validArray[validArray.length - 1] < config.resizeMax) {
                        validArray.push(validArray[validArray.length - 1] + 1);
                    }
                    return validArray.map(power => String(2 ** power))
                }).flat(1)
            }
        ]
    },
    responseFunction: async (req, res) => {
        const boxID = (!(req.params.boxid in boxSchema)) ? 'series1' : req.params.boxid;
        const bSide = ('bside' in req.query);
        let resize = (typeof req.query.size === "string") ? Number.parseInt(req.query.size) : false;
        if (typeof resize === 'number' && (Number.isNaN(resize) || resize > config.resizeMax || resize < config.resizeMin || (Math.log(resize) / Math.log(2)) % 1 !== 0)) resize = false;
        const iconOutput = `${outputDirectory}/${(bSide) ? 'bside/' : ''}${(typeof resize === 'number') ? `resize${resize}/` : ''}${boxID}.png`;
        if (!fs.existsSync(iconOutput) || config.devmode) {
            let icon = await Jimp.read(`${config.sourceImagesDirectory}boxes/${boxID}/box.png`);
            if (bSide) {
                icon = (await createBSideImage(icon, 2));
            }
            if (resize) {
                icon.resize(resize, resize, Jimp.RESIZE_NEAREST_NEIGHBOR);
            }
            await icon.writeAsync(iconOutput);
        }
        return res.sendFile(iconOutput);
    }
}

export {
    route as boxIconRoute
}