import fs from "fs-extra";
import path from "path";

async function readDirectoryRecursively(directory: fs.PathLike): Promise<string[]> {
    let filesFound = 0;
    console.log(`Searching Directory: ${directory}`);
    function logProgress(foundFiles: number) {
        if (foundFiles > 0) {
            filesFound += foundFiles;
            console.log(`Found ${filesFound} files.`);
        }
    }
    async function readDirectory(directory: fs.PathLike): Promise<string[]> {
        return new Promise(async (res, rej) => {
            const files = await fs.readdir(directory);
            const proms: Promise<string[]>[] = [];
            const strs: string[] = [];
            for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
                const file = files[fileIndex];
                const item = path.resolve(`${directory}/${file}`);
                if ((await fs.stat(item)).isDirectory()) {
                    proms.push(readDirectory(item));
                    strs.push(item);
                } else {
                    strs.push(item);
                }
            }
            if (proms.length > 0) {
                Promise.all(proms).then((resolvedPromises => {
                    logProgress(resolvedPromises.length + strs.length)
                    res(resolvedPromises.flat(1).concat(strs));
                }))
            } else {
                logProgress(strs.length);
                res(strs);
            }
        })
    };
    return await readDirectory(directory);
}

function shuffle(array: any[]) {
    let currentIndex = array.length;
    while (currentIndex != 0) {
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

export {
    shuffle,
    readDirectoryRecursively
}