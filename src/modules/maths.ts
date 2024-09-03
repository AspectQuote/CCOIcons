import { coordinate } from "src/typedefs";

function gcd(a: number, b: number): number { 
    return a ? gcd(b % a, a) : b
};

function lcm(a: number, b: number) {
    return a * b / gcd(a, b)
};

// Thank you StackOverflow user 'Elin Y.' for the two functions above.
// Original post: https://stackoverflow.com/questions/47047682/least-common-multiple-of-an-array-values-using-euclidean-algorithm

function leastCommonMultipleOfArray(arr: number[]) {
    return arr.reduce(lcm);
}

function distanceBetweenPoints(one: coordinate, two: coordinate) {
    return Math.sqrt(((one.x-two.x) ** 2) + ((one.y-two.y) ** 2))
}

function clampRandomHiLo(low: number, high: number, seed: number) {
    return ((high - low) * seed) + low;
}

export {
    gcd as greatestCommonDenominator,
    lcm as leastCommonMultiple,
    leastCommonMultipleOfArray,
    distanceBetweenPoints,
    clampRandomHiLo
}