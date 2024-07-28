import * as cubes from 'config/cubes.json';
import * as patterns from 'config/patterneditems.json';
import * as rarityConfig from 'config/rarityconfig.json';
import { prefixes } from './modules/schematics/prefixes';
import Jimp from 'jimp';
import { RequestHandler, Application, Response } from 'express';

/**
 * Coordinate, an x/y pair
 */
export type coordinate = { x: number, y: number };

/**
 * Prefix ID
 * - The ID of any particular prefix
 */
export type prefixID = keyof typeof prefixes;

/**
 * Anchor point schematic. Used as an abstraction to store each of the different anchor point types in one place.
 */
export type anchorPointSchema = {
    /**
     * Accent Pixel Coordinates
     * - Each item in the array represents a frame of the icon's animation
     */
    accents: {
        /**
         * An array of pixel coordinates that describe what pixels are accent pixels.
         */
        coordinates: coordinate[]
    }[]

    /**
     * Eye Pixel Coordinates
     */
    eyes: {
        /**
         * An array of pixel coordinates that describe what pixels are the 'eyes' of the icon.
         */
        coordinates: coordinate[]
    }[]

    /**
     * Head Positions
     */
    heads: {
        /**
         * An array of objects that describe the position and size of each 'head' on the icon.
         */
        positions: {
            /**
             * The leftmost pixel of the head.
             */
            startPosition: coordinate,

            /**
             * How wide the head is.
             */
            width: number
        }[]
    }[]

    /**
     * Mouth Positions
     * - Each item in the array represents a frame of the icon's animation
     */
    mouths: {
        /**
         * An array of objects that describe the position and size of each 'mouth' on the icon.
         */
        positions: {
            /**
             * The leftmost pixel of the mouth.
             */
            startPosition: coordinate,

            /**
             * How wide the mouth is.
             */
            width: number
        }[]
    }[]
}

export type cubeAnchorPoints = keyof anchorPointSchema;

/**
 * The definition of any particular prefix, doesn't include everything like CCO does, not all of it matters to CCOIcons.
 */
export type prefixDefinition = {
    /**
     * The name of the prefix.
     */
    name: string,

    /**
     * Which anchor points the prefix needs, this determines which 'parts' of the icon will be read and passed to the {@link prefixDefinition.compileFrames|compileFrames} property.
     */
    needs: {
        [key in cubeAnchorPoints]: boolean
    }

    /**
     * If the prefix needs a seed to function
     */
    seeded: boolean,

    /**
     * If the prefix only generates a mask, then it should be compiled after other prefixes (to account for the case that those prefixes change the icon's size)
     */
    maskOnly: boolean,

    /**
     * The function that applies the prefix to each frame of the icon, returns where the icon should be composited, and what filters Jimp should apply to the icon.
     */
    compileFrames(anchorPoints: anchorPointSchema, cubeFrames: Jimp[], seed: number): Promise<compiledPrefixFrames>
}

/**
 * What should be applied to each frame of the icon to apply the prefix.
 */
export type compiledPrefixFrames = {
    /**
     * What prefix created these frames
     */
    sourceID: prefixID

    /**
     * Where the prefix should appear in front of the cube, described per-frame.
     */
    frontFrames: {
        /**
         * Image of the prefix for this frame.
         */
        image: Jimp,

        /**
         * Where this layer should be composited. This is declared separately because prefixes can exceed the bounds of the base icon.
         */
        compositePosition: coordinate
    }[][],

    /**
     * Where the prefix should appear behind the cube, described per-frame.
     */
    backFrames: {
        /**
         * Image of the prefix for this frame.
         */
        image: Jimp,

        /**
         * Where this layer should be composited. This is declared separately because prefixes can exceeed the bounds of the base icon.
         */
        compositePosition: coordinate
    }[][],

    /**
     * What Jimp filters should be applied to the cube and prefix per-frame.
     */
    frameModifiers: JimpImgMod[][]

    /**
     * The mask frames the prefix applies
     */
    maskFrames: Jimp[]

    /**
     * What outlines should be applied to the cube and prefix per-frame.
     */
    outlineFrames: {width: number, color: number, layers: ("back" | "front" | "icon")[]}[][]
}

export type JimpImgMod = { apply: "lighten" | "brighten" | "darken" | "desaturate" | "saturate" | "greyscale" | "spin" | "hue" | "mix" | "tint" | "shade" | "xor" | "red" | "green" | "blue", params: [number] };

/**
 * The ID of any particular cube.
 */
export type cubeID = keyof typeof cubes;

