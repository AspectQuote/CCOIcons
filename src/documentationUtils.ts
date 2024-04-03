import * as CCOIcons from './typedefs';
import * as fs from 'fs-extra';

const contentReplacementKeyword = `REPLACECONTENTHERE`;
const titleReplacementKeyword = `REPLACETITLEHERE`;
const baseHTMLDocument = fs.readFileSync(`./documentation/index.html`, {encoding: 'utf-8'});

function buildDocumentationFromRoute(routeInformation: CCOIcons.documentedRoute["documentation"], routeString: string): string {
    let documentHTML = `<documentationcontent :route='"${routeString}"'></documentationcontent>`;

    return baseHTMLDocument
        .replaceAll(contentReplacementKeyword, documentHTML)
        .replaceAll(titleReplacementKeyword, `CCIcon Docs: ${routeInformation.title}`);
}

export {
    buildDocumentationFromRoute
}