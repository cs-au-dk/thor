var fs = require("fs");
var mkdirp = require("mkdirp");
var sh = require("execSync");

var config = require("../config").config;
var dedumper = require("../viewDumper/dedumper");

var TAG = "graph";

/**
 * A simple counter to generate unique node ids.
 */

var counter = 0;
function nextId() {
	return counter++;
}

/**
 * The "classes".
 */

function Node(label, data) {
	var self = this;

	this.label = label;
	this.data = data;
	this.id = nextId();
	this.initial = false;

	this.outgoingEdges = [];
	this.outgoingEdges.find = function(pred) {
		for (var i = 0; i < self.outgoingEdges.length; i++) {
			var edge = self.outgoingEdges[i];
			if (pred(edge)) {
				return edge;
			}
		}
	};
}

function Edge(label, to, data) {
	this.label = label;
	this.to = to;
	this.data = data || {};
}

function Graph(name, data) {
	var self = this;

	this.name = name;
	this.nodes = {};
	this.data = data || {};
	this.size = 0;

	this.reset = function(name, data) {
		this.name = name;
		this.data = data || {};
	}

	this.addNode = function(node) {
		self.nodes[node.id] = node;
		self.size++;
		notify("addNode", [node]);
	};

	this.getNodeById = function(id) {
		return self.nodes[id];
	};

	this.connect = function(node1, node2, label) {
		var edge;
		for (var i = 0; i < node1.outgoingEdges.length; i++) {
			var outgoingEdge = node1.outgoingEdges[i];
			if (outgoingEdge.to == node2.id && outgoingEdge.label == label) {
				edge = outgoingEdge;
				break;
			}
		}
		if (!edge) {
			edge = new Edge(label, node2.id);
			node1.outgoingEdges.push(edge);
		}
		return edge;
	};

	this.getDotString = function(dir) {
		var result = [];
		result.push("digraph G {");
		for (var id in self.nodes) {
			if (!self.nodes.hasOwnProperty(id)) {
				continue;
			}

			var node = self.nodes[id];

			var nodeAttributes = [{ key: "label", value: self.nodeLabeler(node) }];
			if (config.debug) {
				nodeAttributes.push({ key: "URL", value: "file://" + dir + "/n" + node.id + ".json" });
			}
			if (node.data.paths && node.data.paths.bitmaps && node.data.paths.bitmaps.length > 0) {
				nodeAttributes.push({ key: "image", value: node.data.paths.bitmaps[0].path });
				nodeAttributes.push({ key: "shape", value: "box" });
				nodeAttributes.push({ key: "imagescale", value: "true" });
				nodeAttributes.push({ key: "width", value: "0.5" });

				for (var i = 1; i < node.data.paths.bitmaps.length; i++) {
					var subNodeAttributes = [];
					subNodeAttributes.push({ key: "image", value: node.data.paths.bitmaps[i].path });
					subNodeAttributes.push({ key: "shape", value: "box" });
					subNodeAttributes.push({ key: "imagescale", value: "true" });
					subNodeAttributes.push({ key: "width", value: "0.5" });

					subNodeAttributes = subNodeAttributes.map(function(attr) { return attr.key + "=\"" + attr.value + "\""; }).join(", ");

					result.push("  n" + node.id + "b" + i + " [" + subNodeAttributes + "];");
					result.push("  n" + node.id + " -> n" + node.id + "b" + i + " [color=\"blue\"];");
				}
			}
			nodeAttributes = nodeAttributes.map(function(attr) { return attr.key + "=\"" + attr.value + "\""; }).join(", ");

			result.push("  n" + node.id + " [" + nodeAttributes + "];");

			if (node.initial) {
				result.push("  i" + node.id + " [shape=\"point\"];");
				result.push("  i" + node.id + " -> n" + node.id + ";");
			}

			for (var j = 0; j < node.outgoingEdges.length; j++) {
				var outgoingEdge = node.outgoingEdges[j];
				var otherNode = self.nodes[outgoingEdge.to] || {};
				var edgeAttributes = [{ key: "label", value: self.edgeLabeler(node, outgoingEdge, otherNode) }];
				if (outgoingEdge.data.injection) {
					edgeAttributes.push({ key: "color", value: node != otherNode ? "red" : "grey" });
				}
				if(outgoingEdge.data.paths && outgoingEdge.data.paths.edgeData) {
					edgeAttributes.push({ key: "URL", value: "file://" + outgoingEdge.data.paths.edgeData})
				}
				edgeAttributes = edgeAttributes.map(function(attr) { return attr.key + "=\"" + attr.value + "\""; }).join(", ");

				result.push("  n" + node.id + " -> n" + otherNode.id + " [" + edgeAttributes + "];");
			}
		}
		result.push("}");
		return result.join("\n");
	};

	this.dump = function(dir, callback) {
		var callbackCounter = 2;

		function performCallback(err) {
			if (err) {
				throw err;
			}
			if (--callbackCounter == 0 && typeof callback == "function") {
				callback();
			}
		}

		sh.exec("rm -rf " + dir + "/*.json");
		sh.exec("rm -rf " + dir + "/*.dot");

		mkdirp(dir, function(err) {
			if (err) {
				throw err;
			}
			fs.writeFile(dir + "/" + name + ".dot", self.getDotString(dir), performCallback);
        	fs.writeFile(dir + "/" + name + ".json", JSON.stringify(self), performCallback);
			if (config.debug) {
				for (var id in self.nodes) {
					if (!self.nodes.hasOwnProperty(id)) {
						continue;
					}

					var node = self.nodes[id];
					fs.writeFile(dir + "/n" + node.id + ".json", node.data.view, performCallback);
					callbackCounter++;
				}
			}
		});
	};

	/**
	 * Event handlers.
	 */

	var observers = {
		"addNode": []
	};

	this.addObserverOnce = function(eventName, f, obj) {
	    var f2 = function() {
	      f.apply(obj, arguments);
	      self.removeObserver(eventName, f2);
	    };
		observers[eventName].push({ obj: obj, f: f2 });
	};

	this.removeObserver = function(eventName, f) {
		observers[eventName] = observers[eventName].filter(function(observer) {
			return observer.f != f;
		});
	};

	var notify = function(eventName, params) {
		var eventObservers = observers[eventName];
		for (var i = 0; i < eventObservers.length; i++) {
			var eventObserver = eventObservers[i];
			eventObserver.f.apply(eventObserver.obj, params);
		}
	};

	/**
	 * Undoing.
	 */

	var last;

	this.memorize = function() {
		last = JSON.stringify(self);
	};

	this.undo = function() {
		var g = Graph.build(JSON.parse(last));
		this.name = g.name;
		this.nodes = g.nodes;
		this.data = g.data;
		this.size = g.size;
	};

	/**
	 * Labeling.
	 */

	this.nodeLabeler = function(node) {
		var attributes = [];
		var lines = [];

		if (self.data.labeler == "messages") {
			lines.push(node.data.content);
			node.data.sender.trim().split(")").forEach(function(sender) {
				lines.push(sender + ")");
			});
		}

		attributes = attributes.length > 0 ? (" (" + attributes.join(", ") + ")") : "";
		lines = lines.length > 0 ? ("\n" + lines.join("\n")) : "";
		return node.label + attributes + lines;
	};

	this.edgeLabeler = function(from, edge, to) {
		var label = "";
		var attributes = [];

		var idFinder = function(view, id) {
			var found = view.fields && view.fields.mID && (view.fields.mID.content.indexOf(id) >= 0)
			if (found) {
				return view.fields.mID.content
			} else if (view.children && view.children.length > 0) {
				var subresults = view.children.map(function (x) { return idFinder(x, id); });
				for (var i = 0; i < subresults.length; i++)
					if (subresults[i]) 
						return subresults[i];
			}
		};

		if (edge.label) {
			label = edge.label
			var idMatcher = /with id: is <([0-9]*)>/g;
			var match = idMatcher.exec(edge.label)
			if (match) {
				var matchedId = match[1];
				try {
					var prettyid = idFinder(dedumper.parse(from.data.view), matchedId);
					if (prettyid) {
						label = edge.label.replace(matchedId, prettyid);
					}
				} catch (err) {}
			}
		}

		label = label.replace(/\"/g, "");

		if (edge.data) {
			if (typeof edge.data.count != "undefined") {
				attributes.push("count=" + edge.data.count);
			}
			if (typeof edge.data.actions != "undefined" && edge.data.actions.length > 0) {
				attributes.push("actions=" + edge.data.actions.join(","));
			}
		}

        if (label && attributes.length > 0) {
            return label + " (" + attributes.join(", ") + ")";
        } else if (label) {
        	return label;
        } else {
            return attributes.join(", ");
        }
	};
}

Graph.build = function(graphData) {
	var graph = new Graph(graphData.name);
	graph.data = graphData.data;

	var oldToNewIds = {};

	// Create nodes

	for (var id in graphData.nodes) {
		if (!graphData.nodes.hasOwnProperty(id)) {
			continue;
		}

		var nodeData = graphData.nodes[id];
		var node = new Node(nodeData.label, nodeData.data);
		node.initial = nodeData.initial;
		graph.addNode(node);
		oldToNewIds[nodeData.id] = node.id;
	}

	// Create edges between nodes

	for (var id in graphData.nodes) {
		if (!graphData.nodes.hasOwnProperty(id)) {
			continue;
		}
		
		var nodeData = graphData.nodes[id];
		var node = graph.getNodeById(oldToNewIds[nodeData.id]);

		for (var j = 0; j < nodeData.outgoingEdges.length; j++) {
			var edgeData = nodeData.outgoingEdges[j];
			node.outgoingEdges.push(new Edge(edgeData.label, oldToNewIds[edgeData.to], edgeData.data));
		}
	}

	return graph;
};

exports.Node = Node;
exports.Graph = Graph;
