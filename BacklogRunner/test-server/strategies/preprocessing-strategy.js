require("colors");

var sh = require("execSync");

var Statistics = require("./statistics").Statistics;
var Coverage = require("../coverage").Coverage;
var Snapshotter = require("../../utils/snapshotter").Snapshotter;
var ViewConnector = require("../../utils/view-connector").ViewConnector;

var eventify = require("../../utils/eventify");
var strategyUtils = require("../../utils/strategy");
var Graph = require("../../utils/graph").Graph;
var config = require("../../config").config;
var globals = require("./globals");

var Type = globals.Type;

var TAG = "preprocessing-strategy";

var FETCH_ALWAYS = true;

/**
 * Configuration.
 */

function Configuration(settings) {
  this.graphMode = false;

  this.reductionStrategies = [];

  if (settings.superGraphMode) {
    this.reductionStrategies.push(ReductionStrategies.SUPER_GRAPH_INJECTION_REDUCTION);
    this.graphMode = true;
  }
}

function Strategy(taskInfo, configuration, settings, strategy) {
  var self = this;

  eventify.init(self);

  /**
   * Event propagation.
   */

  this.fire = strategy.fire;

  this.continue = strategy.continue;

  /**
   * State
   */

  var Env = {
    device: undefined,
    exec: undefined
  };

  var AndroidObjects = {
    androidTestRunner: undefined
  };

  var testLongName = taskInfo.methodName;

  var currentMode = {
    results: [],

    init: function(saved) {
      if (saved) {
        this.results = saved.results;
      } else {
        this.results = [];
      }
    },

    nextMode: function() {
      return false;
    },

    toString: function() {
      return "configuration-counter";
    }
  };

  var currentState = {
    init: function() {
      this.firstEspressoAction = true;
      this.currentAction = 0;
      this.graph = new Graph(taskInfo.title + currentMode.toString());
      this.initialNode = undefined;
    }
  };

  /**
   * Tools
   */

  var tools = {
    stats: undefined,
    coverage: undefined,
    snapshotter: undefined,
    viewConnector: new ViewConnector(settings, currentState),

    init: function() {
      this.snapshotter = new Snapshotter(Env.device);  
    }
  };

  /**
   * Interface
   */

  this.perform = function(callback, data) {
    if (settings.stressType == Type.NONE || settings.stressType == Type.SINGLE) {
      strategy.perform(callback);
    } else {
      console.log(TAG, testLongName.grey, ("--->----> begin ---->---->-").blue);

      currentState.init();
      currentMode.init(data && data.saved && data.saved.currentMode);

      globals.superGraph.memorize();
      function looper(device) {
        if (!device) {
          globals.emulatorPool.pick(function(device) {
            Env.exec = device.testManagerInterface.Execution;
            Env.device = device;

            initTools();
            
            device.testManagerInterface.hookify(self);

            looper(device);
          });
          return;
        }

        console.log(TAG, testLongName.grey, ("--->----> on device: " + device + " ------>---->-").blue);

        self.register();
        registerTools();

        device.androidInterface.runTest(currentMode, taskInfo, settings, function(result) {
           self.unregister([stats, coverage, snapshotter]);

          if (result.missingApk) {
            taskInfo.install = true;
            currentState.init();
            looper(device);
          } else {
            taskInfo.install = false;

            if (result.emulatorBroken) {
              // Restart
              console.log(TAG, testLongName.grey, "result.emulatorBroken".red);
              // globals.superGraph.undo();

              device.forceKill(function() {
                if (currentState.restarts <= 2) { // max 3 restarts
                  currentState.init({ restarts: currentState.restarts+1 });
                  looper();
                } else {
                  currentState.restartLimitReached = 1;
                  next(result);
                }
              });
            } else if (currentState.retry) {
              // Retry (but no restart)
              console.log(TAG, testLongName.grey, "currentState.retry".red);
              // globals.superGraph.undo();

              if (currentState.restarts <= 2) { // max 3 restarts
                currentState.init({ restarts: currentState.restarts+1 });
                looper(device);
              } else {
                currentState.restartLimitReached = 1;
                next(result);
              }
            } else {
              // Neither restart nor retry: everything is good
              if (settings.snapshot) {
                var dir = config.modules.graph.outDir + "/" + self.getId();
                var remoteDir = config.modules.graph.remoteDir + "/" + self.getId();
                
                result.paths = result.paths || {};
                result.remotePaths = result.remotePaths || {};

                result.paths.graph = dir + "/" + currentState.graph.name + ".dot";
                result.remotePaths.graph = remoteDir + "/" + currentState.graph.name + ".dot";

                currentState.graph.dump(dir);
              }

              currentMode.results.push(result);

              globals.superGraph.memorize();

              next(result);
            }
          }
        });

        function next(result) {
          stats && stats.commit(currentMode.id(), currentState);

          if (currentMode.nextMode(currentState, result)) {
            save();
            currentState.init();
            looper(device);
          } else {
            done();
          }
        }

        function done() {
          console.log(TAG, testLongName.grey, "-->------>---  all modes explored --|-----|----|-".blue);
          device.recycle();

          var result = currentMode.results[0];

          // Calculate configurations that can be ignored by looking in the super graph

          var ignoredConfigurations = [];

          for (var i = 0; i < configuration.reductionStrategies.length; i++) {
            var reductions = configuration.reductionStrategies[i](currentState.graph, currentState.initialNode, currentState.currentAction);
            for (var j = 0; j < reductions.length; j++) {
              var reduction = reductions[j];
              if (ignoredConfigurations.indexOf(reduction) < 0) {
                ignoredConfigurations.push(reduction);
              }
            }
          }

          // Send the configurations to the strategy

          var configurations = [];
          for (var i = 0; i < currentState.currentAction; i++) {
            if (ignoredConfigurations.indexOf(i) < 0) {
              configurations.push(i);
            }
          }

          if (configurations.length > 0) {
            // Run strategy
            strategy.perform(callback, { configurations: configurations.sort() });
          } else {
            console.log(TAG, "all configurations are ignored".yellow);
            callback({});
          };
        }
      }

      looper();
    }
  };

  /**
   * Error handling
   */

  this.retry = function(name, err) {
    console.log(TAG, testLongName.grey, ("retrying due to " + name).red, err, err.stack);
    currentState.retry = true;
    sh.exec(config.adbPath + "/adb -s " + Env.device.serial + " shell am force-stop " + taskInfo.applicationId);
    self.unregister([tools.stats, tools.coverage, tools.snapshotter]);
  };

  /**
   * Implementation of Android hooks
   */

  this.testStarted = strategyUtils.retryify("testStarted", this, function(pid, looper, androidTestRunner) {
    AndroidObjects.androidTestRunner = androidTestRunner;
  });

  this.testEnded = strategyUtils.retryify("testEnded", this, function() {
  });

  this.processCrashed = strategyUtils.retryify("processCrashed", this, function(err) {
    console.log(TAG, testLongName.grey, "process crashed".red, err);
    if (!currentState.retry) {
      currentState.foundError = true;
    }
  });

  this.preAction = strategyUtils.retryify("preAction", this, function(looper, msgInfo) {
    if (currentState.firstEspressoAction && msgInfo.isEspressoInjectionMessage()) {
      if (configuration.graphMode) {
        tools.snapshotter.take(looper, { bitmap: settings.graphType == "bitmap", dump: true })
        .then(function(snapshot) {
          tools.viewConnector.addSnapshot(snapshot);
        });
      }
      currentState.firstEspressoAction = false;
    }
    Env.exec.delayCurrentAction = tools.snapshotter.takingSnapshot;
  });

  this.postAction = strategyUtils.retryify("postAction", this, function(looper, msgInfo) {
    if (msgInfo.isEspressoInjectionMessage()) {
      if (configuration.graphMode) {
        var currentEventName = strategyUtils.getMessageEventName(msgInfo);
        tools.snapshotter.take(looper, { bitmap: settings.graphType == "bitmap", dump: true })
        .then(function(snapshot) {
          tools.viewConnector.addSnapshot(snapshot, currentEventName, currentState.currentAction);
        });
      }
      currentState.currentAction++;
    }
  });
}


