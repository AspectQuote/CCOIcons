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

const routes: CCOIcons.documentedRoute[] = [
    {
        routes: ['/cubeicon/:cubeid', '/cubeicon/'],
        documentation: {
            title: "Cube Icon",
            subtitle: "GETs icons for cubes, generates them if needed.",
            resolves: "image",
            author: "AspectQuote",
            description: "Blurb about icons and what this does",
            examples: [{
                example: "/cubeicon/green?s=512",
                description: "Will resolve into a 512x512 version of the Green Cube icon."
            }],
            parameterDocs: [
                {
                    parameter: 'cubeid',
                    name: "Cube ID", 
                    subtitle: "ID of any Cube", 
                    description: "", 
                    required: false,
                    requiredNote: "If no cubeid is given the server will default to 'green'.",
                    examples: [{
                        example: "/cubeicon/green",
                        description: "Will return the icon for the green cube."
                    }]
                }
            ],
            queryDocs: [
                {
                    query: 's',
                    name: "Icon Size",
                    subtitle: "The desired size.",
                    description: "The desired size of the returned icon in pixels. Must be a power of 2, with the minimum being 16, and the maximum being 2048.",
                    examples: [{
                        example: "/cubeicon?s=1024",
                        description: "Will return the default icon at a size of 1024x1024px."
                    }]
                }
            ]
        },
        responseFunction: (req, res) => {
            res.send('THIS IS AN ICON!?!')
        }
    }
];

routes.forEach((routeInformation) => {
    app.get(routeInformation.routes.map(routeString => `/docs${routeString}`), (req, res) => {
        res.send(documentationUtils.buildDocumentationFromRoute(routeInformation))
    })
    app.get(routeInformation.routes.map(routeString => `/docsjson${routeString}`), (req, res) => {
        res.json(routeInformation.documentation)
    })
})

app.use(express.static('./documentation'))

app.get(['/cubeicon/:cubeid/:cubeinfo', '/cubeicon/:cubeid'], async (req, res) => {
    res.send('Icon!!')
})

const expressServer = app.listen(networkPort, function () {
    console.log(`[SERVER] Listening on port ${networkPort}.`)
})