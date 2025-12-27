import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import path from 'path';

const filePath = path.resolve(`${config.sourceImagesDirectory}badges/badgelist.png`);
const route: CCOIcons.documentedRoute = {
    routes: ['/badgespritesheet'],
    documentation: {
        title: "Get Badge Spritesheet",
        subtitle: "GETs an image that contains each badge icon.",
        resolves: "image",
        author: "AspectQuote",
        description: "Retrieves/generates an image that is a collage of every element icon.",
        examples: [{
            name: "Response",
            example: "/badgespritesheet",
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
    route as badgeSpriteSheet
}