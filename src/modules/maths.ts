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

export {
    gcd as greatestCommonDenominator,
    lcm as leastCommonMultiple,
    leastCommonMultipleOfArray
}