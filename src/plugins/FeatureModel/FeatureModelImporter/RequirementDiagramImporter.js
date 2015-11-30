/**
 * Created by Dana Zhang on 11/18/15.
 */

/*globals define*/
/*jshint node:true, browser:true*/

define(['./FMImporterConstants'], function (CONSTANTS) {

    'use strict';

    var RequirementDiagramImporter = function () {

    };

    RequirementDiagramImporter.prototype.buildDiagram = function (fmData, modelNotation) {
        var self = this,
            PREFIX ='@http://www.omg.org/spec/XMI/20131001:',
            i,
            idToNode = {},
            connectionCommentIdToType = self._getConnectionCommentIdTypes(fmData),
            nodeDataById = self._processModelNotation(modelNotation),
            node,
            linkNode,
            nodeId,
            nodeType,
            links = [],
            smNode,
            _addRqmtNode,
            _addCommentNode;

        _addRqmtNode = function (id, elm, count) {
            var position = nodeDataById && nodeDataById[id] ? nodeDataById[id].position: {x: 50 + (100 * count), y: 200};
            node = self._constructNode(smNode, self.META[nodeType], elm['@name'], position);

            if (nodeType === 'Requirement' && elm.nestedClassifier) {
                self._constructReqtNodeRec(elm, smNode, count, idToNode, nodeDataById, links);
            }
            idToNode[id] = node;
        };

        _addCommentNode = function (id, elm, count) {
            var position = nodeDataById && nodeDataById[id] ? nodeDataById[id].position: {x: 50 + (100 * count), y: 200},
                dsts = [];
            node = self._constructNode(smNode, self.META[nodeType], nodeType, position);
            idToNode[id] = node;
            if (elm['@annotatedElements']) {
                elm['@annotatedElements'].split(' ').forEach(function (dst) {
                    links.push({
                        src: id,
                        dst: parseInt(dst),
                        type: 'CommentLink'
                    })
                });
            }
        };

        fmData = fmData['http://www.eclipse.org/uml2/5.0.0/UML:Model'];
        // Create the requirement diagram
        smNode = self._constructNode(self.activeNode, self.META.RequirementDiagram, modelNotation['@name'], {x: 200, y: 200});

        if (fmData.packagedElement) {

            // get all Requirement nodes
            if (!fmData.packagedElement.length) {
                nodeId = fmData.packagedElement[PREFIX + 'id'];
                nodeType = CONSTANTS.FM_TO_META_TYPES[fmData.packagedElement[PREFIX + 'type'].replace('uml:', '')];
                if (!idToNode[nodeId]) {
                    _addRqmtNode(nodeId, fmData.packagedElement, 0);
                }
            }

            for (i = 0; i < fmData.packagedElement.length; i += 1) {
                nodeId = fmData.packagedElement[i][PREFIX + 'id'];
                nodeType = CONSTANTS.FM_TO_META_TYPES[fmData.packagedElement[i][PREFIX + 'type'].replace('uml:', '')];

                // get requirement connections
                if (nodeType === 'Abstraction') {

                    links.push({
                        src: fmData.packagedElement[i]['@client'],
                        dst: fmData.packagedElement[i]['@supplier'],
                        type: connectionCommentIdToType[nodeId]
                    });

                } else if (!idToNode[nodeId]) {
                    _addRqmtNode(nodeId, fmData.packagedElement[i], i);
                }
            }
        }

        if (fmData.ownedComment) {
            if (!fmData.ownedComment.length) {
                nodeId = fmData.ownedComment[PREFIX + 'id'];
                nodeType = connectionCommentIdToType[nodeId];
                _addCommentNode(nodeId, fmData.ownedComment, 0);
            } else {
                for (i = 0; i < fmData.ownedComment.length; ++i) {
                    nodeId = fmData.ownedComment[i][PREFIX + 'id'];
                    nodeType = connectionCommentIdToType[nodeId] || 'Comment';
                    _addCommentNode(nodeId, fmData.ownedComment[i], i);
                }
            }
        }

        // With all links created, we will now create the connections between the nodes.
        for (i = 0; i < links.length; i += 1) {
            linkNode = self.core.createNode({
                parent: smNode,
                base: self.META[links[i].type]
            });

            self.core.setPointer(linkNode, 'src', idToNode[links[i].src]);
            self.core.setPointer(linkNode, 'dst', idToNode[links[i].dst]);
        }

    };

    RequirementDiagramImporter.prototype._constructNode = function (parentNode, metaType, name, position) {
        var self = this,
            smNode;

        smNode = self.core.createNode({
            parent: parentNode,
            base: metaType
        });
        self.core.setAttribute(smNode, 'name', name);
        self.core.setRegistry(smNode, 'position', position);

        return smNode;
    };

    RequirementDiagramImporter.prototype._constructReqtNodeRec = function (rqmtElm, node, inc, idToNode, nodeDataById, links) {
        var self = this,
            PREFIX ='@http://www.omg.org/spec/XMI/20131001:',
            nestedElms = rqmtElm['nestedClassifier'],
            i,
            _construct;

        _construct = function (elm) {

            var nodeId = elm[PREFIX + 'id'],
                position = nodeDataById && nodeDataById[nodeId] ? nodeDataById[nodeId].position : {x: 50 + (100 * i), y: 200};

            idToNode[nodeId] = self._constructNode(node, self.META.Requirement, elm['@name'], position);

            links.push({
                src: rqmtElm[PREFIX + 'id'],
                dst: nodeId,
                type: 'Decompose'
            });
            if (elm.nestedClassifier) {
                self._constructReqtNodeRec(elm, node, inc + 1, idToNode, nodeDataById, links);
            }
        };

        if (nestedElms.length) {
            for (i = 0; i < nestedElms.length; ++i) {
                _construct(nestedElms[i]);
            }
        } else {
            _construct(nestedElms);
        }
    };

    RequirementDiagramImporter.prototype._getConnectionCommentIdTypes = function (connElms) {
        var CONN_PREFIX = 'http://www.eclipse.org/papyrus/0.7.0/FM/Requirements:',
            COMMENT_PREFIX = 'http://www.eclipse.org/papyrus/0.7.0/FM/ModelElements:',
            connection,
            i,
            connectionCommentIdToType = {};

        for (connection in connElms) {
            if (connElms.hasOwnProperty(connection)) {
                if (connection.indexOf(CONN_PREFIX) > -1 && connection !== CONN_PREFIX + 'Requirement' ) {
                    if (connElms[connection].length) {
                        for (i = 0; i < connElms[connection].length; ++i) {
                            connectionCommentIdToType[connElms[connection][i]['@base_Abstraction']] = connection.replace(CONN_PREFIX, '');
                        }

                    } else {
                        connectionCommentIdToType[connElms[connection]['@base_Abstraction']] = connection.replace(CONN_PREFIX, '');
                    }
                } else if (connection.indexOf(COMMENT_PREFIX) > -1) {
                    if (connElms[connection].length) {
                        for (i = 0; i < connElms[connection].length; ++i) {
                            connectionCommentIdToType[connElms[connection][i]['@base_Comment']] = connection.replace(COMMENT_PREFIX, '');
                        }
                    } else {
                        connectionCommentIdToType[connElms[connection]['@base_Comment']] = connection.replace(COMMENT_PREFIX, '');
                    }
                }
            }
        }

        return connectionCommentIdToType;
    };


    RequirementDiagramImporter.prototype._processModelNotation = function (modelNotation) {
        var nodeDataById = {},
            ID_PREFIX = 'model.uml#',
            i,
            child;

        if (!modelNotation.children) {
            return null;
        }
        for (i = 0; i < modelNotation.children.length; ++i) {
            child = modelNotation.children[i];
            if (child.element['@href']) {
                nodeDataById[child.element['@href'].replace(ID_PREFIX, '')] =
                {
                    position:
                    {
                        x: parseInt(child.layoutConstraint['@x']),
                        y: parseInt(child.layoutConstraint['@y'])
                    }
                };
            }
        }
        return nodeDataById;
    };

    return RequirementDiagramImporter;
});