/**
 * Reduction strategies.
 */

var ReductionStrategies = {

  SUPER_GRAPH_INJECTION_REDUCTION: function(graph, initialNode, actions) {
    var result = [];

    var nodeToSuperNodeIds = {};
    var newSuperGraphNodeObserver = undefined;

    var getSuperNode = function(node) {
      var superNodeId = nodeToSuperNodeIds[node.id];
      if (typeof superNodeId != "undefined") {
        return Globals.superGraph.getNodeById(superNodeId);
      } else {
        return tools.viewConnector.findNode(Globals.superGraph, node);
      }
    };

    var currentNode = initialNode;
    for (var action = 0; action < actions; action++) {
      var edge = currentNode.outgoingEdges.find(function(edge) {
        return edge.data.actions.indexOf(action) >= 0;
      });

      // Check if we should ignore

      var currentSuperNode = getSuperNode(currentNode);
      if (edge.label == "?") {
        console.log(TAG, "not ignoring, edge.label is '?'".red);
      } else if (currentSuperNode && currentSuperNode.outgoingEdges.find(function(superEdge) { return edge.label == superEdge.label; })) {
        result.push(action);
      }

      // Add current node to super graph

      if (!currentSuperNode) {
        currentSuperNode = tools.viewConnector.addNodeToSuperGraph(currentNode, true);
        nodeToSuperNodeIds[currentNode.id] = currentSuperNode.id;
      }

      // Add incoming edge to super graph

      if (typeof newSuperGraphNodeObserver == "function") {
        newSuperGraphNodeObserver(currentSuperNode);
      }

      // Add outgoing edge to super graph

      // Bind objects in a closure; otherwise they will point to the objects in the next iteration!
      // Use let from ES6 instead of var? (let is block scoped.)
      (function(currentSuperNode, edge) {
        newSuperGraphNodeObserver = function(nextSuperNode) {
          console.log(TAG, "connecting " + currentSuperNode.id + " with " + nextSuperNode.id);
          Globals.superGraph.connect(currentSuperNode, nextSuperNode, edge.label);
        };
      })(currentSuperNode, edge);

      // Prepare for next iteration

      var nextNode = graph.getNodeById(edge.to);
      currentNode = nextNode;
    }

    console.log(TAG, "super-graph-injection-reduction: ignoring " + result.length + " configuration(s)");

    return result;
  }
};

/**
 * Exports.
 */

exports.Configuration = Configuration;
exports.Strategy = Strategy;