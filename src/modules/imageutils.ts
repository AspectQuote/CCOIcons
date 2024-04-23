import Jimp from 'jimp';

function rgbaFromNumberLiteral(num: number) {
    return {
        red: (num >> 24 & 255),
        green: (num >> 16 & 255),
        blue: (num >> 8 & 255),
        alpha: (num & 255),
    }
}

function fillRect(image: Jimp, rectX: number, rectY: number, width: number, height: number, color: number) {
    image.scan(rectX, rectY, width, height, function (x, y, index) {
        image.setPixelColor(color, x, y);
    })
}

export {
    fillRect,
    rgbaFromNumberLiteral
}