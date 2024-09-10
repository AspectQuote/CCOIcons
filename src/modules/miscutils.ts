import fs from "fs-extra";
import path from "path";

function readDirectoryRecursively(directory: fs.PathLike): string[] {
    let foundFiles: string[] = [];
    function readDirectory(directory: fs.PathLike) {
        const files = fs.readdirSync(directory);
        files.forEach(file => {
            const item = path.resolve(`${directory}/${file}`);
            if (fs.statSync(item).isDirectory()) {
                readDirectory(item);
                foundFiles.push(item);
            } else {
                foundFiles.push(item);
            }
        })
    };
    readDirectory(directory);
    return foundFiles;
}

export {
    readDirectoryRecursively
}