import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import * as path from 'node:path';
import Jimp from 'jimp';
import * as fs from 'fs-extra';

const sourceDirectory = path.resolve(`${config.sourceImagesDirectory}/emotes/`)

const route: CCOIcons.documentedRoute = {
    routes: ['/emote/:emote'],
    documentation: {
        title: "Get Specific Emote",
        subtitle: "GETs a specific emote image.",
        resolves: "image",
        author: "AspectQuote",
        description: "Retrieves an image of a specified emote.",
        examples: [{
            name: "Response",
            example: "/emote/gilbert.png",
            description: "Will resolve into gilbert."
        }],
        parameterDocs: [],
        queryDocs: []
    },
    responseFunction: async (req, res) => {
        return res.sendFile(`${sourceDirectory}/${req.params.emote}`);
    }
}

export {
    route as staticEmote
}