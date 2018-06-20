const webpack = require('webpack');
const path = require('path');
const fs = require('fs');
const request = require('superagent');

const serverURL = (path) => `${process.env.SERVER_URL !== undefined ? process.env.SERVER_URL : 'http://localhost:8021'}/${path}`;

const createRule = (formUUID, type, ruleData, ruleDependencyUUID) =>
    request.post(serverURL("rule"), {
        ruleDependencyUUID: ruleDependencyUUID,
        formUUID: formUUID,
        type: type,
        data: ruleData.metadata,
        uuid: ruleData.uuid,
        name: ruleData.name,
        fnName: ruleData.fn.name
    }).on('error', console.log).then((resp) => console.log("CREATED"));

const postAllRules = (organisationName, ruleFilePath) => {
    const compiler = webpack({
        target: 'web',
        entry: {
            rules: ruleFilePath
        },
        output: {
            filename: '[name].bundle.js',
            libraryTarget: 'umd',
            library: 'rulesConfig',
            path: path.resolve(__dirname, 'dist')
        },
        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /(node_modules)/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            "presets": [
                                [
                                    "react-native-stage-0/decorator-support"
                                ]
                            ],
                            "plugins": [
                                "transform-class-properties",
                                "transform-export-extensions",
                                "transform-decorators-legacy",
                                "transform-es2015-destructuring"
                            ]
                        }
                    }
                }
            ]
        }
    });
    compiler.run((err, stats) => {
        const rules = require('./dist/rules.bundle.js');
        const rulesContent = String(fs.readFileSync(path.resolve(__dirname, 'dist') + '/rules.bundle.js'));
        request
            .post(serverURL("ruleDependency"), {
                code: rulesContent,
                hash: stats.hash
            }).set("ORGANISATION-NAME", organisationName)
            .then((response) => {
                const registry = rules[Object.keys(rules).find(r => rules[r].registry !== undefined)].registry;
                registry.getAll()
                    .forEach(([ruleKey, rulesData]) => {
                        rulesData.map(ruleData => createRule(ruleKey.formUUID, ruleKey.type, ruleData, response.text));
                    })
            });
    });
};


// postAllRules("","./test/additional/Rulez.js");
module.exports = {postAllRules};