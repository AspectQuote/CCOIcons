import * as cubes from 'config/cubes.json';
import * as rarityConfig from 'config/rarityconfig.json';
import { RequestHandler, Application, Response } from 'express';

/**
 * Describes how a prefix is applied to a cube.
 */
export interface prefixConfig {
    /**
     * Describes the steps to take **before** the image is applied to the cube
     */
    beforeCubeImage?: prefixImageApplicationStep[]

    /**
     * Describes the steps to take **after** the image is applied to the cube
     */
    afterCubeImage?: prefixImageApplicationStep[]
}


/**
 * Prefix Image Application Step
 * - Describes how an image should be applied to a cube.
 */
export type prefixImageApplicationStep = {
    /**
     * Prefix Image Name
     * - The name of the image in the directory. Do not include the extension, animation, size, or seed properties, just the name of the file before any of that.
     */
    image: string,
    
    /**
     * Prefix Image Application Method
     * - Describes how the image should be applied to the cube (see {@link prefixApplicationMethod|prefixApplicationMethod}).
     */
    method: prefixApplicationMethod,

    /**
     * Prefix Image Position
     * - Describes where the image will have its method applied. Keep in mind this is assuming the origin of the image is the center of the image, not the top left.
     * - Note: Y position is first, then X.
     * @default ["center", "center"]
     */
    position?: [prefixApplicationYPosition, prefixApplicationYPosition]
}

/**
 * Prefix Application Method
 * - A value of **"composite"** will simply paste the {@link prefixImageApplicationStep.image|image} onto the {@link prefixImageApplicationStep.position|position} defined in the application step.
 * - A value of **"mask"** will mask the currently generated image with the current {@link prefixImageApplicationStep.image|image} at the defined {@link prefixImageApplicationStep.position|position}.
 * - A value of **"masked"** will composite the image but use the currently generated image as a mask on the {@link prefixImageApplicationStep.image|image} defined in the application step.
 */
export type prefixApplicationMethod = "composite" | "mask" | "masked";

/**
 * Prefix Application Y Position
 * - A value of **"top"** will put the image as high up as it can go without going outside of the icon.
 * - A value of **"bottom"** will put the image as low as it can go without going outside of the icon.
 * - See {@link prefixApplicationPosition} for other possible values.
 */
export type prefixApplicationYPosition = prefixApplicationPosition | "top" | "bottom";
/**
 * Prefix Application X Position
 * - A value of **"left"** will put the image as far left as it can go without going outside of the icon.
 * - A value of **"right"** will put the image as far right as it can go without going outside of the icon.
 * - See {@link prefixApplicationPosition} for other possible values.
 */
export type prefixApplicationXPosition = prefixApplicationPosition | "left" | "right";
/**
 * Prefix Application Position
 * - Describes where a prefix will be applied.
 * - A value of **"center"** will be interpreted to be the 'center' of the axis.
 * - Any **number** value will be interpreted as the % from the top left where the image will be pasted. Keep in mind the image's origin is the center of itself; [100,100] will put the image on the bottom right with the top left corner of the prefix image sticking out.
 */
export type prefixApplicationPosition = number | "center";

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