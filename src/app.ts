import * as CCOIcons from './typedefs';
// Express doesn't have built-in types...
import * as ExpressJS from 'express';
import express from 'express';
import * as fs from 'fs-extra';
import * as documentationUtils from './documentationUtils';
import cors from 'cors';

const app: ExpressJS.Application = express();
app.use(cors());
const networkPort = process.env.PORT ?? 80;

let totalRequests = 0;
const startTime = Date.now();

// Middleware to count all requests. Statistics are cool
app.use((req, res, next) => {
    totalRequests++;
    next();
})

import { cubeIconRoute } from './routes/cubeicon';
import { customBSideIconRoute } from './routes/custombsideicon';
import { CCOHouTextureRoute } from './routes/ccohoutexture';
import { prefixIconRoute } from './routes/prefixicon';
import { directoryStructureRoute } from './routes/directorystructure';
import { boxIconRoute } from './routes/boxicon';
import { randomBSideImageFromDirectory } from './routes/randombsideimagefromdirectory';
import { materialIconCollageRoute } from './routes/materialiconcollage';
import { randomBSideComparisonFromDirectory } from './routes/randombsidecomparisonfromdirectory';
import { randomBSideV2FromDirectory } from './routes/randombsidev2fromdirectory';
import { cubeIconBSideAlgorithmComparison } from './routes/cubeiconbsidealgorithmcomparison';
import { boxContentsPreview } from './routes/boxcontentspreview';
import { materialSpritesheet } from './routes/materialspritesheet';
import { randomKuwaharaFromDirectory } from './routes/randomkuwaharafromdirectory';

const routes: CCOIcons.documentedRoute[] = [
    {
        routes: ['/alldocumentation'],
        documentation: {
            title: "All Documentation",
            subtitle: "GETs all documentation JSON.",
            resolves: "json",
            author: "AspectQuote",
            description: "Blah Blah Blah, I'll write this later.",
            examples: [
                {
                    name: "Get all Documentation",
                    example: "/alldocumentation",
                    description: "Simply gets all the documentation data."
                }
            ]
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
    {
        routes: ['/statistics/'],
        documentation: {
            title: "CCIcons Statistics",
            subtitle: "GETs a JSON document that has some basic statistics about the site.",
            resolves: "json",
            author: "AspectQuote",
            description: "Get some bastic statistics about CCIcons. It's not that interesting, a lot of this information is/will be on the homepage.",
            examples: [{
                name: "Large Green Cube Icon",
                example: "/statistics",
                description: "Will resolve into a JSON document containing the aforementioned statistics."
            }],
            parameterDocs: [],
            queryDocs: []
        },
        responseFunction: async (req, res) => {
            let statisticsObject = {
                totalImages: 0,
                startTime,
                uptime: performance.now(),
                totalRequests
            }
            try {
                let allFiles = fs.readdirSync(`${__dirname}/../../ccicons`, { recursive: true }).filter(pathString => pathString.includes('.'));
                statisticsObject.totalImages = allFiles.length;
            } catch (error) {
                console.log(error);
            }
            res.json(statisticsObject);
            return;
        }
    },
    cubeIconRoute,
    customBSideIconRoute,
    CCOHouTextureRoute,
    prefixIconRoute,
    directoryStructureRoute,
    boxIconRoute,
    randomBSideImageFromDirectory,
    materialIconCollageRoute,
    randomBSideComparisonFromDirectory,
    randomBSideV2FromDirectory,
    cubeIconBSideAlgorithmComparison,
    boxContentsPreview,
    materialSpritesheet,
    randomKuwaharaFromDirectory
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

const expressServer = app.listen(networkPort, async function () {
    console.log(`[SERVER] Listening on port ${networkPort}.`)
})