import * as CCOIcons from './../typedefs';
import { readDirectoryRecursively } from './../modules/miscutils'

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
            filePaths: readDirectoryRecursively('./../ccicons')
        };
        res.json(structure);
        return;
    }
}

export {
    route as directoryStructureRoute
}