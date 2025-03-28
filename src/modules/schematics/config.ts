import * as CCOIcons from './../../typedefs';

const devmode = process.argv.findIndex(arg => arg === "--dev") !== -1;

/**
 * Controls how many cube pattern indices there can be, it's pretty arbitrary.
 */
const cubePatternIndexLimit = 500;

/**
 * Controls how many prefix pattern indices there can be, it's pretty arbitrary.
 */
const prefixPatternIndexLimit = 300;

/**
 * Controls how many prefixes can be displayed on a cube at once. Increasing this will GREATLY effect how many icons can be generated.
 */
const shownPrefixLimit = 2;

/**
 * The square root of the cube pattern index, this is used to generate cube pattern atlases, controls how many columns/rows there are in each atlas.
 */
const patternAtlasRoot = Math.ceil(Math.sqrt(cubePatternIndexLimit));

/**
 * How large cubes can be resized to with the ?size= URL parameter
 */
const resizeMax = (devmode) ? 2048 : 32;

/**
 * How small cubes can be resized to with the ?size= URL parameter
 */
const resizeMin = 16;

/**
 * Divine icon generation configuration object
 */
const divineConfig = {
    /**
     * How many frames are in the divine animation. Increasing this will improve the smoothness of the divine animation, but will increase the size of the files on disk, and will increase the amount of time it takes to generate a divine icon.
     */
    frames: 15,

    /**
     * What color the divine outline and spinning flashes should be
     */
    color: 0xffffffff,

    /**
     * What the name of the divine icon should be (what the filename is, e.g. divine.png, divine.gif)
     */
    iconName: `divine`,

    /**
     * How fast the divine animation is, in 10ms increments.
     */
    delayCentisecs: 0.5,

    /**
     * Whether or not to regenerate the divine animation every time the server restarts. Useful when modifying the animation.
     */
    alwaysRegenerate: false
}

/**
 * Slated icon generation configuration object
 */
const slatedConfig = {
    /**
     * How many frames are in the slated animation. Increasing this will increase how much the tendrils on the animation move, but will increase file size and how long it takes to generate a slated icon.
     */
    frames: 15,

    /**
     * The color of the slated outline and the tendrils.
     */
    color: 0x213047ff,

    /**
     * What the name of the slated icon should be (what the filename is, e.g. slated.png, slated.gif)
     */
    iconName: `slated`,

    /**
     * How fast the slated animation is, in 10ms increments.
     */
    delayCentisecs: 0.5,

    /**
     * Whether or not to regenerate the slated animation every time the server restarts. Useful when modifying the animation.
     */
    alwaysRegenerate: false
}

/**
 * Object that stores the delay overrides for certain animated cubes, some need faster/slower animations.
 */
const cubeAnimationDurationOverrides: { [key in CCOIcons.cubeID]?: number } = {
    badass: 0.1,
    millennium: 6,
    mangospolluted: 17,
    ooshersglitched: 13,
    linksboil: 14
}
function getCubeAnimationDelay(cubeID: CCOIcons.cubeID): number {
    return cubeAnimationDurationOverrides[cubeID] ?? 1;
}

/**
 * Changes where the root directory is, you can modify this if you want the icon output to be elsewhere.
 */
const relativeRootDirectory = `${__dirname}/../../../..`;

/**
 * Changes where the source image directory for cubes is, you can modify this if you want to separate your own cubes from the other ones.
 */
const sourceImagesDirectory = './sourceicons/';

/**
 * Whether or not to regenerate prefix images each time they are requested. Used for debugging and prefix programming
 */
const usePrefixImageCache = !devmode;

/**
 * Whether or not to regenerate resized images each time they are requested. Used for debugging.
 */
const useResizeCache = !devmode;

/**
 * Whether or not to regenerate B-Side images each time they are requested. Used for debugging.
 */
const useBSideCache = !devmode;

/**
 * Whether or not to retrieve cubes from source upon each request. Used for debugging.
 */
const useBaseCubeCache = !devmode;

/**
 * The limit to the amount of frames the B-Side filter can apply to for one animation, used to keep server loads down at the cost of gif loop quality
 */
const bSideAnimationLimit = 30;

/**
 * Whether or not to regenerate tallying images each time they are requested. Used for debugging.
 */
const useTallyingImageCache = !devmode;

/**
 * The maximum % of tallies that the server will generate
 */
const maxTallyPercent = 101;

/**
 * Tallies will be rendered in multiples of this number.
 */
const tallyDivisor = 25;

/**
 * The limit on .gif frames that an icon can use
 */
const maximumPrefixFramesPerIcon = (devmode) ? Infinity : 120;

console.log("DEVMODE: ", devmode)

export {
    devmode,
    cubePatternIndexLimit,
    prefixPatternIndexLimit,
    shownPrefixLimit,
    patternAtlasRoot,
    resizeMax,
    resizeMin,
    divineConfig,
    slatedConfig,
    cubeAnimationDurationOverrides,
    getCubeAnimationDelay,
    relativeRootDirectory,
    sourceImagesDirectory,
    usePrefixImageCache,
    useBaseCubeCache,
    useResizeCache,
    useBSideCache,
    useTallyingImageCache,
    maxTallyPercent,
    maximumPrefixFramesPerIcon,
    bSideAnimationLimit,
    tallyDivisor
}