/**
 * The definition of any particular cube. Does not include all cube attributes because not all of them matter to CCOIcons.
 */
export type cubeDefinition = {
    /**
     * The Author of the Cube
     * - Not entirely accurate, as authors can change their username.
     */
    author: string,

    /**
     * The Name of the Cube
     */
    name: string,

    /**
     * The Icon of the Cube
     * - A relative path from the project root to the image file.
     */
    icon: string,

    /**
     * The Description of the Cube
     * - A (usually) short bit of text that (usually) describes what the cube is.
     */
    desc: string,

    /**
     * The Rarity of the Cube
     * - Can be any {@link rarityID}. Describes how rare the cube is.
     */
    rarity: rarityID
}

/**
 * The ID of any rarity. Used to reference {@link rarityDefinition|Rarity Definitions}.
 */
export type rarityID = keyof typeof rarityConfig;

/**
 * The definition of a given rarity.
 */
export type rarityDefinition = {
    /**
     * Rarity Color
     * - A hex color string that describes what color the rarity is.
     */
    color: string,

    /**
     * Rarity Name
     * - A string naming the rarity of a particular ID.
     */
    name: string
}

/**
 * Patterned Cube ID
 * - Each of these are {@link cubeID|Cube ID}, they correspond to a {@link cubeID|Cube ID}.
 */
export type patternedCubeID = keyof typeof patterns;

/**
 * Patterned Cube Definition
 * - A configuration object for defining a cube pattern
 */
export interface patternedCubeDefinition {
    /**
     * Base Image
     * - The name of the base image file in the directory './sourceicons/seededcubetextures/{@link cubeID|cubeID}/'
     */
    baseimage: string,

    /**
     * Final Overlay
     * - The name of the overlay image file in the directory './sourceicons/seededcubetextures/{@link cubeID|cubeID}/' (this is usually the lighting of the cube)
     */
    overlayimage: string,

    /**
     * Mask Images
     * - The patterns to apply to the icon, each is applied in order.
     */
    masks: {
        /**
         * Possible Mask Images
         * - Paths to image files in the directory './sourceicons/seededcubetextures/{@link cubeID|cubeID}/' (the image is chosen at random, based on the seed.)
         */
        images: string[],

        /**
         * Pattern Image Index
         * - Index of the {@link patternedCubeDefinition.patternimages|PatternImage} image to mask using the randomized mask image
         */
        patternimage: number
    }[],

    /**
     * Pattern Image Definitions
     * - An array of pattern images and the transformations to apply to them, referenced by the 'patternimage' property in the elements of {@link patternedCubeDefinition.masks|masks}
     */
    patternimages: {
        /**
         * Pattern Image Path
         * - Path an image file in the directory './sourceicons/textures/' (don't include '.png' in the path name)
         */
        path: string,

        /**
         * Pattern Seed Rotation
         * - Whether or not to rotate the pattern image. If the image is rotated, then the server will shrink the image to cut out the whitespace in the corners.
         */
        seedrotate: boolean,

        /**
         * Pattern Seed Hue Rotation
         * - Whether or not to rotate the hue of the pattern (basically shifting all the colors of the pattern image, this is the reason that pattern images are usually monochromatic/green)
         */
        seedhuerotate: boolean,

        /**
         * Pattern Seed Scale
         * - Whether or not to scale the pattern, the 'seedscalerange' property determines how large or small it can be scaled to. (Scaling is changing the size of the patterned image before it is masked.)
         */
        seedscale: boolean,

        /**
         * Pattern Seed Scale Range
         * - How large/small to scale the pattern image, each element is the range of multipliers to scale with (0.2 is 20% size, 2 is 200% size)
         */
        seedscalerange: [number, number],

        /**
         * Pattern Seed Brightness
         * - Whether or brighten/darken the image
         */
        seedbrightness: boolean,

        /**
         * Pattern Brightness Range
         * - How much to brighten/darken image, each element is the range of multipliers to brightness with (-20 is 20% darker, 200 is 200% brighter)
         */
        seedbrightnessrange: [number, number],

        /**
         * Pattern Seed Saturation
         * - Whether or not to saturate/desaturate the image
         */
        seedsaturate: boolean,

        /**
         * Pattern Saturation Range
         * - How much to saturate the image, each element is the range of multipliers to saturate with (-20 is 20% desaturated, 200 is 200% more saturated)
         */
        seedsaturaterange: [number, number]
    }[]
}

/**
 * Describes a documented route for the server to use.
 * - Most of these properties are required, good documentation is important.
 */
