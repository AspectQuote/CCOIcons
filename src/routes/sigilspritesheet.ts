import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import path from 'path';

const filePath = path.resolve(`${config.sourceImagesDirectory}sigils/sigils.png`);
const route: CCOIcons.documentedRoute = {
    routes: ['/sigilspritesheet'],
    documentation: {
        title: "Get Sigil Spritesheet",
        subtitle: "GETs an image that contains each sigil icon.",
        resolves: "image",
        author: "AspectQuote",
        description: "Generates an image that is a collage of every sigil icon.",
        examples: [{
            name: "Response",
            example: "/sigilspritesheet",
            description: "Will resolve into the aforementioned collage."
        }],
        parameterDocs: [],
        queryDocs: []
    },
    responseFunction: async (req, res) => {
        return res.sendFile(filePath);
    }
}

export {
    route as sigilSpriteSheet
}