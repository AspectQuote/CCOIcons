import * as CCOIcons from './../typedefs';
import * as config from './../modules/schematics/config';
import * as path from 'node:path';
import * as Jimp from 'jimp';
import * as fs from 'fs-extra';

const route: CCOIcons.documentedRoute = {
    routes: ['/directorystructure/'],
    documentation: {
        title: "Directory Structure",
        subtitle: "GETs the directory structure of the server's generation output.",
        resolves: "json",
        author: "AspectQuote",
        description: "Generates and sends the client the directory structure of the server's copy of the icon generation output.",
        examples: [],
        parameterDocs: [],
        queryDocs: []
    },
    responseFunction: async (req, res) => {
        const structure = {
            filePaths: fs.readdirSync(path.resolve('./../ccicons'), {recursive: true}).map(item => {
                return path.resolve(`./../ccicons/${item}`);
            })
        };
        res.json(structure);
        return;
    }
}

export {
    route as directoryStructureRoute
}