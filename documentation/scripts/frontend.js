import * as Vue from 'vue';

console.log(Vue);

const siteURL = new URL(document.URL);

async function requestJSON(path) {
    var compurl = (path.includes('http')) ? path : ((window.location.hostname === "localhost") ? "http://" + window.location.hostname : "https://" + window.location.hostname) + path
    var comprequest = {
        method: 'GET', // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin', // include, *same-origin, omit
        headers: {
            'Content-Type': 'application/json'
            // 'Content-Type': 'application/x-www-form-urlencoded',
        },
        redirect: 'follow', // manual, *follow, error
        referrerPolicy: 'no-referrer' // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    }
    var response = await fetch(compurl, comprequest);
    if (response.redirected) {
        window.location = response.url
    }
    let responseJSON;
    if (response.status === 200) {
        responseJSON = await response.json();
    }
    return {data: responseJSON, response}
}

const siteState = Vue.reactive({
    documentation: [],
    neededLoadingFunctions: [
        async function() {
            return new Promise(async (res, rej) => {
                try {
                    let outcome = await requestJSON('/alldocumentation');
                    if (outcome.response.status === 200) {
                        console.log('Got all documentation.', outcome)
                    } else {
                        throw `Error getting documentation - Error ${outcome.response.status}: ${outcome.response.statusText}`
                    }
                    Object.keys(outcome.data).forEach(item => {
                        siteState.documentation.push({data: outcome.data[item], key: item})
                    })
                    res({ success: outcome.response.status === 200});
                } catch (e) {
                    res({ success: false, message: e})
                }
            })
        }
    ],
    finishedLoading: false,
    siteLoadingError: ""
})

const siteApp = Vue.createApp({
    data: function() {
        return {
            state: siteState
        }
    },
    mounted: async function() {
        Vue.nextTick(async () => {
            for (let loadingIndex = 0; loadingIndex < siteState.neededLoadingFunctions.length; loadingIndex++) {
                const loadedOutcome = await siteState.neededLoadingFunctions[loadingIndex]();
                if (loadedOutcome.success === true) {
                    if (loadingIndex + 1 === siteState.neededLoadingFunctions.length) {
                        siteState.finishedLoading = true;
                        console.log('Finished loading.')
                    }
                } else {
                    siteState.siteLoadingError = loadedOutcome.message;
                    break;
                }
            }
        })
    }
})

siteApp.component('loadingscreen', {
    props: ['finishedloading', 'siteloadingerror'],
    computed: {
        loadingScreenCSS: function() {
            const styles = {
                "opacity": "1",
                "pointer-events": "all"
            }

            if (this.finishedloading) {
                styles.opacity = "0";
                styles['pointer-events'] = "none";
            }

            return styles;
        }
    },
    template: `<div class='loadingscreencoverup' :style='loadingScreenCSS'>
        <div class='loadingscreenflavor' v-if='false'>Loading...</div>
        <div class='loadingscreenerror' v-if='siteloadingerror.length > 0'>An error occurred!<br/>{{siteloadingerror}}<br/>Try reloading the page. If this error persists, FUCK.</div>
    </div>`
})

siteApp.component('sitesidebar', {
    props: ['endpoints'],
    template: `<div class='sitesidebar'>
        <div class='sidebartitle'>Documentation Index</div>
        <div class='sidebarcontent'>
            <div class='sidebardocitem' v-for='endpoint in endpoints'>
                <div class='sidebardoclinktitle'><a class='sidebardoclink' :href='"/docs"+endpoint.key'>{{endpoint.key}}</a></div>
                <div class='sidebardoclinksubtitle'>{{endpoint.data.title}}</div>
            </div>
        </div>
    </div>`
})

siteApp.component('documentationcontent', {
    props: ["route"],
    data: function() {
        return {
            docData: {},
            loadedDocumentation: false,
            failedToLoadDocumentation: false
        }
    },
    mounted: async function() {
        try {
            let outcome = await requestJSON(this.route.replace("/docs/", "/docsjson/"));
            if (outcome.response.status !== 200) {
                throw `Error getting documentation - Error ${outcome.response.status}: ${outcome.response.statusText}`
            }
            this.docData = outcome.data;
            Vue.nextTick(() => {
                this.loadedDocumentation = true;
            })
        } catch (e) {
            console.log(e);
            this.failedToLoadDocumentation = true;
        }
    },
    template: `<div class='documentationcontainer'>
        <div class='failedtoloaddocsmessage' v-if='failedToLoadDocumentation'>Failed to load Documentation Info.<br/>Please refresh.<br/>If this error persists, FUCK.</div>
        <div class='documentationwrapper' v-else-if='loadedDocumentation'>
            <div class='doctitle'>{{docData.title}} - <span class='doctitleendpoint'>{{route.replace("/docs", "")}}</span></div>
            <div class='docsubtitle'>{{docData.subtitle}} <span class='docsubtitleresolution'>{{docData.resolves}}</span></div>
            <div class='doccontent'>{{docData.description}}<span class='docdescriptionauthor'>- Written By {{docData.author}}</span></div>
            <div v-if='docData.parameterDocs' class='documentationrequestmodifiertitle'>Endpoint Parameters</div>
            <parametersdocumentation v-if='docData.parameterDocs' :parameters='docData.parameterDocs' :resolutiontype='docData.resolves'></parametersdocumentation>
            <div class='documentationrequestmodifiertitle' v-if='docData.queryDocs'>Endpoint Query Modifiers</div>
            <querymodifiersdocumentation v-if='docData.queryDocs' :querymods='docData.queryDocs' :resolutiontype='docData.resolves'></querymodifiersdocumentation>
            <div class='documentationrequestmodifiertitle'>Request Examples</div>
            <requestmodifierexample v-for='example in docData.examples' :exampledata='example' :resolutiontype='docData.resolves'></requestmodifierexample>
            <div class='documentationrequestmodifiertitle'>Request Builder</div>
        </div>
        <div class='documentationloading' v-else>Loading Documentation...</div>
    </div>`
})

siteApp.component('fancybutton', {
    props: ['icon'],
    computed: {
        style: function() {
            const baseStyleObject = {
                "background-position": "0 0"
            }

            const iconPositionIncrementor = (52/576) * 100

            const iconStyles = {
                "copy": {
                    "background-position": "0 0"
                },
                "open": {
                    "background-position": `${iconPositionIncrementor * 1}% 0`
                },
                "refresh": {
                    "background-position": `${iconPositionIncrementor * 2}% 0`
                }
            }

            if (iconStyles[this.icon]) {
                Object.assign(baseStyleObject, iconStyles[this.icon]);
            }

            return baseStyleObject;
        }
    },
    template: `<div class='custombutton' :style='style'></div>`
})

siteApp.component('requestpreview', {
    props: ['url', 'expectedrequesttype'],
    data: function() {
        return {
            refreshing: true,
            imageProperties: {
                width: 0,
                height: 0,
                size: "0 Bytes",
                show: true
            },
            jsonProperties: {
                jsonObject: {},
                size: "0 Bytes"
            }
        }
    },
    methods: {
        imgload: function() {
            this.refreshImageProperties();
        },
        refreshImageProperties: async function() {
            return new Promise(async (res, rej) => {
                const imageFileSize = await new Promise((res, rej) => {
                    // This code was mostly written by Christian on StackOverflow at https://stackoverflow.com/questions/1310378/determining-image-file-size-dimensions-via-javascript
                    var xhr = new XMLHttpRequest();
                    xhr.open('HEAD', this.url, true);
                    xhr.onreadystatechange = function () {
                        if (xhr.readyState == 4) {
                            if (xhr.status == 200) {
                                res(xhr.getResponseHeader('Content-Length'));
                            } else {
                                res(0);
                            }
                        }
                    };
                    xhr.send(null);
                })
                this.imageProperties.size = this.getReadableBytes(imageFileSize);
                let image = (this.$refs.previewimage);
                this.imageProperties.height = image.naturalHeight;
                this.imageProperties.width = image.naturalWidth;
                this.refreshing = false;
            })
        },
        getReadableBytes: function(number) {
            if (number > 1000000) {
                return `~${(number / 1000000).toFixed(2)}MB`
            } else if (number > 1000) {
                return `~${(number / 1000).toFixed(2)}KB`
            } else {
                return `~${number} Bytes`
            }
        },
        getTheJSON: async function() {
            return new Promise(async (res, rej) => {
                const json = await requestJSON(this.url);
                const jsonString = JSON.stringify(json.data);
                this.jsonProperties.jsonObject = json.data;
                const jsonSize = new Blob([jsonString]).size;
                this.jsonProperties.size = this.getReadableBytes(jsonSize);
                this.refreshing = false;
                res(true);
            })
        },
        refresh: async function() {
            if (this.refreshing) return;
            this.refreshing = true;
            console.log(this.refreshing,this.$data)
            if (this.expectedrequesttype === "json") {
                await this.getTheJSON();
            } else if (this.expectedrequesttype === "image") {
                this.imageProperties.show = false;
                Vue.nextTick(async () => {
                    this.imageProperties.show = true;
                    await this.refreshImageProperties();
                })
            } else {
                console.warn(`Cannot refresh request type '${this.expectedrequesttype}'`)
            }
        }
    },
    mounted: function() {
        if (this.expectedrequesttype === "json") {
            this.getTheJSON();
        }
    },
    template: `<div class='requestpreviewcontainer'>
        <div class='requestpreviewflavor'>Request Preview</div>
        <div class='requestpreviewrefreshbutton' @click='refresh' v-if='!refreshing'>
            <fancybutton :icon='"refresh"'></fancybutton>Refresh
        </div>
        <div class='requestpreviewURL'>{{url}}</div>
        <div v-if='expectedrequesttype === "image"' class='requestpreviewimagewrapper'>
            <img class='requestpreviewimage' v-if='imageProperties.show' ref='previewimage' :onload='imgload' :src='url' />
            <div class='requestpreviewimagedata'>{{imageProperties.width+"PX x "+imageProperties.height+"PX @ "+imageProperties.size}}</div>
        </div>
        <div v-else-if='expectedrequesttype === "json"' class='requestpreviewjsonwrapper'>
            <pre class='requestpreviewjson'>{{JSON.stringify(jsonProperties.jsonObject, null, "    ")}}</pre>
            <div class='requestpreviewjsondata'>{{jsonProperties.size}}</div>
        </div>
        <div v-else>No response type display for type {{expectedrequesttype}}</div>
    </div>`
})

siteApp.component('requestmodifierexample', {
    props: ['exampledata', 'resolutiontype'],
    data: function() {
        return {
            baseURL: siteURL.protocol+"//"+siteURL.hostname
        }
    },
    methods: {
        copyToClipboard: async function(string) {
            await navigator.clipboard.writeText(string);
            alert("Copied URL to clipboard.");
        },
        openInNewTab: function(string) {
            window.open(string);
        }
    },
    computed: {},
    template: `<div class='requestmodifierexamplecontainer'>
        <div class='requestmodifierexamplename'>Example: {{exampledata.name}}</div>
        <div class='requestmodifierexampledesc'>{{exampledata.description}}</div>
        <div class='requestmodifierexamplelink'>
            <div class='requestmodifierexamplelinkstring'>{{baseURL+exampledata.example}}</div>
            <fancybutton :icon='"copy"' @click='() => {copyToClipboard(baseURL+exampledata.example)}'></fancybutton>
            <fancybutton :icon='"open"' @click='() => {openInNewTab(baseURL+exampledata.example)}'></fancybutton>
        </div>
        <div class='requestmodifierpreview'>
            <requestpreview :url='baseURL+exampledata.example' :expectedrequesttype='resolutiontype'></requestpreview>
        </div>
    </div>`
})

siteApp.component('parametersdocumentation', {
    props: ['parameters', 'resolutiontype'],
    template: `<div class='documentationrequestmodifiercontainer documentationparameterscontainer'>
        <div class='documentationrequestmodifierwrapper' v-for='parameter in parameters'>
            <div class='documentationrequestmodifiername'>Parameter '{{parameter.name}}' - {{parameter.parameter}}</div>
            <div class='documentationrequestmodifiersubtitle'>{{parameter.subtitle}}</div>
            <div class='documentationrequestmodifierdescription'>{{parameter.description}}</div>

            <div class='parameterrequiredflagdisplay' :class='((parameter.required) ? "" : " notrequired")'>
                <div class='parameterrequiredflagflavor'>This parameter is {{((parameter.required) ? " " : "not ")}}required.</div>
                <div class='parameterrequiredflagconfirmation'>You {{((parameter.required) ? "" : "do NOT")}} need to include this parameter in your requests.</div>
                <div class='parameterrequiredflagnote' v-if='parameter.requiredNote'>Note: {{parameter.requiredNote}}</div>
            </div>

            <requestmodifierexample v-for='example in parameter.examples' :exampledata='example' :resolutiontype='resolutiontype'></requestmodifierexample>
        </div>
    </div>`
})

siteApp.component('querymodifiersdocumentation', {
    props: ['querymods', 'resolutiontype'],
    template: `<div class='documentationrequestmodifiercontainer documentationquerymodscontainer'>
        <div class='documentationrequestmodifierwrapper' v-for='queryModifier in querymods'>
            <div class='documentationrequestmodifiername'>Query Modifier: '{{queryModifier.name}}' - ?{{queryModifier.query}}=''</div>
            <div class='documentationrequestmodifiersubtitle'>{{queryModifier.subtitle}}</div>
            <div class='documentationrequestmodifierdescription'>{{queryModifier.description}}</div>

            <requestmodifierexample v-for='example in queryModifier.examples' :exampledata='example' :resolutiontype='resolutiontype'></requestmodifierexample>
        </div>
    </div>`
})

const navBarApp = Vue.createApp({
    data: function() {
        return {
            quote: {text: "...", origin: "___"}
        }
    },
    mounted: async function() {
        const PPRequest = await fetch('https://prestonsprojects.com/quirkytext');
        const quirkytext = await PPRequest.json();
        this.quote.text = quirkytext.text;
        this.quote.origin = quirkytext.origin;
    }
})

navBarApp.component("reactivenavbar", {
    props: ['quote'],
    template: `<div class='navbarcontent'>
        <div class='navbarlogo'></div>
        <div class='navbarprojectname'></div>
        <div class='navbarseparator'></div>
        <div class='navbarlink'>
            <a href='/'>Home</a>
        </div>
        <div class='navbarlink'>
            <a href='/credits'>Credits</a>
        </div>
        <div class='navbarquote'>
            <div class='navbarquotecontent'>{{quote.text}}</div>
            <div v-if='false' class='navbarquoteoriginator'>- {{quote.origin}}</div>
        </div>
    </div>`
})

navBarApp.mount("#sitenavbar");

siteApp.mount("#sitecontent");