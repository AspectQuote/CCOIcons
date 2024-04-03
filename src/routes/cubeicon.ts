import * as CCOIcons from './../typedefs';

const route: CCOIcons.documentedRoute = {
    routes: ['/cubeicon/:cubeid/', '/cubeicon/'],
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
                description: "The desired size of the requested icon in pixels. Must be a power of 2, with the minimum being 16, and the maximum being 2048.",
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

export {
    route as cubeIconRoute
}