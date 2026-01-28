import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import * as path from 'node:path';
import Jimp from 'jimp';
import * as fs from 'fs-extra';

const outputDirectory = path.resolve(`${config.relativeRootDirectory}/ccicons/`);
const sourceDirectory = path.resolve(`${config.sourceImagesDirectory}/emotes/`)

const route: CCOIcons.documentedRoute = {
    routes: ['/emotespritesheet'],
    documentation: {
        title: "Get Emote Spritesheet",
        subtitle: "GETs an image that is a composite of every emote image.",
        resolves: "image",
        author: "AspectQuote",
        description: "Retrieves/generates an image that is a collage of every material icon.",
        examples: [{
            name: "Response",
            example: "/emotespritesheet",
            description: "Will resolve into the aforementioned collage."
        }],
        parameterDocs: [],
        queryDocs: []
    },
    responseFunction: async (req, res) => {
        const desiredSize = 64;
        const extraPadding = 1;
        const outputFile = `${outputDirectory}/emotespritesheet${desiredSize}-${extraPadding}.png`;
        if (fs.existsSync(outputFile) && !config.devmode) return res.sendFile(outputFile);
        const premadeImages = fs.readdirSync(sourceDirectory).filter(path => path.endsWith('.png')).sort((a, b) => {
            if (parseInt(a) > parseInt(b)) {
                return 1;
            }
            return -1;
        }).map(file => `${sourceDirectory}/${file}`);
        const sheetSize = Math.ceil(Math.sqrt(premadeImages.length));
        const outputImage = new Jimp(sheetSize * (desiredSize + (extraPadding * 2)), sheetSize * (desiredSize + (extraPadding * 2)), 0x00000000);

        let spriteSheetIndexAccumulator = 0;
        function compositeImageToSpriteSheet(image: Jimp) {
            image.resize(desiredSize, desiredSize, Jimp.RESIZE_BILINEAR);
            const xPos = spriteSheetIndexAccumulator % sheetSize;
            const yPos = Math.floor(spriteSheetIndexAccumulator / sheetSize);
            outputImage.composite(image, (xPos * (desiredSize + (extraPadding * 2))) + extraPadding, (yPos * (desiredSize + (extraPadding * 2))) + extraPadding);
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
    route as emoteSpriteSheet
}