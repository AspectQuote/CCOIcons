const boxSchema = {
    "series1": {
        "name": "Cube Series #1",
        "type": "cube"
    },
    "series2": {
        "name": "Cube Series #2",
        "type": "cube"
    },
    "series3": {
        "name": "Cube Series #3",
        "type": "cube"
    },
    "series4": {
        "name": "Cube Series #4",
        "type": "cube"
    },
    "series5": {
        "name": "Cube Series #5",
        "type": "cube"
    },
    "series6": {
        "name": "Cube Series #6",
        "type": "cube"
    },
    "series7": {
        "name": "Cube Series #7",
        "type": "cube"
    },
    "series8": {
        "name": "Cube Series #8",
        "type": "cube"
    },
    "series9": {
        "name": "Cube Series #9",
        "type": "cube"
    },
    "series10": {
        "name": "Cube Series #10",
        "type": "cube"
    },
    "series11": {
        "name": "Cube Series #11",
        "type": "cube"
    },
    "misfit": {
        "name": "Misfit Cube Series",
        "type": "cube"
    },
    "cool": {
        "name": "Cool Cube Series",
        "type": "cube"
    },
    "supporter": {
        "name": "Supporter Cube Series",
        "type": "cube"
    },
    "nitro": {
        "name": "Nitro Cube Series",
        "type": "cube"
    },
    "weirdo": {
        "name": "Weirdo Cube Series",
        "type": "specialcube"
    },
    "spring1": {
        "name": "Spring Cube Series",
        "type": "cube"
    },
    "summer1": {
        "name": "Summer Cube Series",
        "type": "cube"
    },
    "fools": {
        "name": "Fool's Series",
        "type": "cube"
    },
    "aspects": {
        "name": "Aspect's Arsenal",
        "type": "cube"
    },
    "spooky": {
        "name": "Spooky Cube Series",
        "type": "cube"
    },
    "emote": {
        "name": "Emote Cube Series",
        "type": "cube"
    },
    "community1": {
        "name": "Community Cube Collection 1",
        "type": "cube"
    },
    "community2": {
        "name": "Community Cube Collection 2",
        "type": "cube"
    },
    "sdoma": {
        "name": "Sdoma Series",
        "type": "specialcube"
    },
    "autumnal": {
        "name": "Autumnal Series",
        "type": "cube"
    },
    "christmas1": {
        "name": "Naughty and Nice Series",
        "type": "cube"
    },
    "valentines1": {
        "name": "Romantical Series",
        "type": "cube"
    },
    "discontinued": {
        "name": "Discontinued Series",
        "type": "cube"
    },
    "cataclysmic": {
        "name": "Cataclysmic Collection",
        "type": "cube"
    },
    "tarot": {
        "name": "Tarot Collection",
        "type": "cube"
    },
    "character": {
        "name": "Character Collection",
        "type": "specialcube"
    },
    "super": {
        "name": "Super Cube Series",
        "type": "cube"
    },
    "duper": {
        "name": "Duper Cube Series",
        "type": "cube"
    },
    "nolife": {
        "name": "No Life Series",
        "type": "cube"
    },
    "hazardous": {
        "name": "Hazardous Materials Box",
        "type": "cube"
    },
    "mundane": {
        "name": "Mundane Series",
        "type": "cube"
    },
    "trash": {
        "name": "Trash Collection",
        "type": "cube"
    },
    "nightmarish": {
        "name": "Nightmarish Series",
        "type": "cube"
    },
    "collectors": {
        "name": "Collector's Collection",
        "type": "cube"
    },
    "community3": {
        "name": "Community Cube Collection 3",
        "type": "cube"
    },
    "entropy": {
        "name": "Entropy Series",
        "type": "cube"
    },
    "fractal": {
        "name": "Fractal Series",
        "type": "cube"
    }
} as const satisfies {[key: string]: {name: string, type: "cube" | "specialcube"}}

type boxID = keyof typeof boxSchema;

export {
    boxID,
    boxSchema
}
