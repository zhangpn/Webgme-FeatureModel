/**
 * Created by Dana Zhang on 11/8/15.
 */
/*globals define*/
/*jshint node:true, browser:true*/


define([
    'plugin/PluginConfig',
    'plugin/PluginBase',
    'jszip',
    'xmljsonconverter'
], function (
    PluginConfig,
    PluginBase,
    JSZip,
    Converter) {
    'use strict';

    /**
     * Initializes a new instance of FMImporter.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin FMImporter.
     * @constructor
     */
    var FMImporter = function () {
        // Call base class' constructor.
        PluginBase.call(this);
    };

    // Prototypal inheritance from PluginBase.
    FMImporter.prototype = Object.create(PluginBase.prototype);
    FMImporter.prototype.constructor = FMImporter;

    /**
     * Gets the name of the FMImporter.
     * @returns {string} The name of the plugin.
     * @public
     */
    FMImporter.prototype.getName = function () {
        return 'FM Importer';
    };

    /**
     * Gets the semantic version (semver.org) of the FMImporter.
     * @returns {string} The version of the plugin.
     * @public
     */
    FMImporter.prototype.getVersion = function () {
        return '0.1.0';
    };

    /**
     * Gets the configuration structure for the FMImporter.
     * The ConfigurationStructure defines the configuration for the plugin
     * and will be used to populate the GUI when invoking the plugin from webGME.
     * @returns {object} The version of the plugin.
     * @public
     */
    FMImporter.prototype.getConfigStructure = function () {
        return [
            {
                name: 'file',
                displayName: 'FM model',
                description: 'Click and drag existing FM models from Eclipse Papyrus',
                value: '',
                valueType: 'asset',
                readOnly: false
            }
        ];
    };


    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    FMImporter.prototype.main = function (callback) {
        // Use self to access core, project, result, logger etc from PluginBase.
        // These are all instantiated at this point.
        var self = this,
            currentConfig = self.getCurrentConfig();

        if (!currentConfig.file) {
            callback(new Error('No file provided.'), self.result);
            return;
        }

        self.blobClient.getObject(currentConfig.file, function (err, jsonOrBuf) {
            var dataModel;
            if (err) {
                callback(err);
                return;
            }

            if (typeof Buffer !== 'undefined' && jsonOrBuf instanceof Buffer) {
                // This clause is entered when the plugin in executed in a node process (on the server) rather than
                // in a browser. Then the getObject returns a Buffer and we need to convert it to string and then
                // parse it into an object.
                try {
                    jsonOrBuf = String.fromCharCode.apply(null, new Uint8Array(jsonOrBuf));
                    dataModel = JSON.parse(jsonOrBuf);
                } catch (err) {
                    callback(err, self.result);
                    return;
                }
            } else {
                // In the browser the getObject automatically returns a json object.
                dataModel = jsonOrBuf;
            }

            self.logger.info('Obtained dataModel', dataModel);
            self.buildUpFMDiagram(dataModel, function (err) {
                if (err) {
                    callback(err, self.result);
                    return;
                }

                self.save('FSM Importer created new model.', function (err) {
                    if (err) {
                        callback(err, self.result);
                        return;
                    }

                    self.result.setSuccess(true);
                    callback(null, self.result);
                });
            })
        });
    };

    FMImporter.prototype.buildUpFMDiagram = function (dataModel, callback) {
        var self = this,
            fmData = dataModel,
            i, j,
            idToNode = {},
            nodeNode,
            edgeNode,
            stateId,
            edges = {},
            smNode,
            _addEdge;

        _addEdge = function (nodeId, edge, inOrOutV) {
            var k,
                e;
            if (edge.created) {
                for (k = 0; k < edge.created.length; ++k) {
                    e = edge.created[k];
                    if (!edges.hasOwnProperty(e.id)) {
                        edges[e.id] = {
                            src: nodeId,
                            dst: e[inOrOutV],
                            label: 'created'
                        };
                    }
                }
            }
            if (edges.knows) {
                for (k = 0; k < edge.knows.length; ++k) {
                    e = edge.knows[k];
                    if (!edges.hasOwnProperty(e.id)) {
                        edges[e.id] = {
                            src: nodeId,
                            dst: e[inOrOutV],
                            label: 'knows'
                        };
                    }
                }
            }
        };


        // Create the stateMachine
        smNode = self.core.createNode({
            parent: self.activeNode,
            base: self.META.Graph
        });

        self.core.setAttribute(smNode, 'name', 'graph');
        self.core.setRegistry(smNode, 'position', {x: 200, y: 200});

        // Create the states and gather data about the transitions
        for (i = 0; i < fmData.nodes.length; i += 1) {
            stateId = fmData.nodes[i].id;
            nodeNode = self.core.createNode({
                parent: smNode,
                base: self.META.Node
            });

            self.core.setAttribute(nodeNode, 'name', fmData.nodes[i].label);
            self.core.setRegistry(smNode, 'position', {x: 50 + (100 * i), y: 200}); // This could be more fancy.

            // Add the node with its old id to the map (will be used when creating the transitions)
            idToNode[stateId] = nodeNode;

            // Gather the outgoing transitions from the current state and store the info.
            if (fmData.nodes[i].outE) {
                _addEdge(stateId, fmData.nodes[i].outE, 'inV');
            } else if (fmData.nodes[i].inE) {
                _addEdge(stateId, fmData.nodes[i].inE, 'outV');
            }
        }

        // With all state created, we will now create the transitions and connect them between the states.
        for (i in edges) {
            edgeNode = self.core.createNode({
                parent: smNode,
                base: self.META.Edge
            });

            self.core.setAttribute(edgeNode, 'label', edges[i].label);

            self.core.setPointer(edgeNode, 'src', idToNode[edges[i].src]);
            self.core.setPointer(edgeNode, 'dst', idToNode[edges[i].dst]);
        }

        callback(null);
    };

    return FMImporter;
});


