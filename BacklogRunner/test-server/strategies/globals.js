var sh = require("execSync");
var fs = require("fs");
var colors = require("colors");

var polyfill = require("../../utils/polyfill");
var config = require("../../config").config;
var Graph = require("../../utils/graph").Graph;
var Node = require("../../utils/graph").Node;
var emulator = require("../../utils/emulator");
var EmulatorPool = emulator.EmulatorPool;

var TAG = "globals";

/**
 * Globals.
 */

var Globals = {
  Type: {
    AGGRESSIVE: "AGGRESSIVE",
    ALL: "ALL",
    SINGLE: "SINGLE",
    NONE: "NONE",
    EXHAUSTIVE: "EXHAUSTIVE",
    MINIMIZE: "MINIMIZE"
  },
  Injection: {
    NONE: "NONE",
    IGNORE: "IGNORE",
    INJECT: "INJECT",
    FALSE_POSITIVE: "FALSE_POSITIVE"
  },
  eventTypes: [
    "orientation-flip",
    "pause-stop-restart",
    "pause-stop-create",
    "pause-stop-destroy-create",
    "pause-resume",
    "pause-create",
    "change-ui-mode",
    "data-connection-flip",
    "data-connection-on",
    "data-connection-off",
    "sms",
    "low-battery",
    "audio-becoming-noisy",
    "audio-becoming-noisy-media-play-key",
    "media-play-key",
    "request-audio-focus",
    "request-audio-focus-may-duck",
    "abandon-audio-focus",
    "request-abandon-audio-focus",
    "request-abandon-audio-focus-may-duck"
  ],
  isAudio: function(eventType) {
    switch (eventType) {
      case "audio-becoming-noisy":
      case "audio-becoming-noisy-media-play-key":
      case "media-play-key":
      case "request-audio-focus":
      case "request-audio-focus-may-duck":
      case "abandon-audio-focus":
      case "request-abandon-audio-focus":
      case "request-abandon-audio-focus-may-duck":
        return true;
    }
    return false;
  },
  superGraph: new Graph("super"),
  superGraphDummyNode: new Node("dummy", {}),
  emulatorPool: new EmulatorPool()
};

Globals.superGraph.addNode(Globals.superGraphDummyNode);

/**
 * Command interface.
 */

process.stdin.resume();
process.stdin.setEncoding("utf8");
process.stdin.on("data", function (input) {
  if (input == "dump-super-graph\n") {
    console.log(TAG, "dumping super graph");
    Globals.superGraph.dump(config.modules.superGraph.outDir + "/user-request", function() {
      sh.exec("open " + config.modules.superGraph.outDir + "/user-request/" + Globals.superGraph.name + ".dot");
    });
  } else if (input == "reset-super-graph\n") {
    console.log(TAG, "resetting super graph");
    Globals.superGraph = new Graph("super");
  } else if (input.startsWith("load-super-graph") && input.endsWith("\n")) {
    var fileName = input.replace("load-super-graph ", "").replace("\n", "");
    if (fs.existsSync(fileName)) {
      var data = fs.readFileSync(fileName);
      Globals.superGraph = Graph.build(JSON.parse(data));
      console.log(TAG, "super graph loaded");
    }
  }
});

/**
 * Exports.
 */
exports.Injection = Globals.Injection;
exports.Type = Globals.Type;
exports.superGraph = Globals.superGraph;
exports.superGraphDummyNode = Globals.superGraphDummyNode;
exports.isAudio = Globals.isAudio;
exports.emulatorPool = Globals.emulatorPool;
