var fs = require("fs");
var mkdirp = require("mkdirp");

var config = require("../config").config;
var utils = require("./utils");
var polyfill = require("./polyfill");
var Graph = require("./graph").Graph;
var Node = require("./graph").Node;
var globals = require("../test-server/strategies/globals");

var TAG = "view-connector";

/**
 * View connector.
 */

function ViewConnector(settings, currentState) {
    var self = this;
    var uids = 0;

    this.addSnapshot = function(snapshot, currentEventName, currentAction, injection, additionalActionData) {
        var pair = addView({
            nodeLabel: "node",
            edgeLabel: currentEventName,
            nodeData: snapshot,
            action: currentAction,
            injection: injection
        });

        var node = pair.node;
        var edge = pair.edge;

        var outputDir = config.modules.graph.outDir + "/" + currentState.graph.name;
        var remoteOutputDir = config.modules.graph.remoteDir + "/" + currentState.graph.name;

        if (typeof additionalActionData != "undefined") {
            edge.data.paths = edge.data.paths || {};
            edge.data.paths.edgeData = outputDir + "/" + uids++ + ".md";
            mkdirp(outputDir, function(err) {
                if (err) {
                    console.log(TAG, "could not create dir".red, outputDir);
                } else {
                    fs.writeFile(edge.data.paths.edgeData, new Buffer(additionalActionData, 'utf8'));
                }
            });
        }

        if (settings.snapshot && snapshot.bitmap) {
            node.data.paths = node.data.paths || {};
            node.data.remotePaths = node.data.remotePaths || {};

            node.data.paths.bitmaps = node.data.paths.bitmaps || [];
            node.data.remotePaths.bitmaps = node.data.remotePaths.bitmaps || [];

            var path = outputDir + "/" + node.id + "-" + (node.data.paths.bitmaps.length+1) + ".png";
            var remotePath = remoteOutputDir + "/" + node.id + "-" + (node.data.paths.bitmaps.length+1) + ".png";
            
            var hash = snapshot.bitmap.hashCode();
            if (!node.data.paths.bitmaps.some(function(bitmap) { return hash == bitmap.hash; })) {
                node.data.paths.bitmaps.push({ path: path, hash: hash });
                node.data.remotePaths.bitmaps.push({ path: remotePath, hash: hash });
            }

            mkdirp(outputDir, function(err) {
                if (err) {
                    console.log(TAG, "could not create dir".red, outputDir);
                } else {
                    fs.writeFile(path, new Buffer(snapshot.bitmap, 'base64'));
                }
            });
        }
    };

    function addView(options) {
        var node = self.findNode(currentState.graph, { data: options.nodeData }), edge = null;

        if (!node) {
            node = new Node(options.nodeLabel, options.nodeData);
            node.label += " " + node.id;
            currentState.graph.addNode(node);
        }

        if (typeof currentState.graph.data.lastNodeId != "undefined") {
            edge = currentState.graph.connect(currentState.graph.getNodeById(currentState.graph.data.lastNodeId), node, options.edgeLabel);

            if (typeof edge.data.count == "undefined") {
                edge.data = { count: 1, actions: [] };
            } else {
                edge.data.count++;
            }

            if (options.injection) {
                edge.data.injection = true;
            }
            if (typeof options.action != "undefined") {
                edge.data.actions.push(options.action);
            }
        } else {
            node.initial = true;
        }
        currentState.graph.data.lastNodeId = node.id;
        return { node: node, edge: edge };
    };

    this.findNode = function(graph, node) {
        var view = node.data.view;
        var bitmap = node.data.bitmap;

        for (var id in graph.nodes) {
            if (!graph.nodes.hasOwnProperty(id)) {
                continue;
            }

            var otherNode = graph.getNodeById(id);

            // If there is a view, use that for finding nodes, otherwise use bitmaps
            if (settings.graphType == "view" ? view == otherNode.data.view : bitmap == otherNode.data.bitmap) {
                return otherNode;
            }
        }
    };

    this.addNodeToSuperGraph = function(node, checked, superNode) {
        if (!checked) {
            superNode = self.findNode(globals.superGraph, node);
        }

        if (!superNode) {
            superNode = new Node(node.label, node.data);
            globals.superGraph.addNode(superNode);
        }

        if (node.initial) {
            superNode.initial = true;
        }

        return superNode;
    };
}

exports.ViewConnector = ViewConnector;