export type documentedRoute = {
    /**
     * Routes for the Server to use.
     * - This is fed directly into the {@link Application.get|app.get()} method on express, and each entry is prepended with '/docs' to create the documentation route.
     */
    routes: string[],

    /**
     * Request Handler
     * - This is also fed directly into the {@link Application.get|app.get()} method on express, however, it's pretty important that a {@link Response} method is called, as this will always be the last function in the route.
     */
    responseFunction: RequestHandler,

    /**
     * Documentation Configuration
     * - Defines how the doc page will look. Most is required because good documentation is important.
     */
    documentation: {
        /**
         * Route Title
         * - What the route should be named, e.g. "Cube Icon Route" or "Cube Configuration Route".
         */
        title: string,

        /**
         * Route Subtitle
         * - A short TL;DR of what the route does, just in case a lazy person reads the docs.
         */
        subtitle: string,

        /**
         * Route Resolution Type
         * - Placed at the end of the subtitle, describes what the route resolves to. For example, an icon route would resolve an 'image'.
         */
        resolves: "json" | "image",

        /**
         * Documentation Author
         * - Placed beneath the subtitle, describes who wrote the documentation for the route. Don't mess it up, or it's on you!
         */
        author: string,

        /**
         * Description
         * - A longer explanation of what the route does. Go into detail if you must.
         */
        description: string,

        /**
         * Parameter Documentation
         * - An array of objects that describe what each parameter of the route does.
         */
        parameterDocs?: {
            /**
             * Parameter ID
             * - ID of the parameter, not the name; what's used in the route. For example, for the route "/cubeicon/:cubeid" this could be ":cubeid". 
             */
            parameter: string,

            /**
             * Parameter Name
             * - Name of the parameter, what the parameter might be used for. e.g. "Cube ID"
             */
            name: string,

            /**
             * Parameter Subtitle
             * - A short description of what this parameter does.
             */
            subtitle: string,

            /**
             * Parameter Description
             * - A longer description of what this parameter does. Detail is appreciated, but not required.
             */
            description: string,

            /**
             * Parameter Requirement
             * - Does this parameter need to be present for the route to resolve? true/false.
             */
            required: boolean,

            /**
             * Parameter Requirement Note
             * - An additional note placed next to the parameter requirement, could be used to describe what the parameter defaults to if not given.
             */
            requiredNote?: string,
            
            /**
             * Parameter Examples
             * - A collection of links that give examples on what changing the parameter does.
             */
            examples: {
                /**
                 * Example Name
                 * - A short title that conveys the basic premise of the example.
                 */
                name: string,
                /**
                 * Example Link
                 * - A relative path to the URL that shows off specific functionality. e.g. "/cubeicon/" to show off the default cube icon.
                 */
                example: string,

                /**
                 * Example Description
                 * - Explains what the example is showing off or exemplifying.
                 */
                description: string
            }[]
        }[]

        /**
         * Query Documentation
         * - An array of objects that describe what each available query modification does.
         */
        queryDocs?: {
            /**
             * Query ID
             * - The ID of the query. For example, ?s="x" would be "s"
             */
            query: string,

            /**
             * Query Name
             * - The Name of the query. For example, on "/cubeicon/" the "s" query modifier is the "Size" modifier
             */
            name: string,

            /**
             * Query Subtitle
             * - A quick explanation of what the query modifier does.
             */
            subtitle: string,

            /**
             * Query Description
             * - A longer explanation of what the query modifier does.
             */
            description: string,

            /**
             * Query Examples
             * - A collection of links that give examples on what changing this query does.
             */
            examples: {
                /**
                 * Example Name
                 * - A short title that conveys the basic premise of the example.
                 */
                name: string,

                /**
                 * Example Link
                 * - A relative path to the URL that shows off specific functionality. e.g. "/cubeicon?s=512" to show off the default cube icon, resized to 512x512.
                 */
                example: string,

                /**
                 * Example Description
                 * - Explains what the example is showing off or exemplifying.
                 */
                description: string
            }[]
        }[]
        /**
         * Route Examples
         * - Show off different combinations of Query Modifiers and Paremeters.
         */
        examples?: {
            /**
             * Example Name
             * - A short title that conveys the basic premise of the example.
             */
            name: string,

            /**
             * Route Example Link
             * - A relative link to the URL that shows off specific funcitonality.
             */
            example: string,

            /**
             * Route Example Description
             * - Describes what the link is showing off or exemplifying.
             */
            description: string
        }[]
    }
}

export type routeDocumentation = documentedRoute["documentation"];