import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import * as path from 'node:path';
import Jimp from 'jimp';
import * as fs from 'fs-extra';

const outputDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/`);
const sourceDirectory = path.resolve(`${config.sourceImagesDirectory}/elements/`)

const route: CCOIcons.documentedRoute = {
    routes: ['/elementspritesheet'],
    documentation: {
        title: "Get Element Spritesheet",
        subtitle: "GETs an image that is a composite of every element icon.",
        resolves: "image",
        author: "AspectQuote",
        description: "Retrieves/generates an image that is a collage of every element icon.",
        examples: [{
            name: "Response",
            example: "/elementspritesheet",
            description: "Will resolve into the aforementioned collage."
        }],
        parameterDocs: [],
        queryDocs: []
    },
    responseFunction: async (req, res) => {
        const desiredSize = 22;
        const outputFile = `${outputDirectory}/elementspritesheet${desiredSize}.png`;
        if (fs.existsSync(outputFile) && !config.devmode) return res.sendFile(outputFile);
        const premadeImages = fs.readdirSync(sourceDirectory).filter(path => path.endsWith('.png')).sort((a, b) => {
            if (parseInt(a) > parseInt(b)) {
                return 1;
            }
            return -1;
        }).map(file => `${sourceDirectory}/${file}`);
        const sheetSize = Math.ceil(Math.sqrt(premadeImages.length));
        const outputImage = new Jimp(sheetSize * desiredSize, sheetSize * desiredSize, 0x00000000);

        let spriteSheetIndexAccumulator = 0;
        function compositeImageToSpriteSheet(image: Jimp) {
            image.resize(desiredSize, desiredSize, Jimp.RESIZE_NEAREST_NEIGHBOR);
            const xPos = spriteSheetIndexAccumulator % sheetSize;
            const yPos = Math.floor(spriteSheetIndexAccumulator / sheetSize);
            outputImage.composite(image, xPos * desiredSize, yPos * desiredSize);
            spriteSheetIndexAccumulator++;
        }

        for (let premadeImageIndex = 0; premadeImageIndex < premadeImages.length; premadeImageIndex++) {
            const premadeImagePath = premadeImages[premadeImageIndex];
            const image = await Jimp.read(premadeImagePath);
            compositeImageToSpriteSheet(image);
        }

        await outputImage.writeAsync(outputFile);
        return res.sendFile(outputFile);
    }
}

export {
    route as elementSpritesheet
}