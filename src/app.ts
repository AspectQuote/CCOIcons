import * as CCOIcons from './typedefs';
// Express doesn't have built-in types...
import * as ExpressJS from 'express';
const express = require('express');
import * as path from 'path';
import * as jimp from 'jimp';
import * as GifWrap from 'gifwrap';
import * as fs from 'fs-extra';
import * as documentationUtils from './documentationUtils';

var app: ExpressJS.Application = express();
const networkPort = process.env.PORT ?? 80;

const cubes: { [key in CCOIcons.cubeID]: CCOIcons.cubeDefinition } = fs.readJSONSync('./config/cubes.json');
const rarityConfig: { [key in CCOIcons.rarityID]: CCOIcons.rarityDefinition } = fs.readJSONSync('./config/rarityConfig.json')

import { cubeIconRoute } from './routes/cubeicon';

const routes: CCOIcons.documentedRoute[] = [
    {
        routes: ['/alldocumentation'],
        documentation: {
            title: "All Documentation",
            subtitle: "GETs all documentation JSON.",
            resolves: "json",
            author: "AspectQuote",
            description: "Blah Blah Blah, I'll write this later.",
        },
        responseFunction: (req, res) => {
            let returnObject: {[key: string]: Partial<CCOIcons.routeDocumentation>} = {};
            routes.forEach(routeInfo => {
                routeInfo.routes.forEach(routeString => {
                    returnObject[routeString] = {title: routeInfo.documentation.title};
                })
            })
            res.json(returnObject);
        }
    },
    cubeIconRoute
];

routes.forEach((routeInformation) => {
    app.get(routeInformation.routes.map(routeString => `/docs${routeString}`), (req, res) => {
        res.send(documentationUtils.buildDocumentationFromRoute(routeInformation.documentation, req.url));
    })
    app.get(routeInformation.routes.map(routeString => `/docsjson${routeString}`), (req, res) => {
        res.json(routeInformation.documentation)
    })
    app.get(routeInformation.routes, routeInformation.responseFunction);
})

app.use(express.static('./documentation'))

const expressServer = app.listen(networkPort, function () {
    console.log(`[SERVER] Listening on port ${networkPort}.`)
})