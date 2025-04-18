import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import * as path from 'node:path';
import Jimp from 'jimp';
import * as fs from 'fs-extra';

const outputDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/ccohoutextures/`);
const sourceDirectory = path.resolve(`${config.sourceImagesDirectory}/particles/`)

const route: CCOIcons.documentedRoute = {
    routes: ['/particlespritesheet'],
    documentation: {
        title: "Get Particle Spritesheet",
        subtitle: "GETs an image that is a composite of every particle needed, downsized.",
        resolves: "image",
        author: "AspectQuote",
        description: "Retrieves/generates an image that is a collage of every particle icon. NOTE: This endpoint is only available in devmode.",
        examples: [{
            name: "Response",
            example: "/particlespritesheet",
            description: "Will resolve into the aforementioned collage."
        }],
        parameterDocs: [],
        queryDocs: []
    },
    responseFunction: async (req, res) => {
        if (!config.devmode) return res.send("This endpoint is only accessible in devmode.")
        const desiredSize = 32;
        const outputFile = `${outputDirectory}/particles${desiredSize}.png`;
        const sheetSize = 20;
        // if (fs.existsSync(outputFile)) return res.sendFile(outputFile);
        const premadeImages = fs.readdirSync(sourceDirectory).filter(path => path.endsWith('.png')).sort((a, b) => {
            if (parseInt(a) > parseInt(b)) {
                return 1;
            }
            return -1;
        }).map(file => `${sourceDirectory}/${file}`);
        const cubeFragmentMask = await Jimp.read(`${config.sourceImagesDirectory}/misc/fragmentmask.png`);
        const cubesForFragments: CCOIcons.cubeID[] = [
            "green", "eventhorizon", "ice", "sushi", "burger", "australian", "feathered2", "brick", "black", "redgoo", "missingno", "rednebula",
            "brimstone", "crimson", "copper", "orange", "autumn", "pumpkin", "crust", "dusk", "shunned", "emerald", "greencamo", "greenbuildingblock",
            "turf", "stone3", "linksbongo", "opal2", "log", "greenchocobox", "stitched", "shoji2",
            "bluemushroom", "splatter3", "earth", "holywater", "interrobang", "sunset", "gilbert", "aspectsmodifiedgaze"
        ];
        const outputImage = new Jimp(sheetSize*desiredSize, sheetSize*desiredSize, 0x00000000);

        let spriteSheetCount = 0;
        function compositeImageToSpriteSheet(image: Jimp) {
            image.resize(desiredSize, desiredSize, Jimp.RESIZE_NEAREST_NEIGHBOR);
            const xPos = spriteSheetCount % sheetSize;
            const yPos = Math.floor(spriteSheetCount/sheetSize);
            outputImage.composite(image, xPos*desiredSize, yPos*desiredSize);
            spriteSheetCount++;
        }

        for (let premadeImageIndex = 0; premadeImageIndex < premadeImages.length; premadeImageIndex++) {
            const premadeImagePath = premadeImages[premadeImageIndex];
            const image = await Jimp.read(premadeImagePath);
            compositeImageToSpriteSheet(image);
        }

        for (let fragmentCubeIDIndex = 0; fragmentCubeIDIndex < cubesForFragments.length; fragmentCubeIDIndex++) {
            const fragmentCubeID = cubesForFragments[fragmentCubeIDIndex];
            const cubeImage = await Jimp.read(`${config.sourceImagesDirectory}/cubes/${fragmentCubeID}/cube.png`);
            const halfImageSize = Math.floor(cubeImage.bitmap.width / 2);
            compositeImageToSpriteSheet(cubeImage.clone().crop(halfImageSize, 0, halfImageSize, halfImageSize).resize(desiredSize, desiredSize, Jimp.RESIZE_NEAREST_NEIGHBOR).mask(cubeFragmentMask, 0, 0)); // Top Right
            compositeImageToSpriteSheet(cubeImage.clone().crop(halfImageSize, halfImageSize, halfImageSize, halfImageSize).resize(desiredSize, desiredSize, Jimp.RESIZE_NEAREST_NEIGHBOR).mask(cubeFragmentMask, 0, 0)); // Bottom Right
            compositeImageToSpriteSheet(cubeImage.clone().crop(0, 0, halfImageSize, halfImageSize).resize(desiredSize, desiredSize, Jimp.RESIZE_NEAREST_NEIGHBOR).mask(cubeFragmentMask, 0, 0)); // Top Left
            compositeImageToSpriteSheet(cubeImage.clone().crop(0, halfImageSize, halfImageSize, halfImageSize).resize(desiredSize, desiredSize, Jimp.RESIZE_NEAREST_NEIGHBOR).mask(cubeFragmentMask, 0, 0)); // Bottom Left
            compositeImageToSpriteSheet(cubeImage.clone()); // Entire cube
        }

        await outputImage.writeAsync(outputFile);
        return res.sendFile(outputFile);
    }
}

export {
    route as materialIconCollageRoute
}