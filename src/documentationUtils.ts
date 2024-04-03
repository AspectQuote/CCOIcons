import * as CCOIcons from './typedefs';
import * as fs from 'fs-extra';

const contentReplacementKeyword = `REPLACECONTENTHERE`;
const titleReplacementKeyword = `REPLACETITLEHERE`;
const baseHTMLDocument = fs.readFileSync(`./documentation/index.html`, {encoding: 'utf-8'});

function buildDocumentationFromRoute(routeInformation: CCOIcons.documentedRoute): string {
    let documentHTML = `<documentationcontent></documentationcontent>`;

    return baseHTMLDocument
        .replaceAll(contentReplacementKeyword, documentHTML)
        .replaceAll(titleReplacementKeyword, `CCOIcon Docs: ${routeInformation.documentation.title}`);
}

export {
    buildDocumentationFromRoute
}