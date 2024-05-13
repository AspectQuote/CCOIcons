import * as CCOIcons from './../../typedefs';

const basePrefixReturnObject: CCOIcons.compiledPrefixFrames = {
    frontFrames: [],
    backFrames: [],
    frameModifiers: [],
    frameOutlines: []
};

const prefixes = {
    "Sacred": {
        name: "Sacred",
        seeded: false,
        needs: {
            heads: true,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function (anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    /*
    "Bugged": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Leafy": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Cruel": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Based": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Orbital": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Flaming": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Cursed": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Emburdening": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Cuffed": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Endangered": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Marvelous": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Phasing": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Tentacular": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Evanescent": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Royal": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Captain": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Insignificant": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "95in'": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Snowy": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Summoning": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Swarming": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Kramped": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Dandy": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Incarcerated": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Runic": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Rippling": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Emphasized": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Chained": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Angelic": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Menacing": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Serving": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Holy": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Unholy": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Contaminated": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Phosphorescent": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Neko": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Mathematical": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Wanted": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Onomatopoeiacal": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Smoked": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Basking": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Omniscient": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Sniping": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Beboppin'": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Hard-Boiled": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Angry": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Gruesome": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Outlawed": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Wranglin'": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Canoodled": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Saiyan": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Amorous": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Dazed": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Adduced": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Glitchy": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Frosty": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Cowling": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Overcast": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Berserk": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Jolly": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Partying": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Sophisticated": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Culinary": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Eudaemonic": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Magical": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Blushing": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Sweetened": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Dovey": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Batty": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Streaming": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Clapping": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Musical": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Bushy": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Stunned": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Lovey": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Trouvaille": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Googly": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Expressive": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Talkative": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Muscular": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Leggendary": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Thinking": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Boiled": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Typing": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Blind": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Cucurbitaphilic": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Radioactive": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Read": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Foggy": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Fatherly": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Pugilistic": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Censored": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Sick": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Fearful": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Drunken": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Comfortable": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Swag": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Stereoscopic": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Scientific": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Brainy": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Roped": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Brilliant": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Sparkly": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Adorable": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Hurt": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Ailurophilic": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Fake": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Glinting": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Contraband": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Voodoo": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Annoyed": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Zammin": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "RDMing": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Acquiescing": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Fuming": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "DLC": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Feminine": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Masculine": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Ornamentalized": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Raving": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Expensive": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Hyaline": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Sussy": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Sleepy": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Disgusted": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Hypnotic": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Idiotic": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Nailed": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Farmboy": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Blurry": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Obfuscating": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Inverted": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Broken": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Angery": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Despairing": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Dookied": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Grinning": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    },
    "Worthless": {
        name: "",
        seeded: false,
        needs: {
            heads: false,
            eyes: false,
            accents: false,
            mouths: false
        },
        compileFrames: function(anchorPoints, seed) {
            return structuredClone(basePrefixReturnObject)
        }
    }
    */
} satisfies { [key: string]: CCOIcons.prefixDefinition };

export {
    prefixes
}