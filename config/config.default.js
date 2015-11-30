/*jshint node: true*/
/**
 * @author lattmann / https://github.com/lattmann
 */

var config = require('webgme/config/config.default');
var path = require('path');
config.server.port = 8080;

config.plugin.basePaths.push('./src/plugins/FeatureModel');

if (config.client.defaultContext) {
	config.client.defaultContext.project = "guest+SysML";
}
config.seedProjects.defaultProject = "FeatureModel";
config.seedProjects.basePaths.push('./seeds');


config.requirejsPaths = {
	ejs: "./node_modules/webgme/src/common/util/ejs",
	xmljsonconverter: "./node_modules/webgme/src/common/util/xmljsonconverter",
	jszip: "./node_modules/webgme/src/common/util/jszip"
};
config.visualization.decoratorPaths.push('./src/decorators');
config.visualization.decoratorsToPreload = null;

config.mongo.uri = 'mongodb://127.0.0.1:27017/webgme-sysml';

module.exports = config;
