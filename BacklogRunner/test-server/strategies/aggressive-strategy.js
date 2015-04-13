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
var Injection = globals.Injection;

var TAG = "aggressive-strategy";

/**
 * Configuration.
 */

function Configuration(settings) {
  var self = this;

  this.graphMode = function() {
    return settings.superGraphMode;
  };
}

function Strategy(taskInfo, configuration, settings) {
  var self = this;

  eventify.init(self);

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
    injectOnActionGreaterThanEq: 0,
    results: undefined,

    init: function (saved) {
      if (saved) {
        console.log(TAG, "continuing from saved state");
        this.injectOnActionGreaterThanEq = saved.injectOnActionGreaterThanEq;
        this.results = saved.results;
      } else {
        this.injectOnActionGreaterThanEq = 0;
        this.results = [];
      }
    },

    save: function () {
      return {
        injectOnActionGreaterThanEq: currentMode.injectOnActionGreaterThanEq,
        results: currentMode.results
      };
    },

    hasMoreInjectionSites: function(currentState, result) {
      var failed = currentState.foundError || result.testRunFailed || result.testFailed;
      return !settings.stopOnError && failed && this.injectOnActionGreaterThanEq < currentState.currentAction;
    },

    nextMode: function(currentState, result) {
      if (this.hasMoreInjectionSites(currentState, result)) {
        this.injectOnActionGreaterThanEq = currentState.currentAction;
      } else {
        console.log(TAG, testLongName.grey, "Done stressing test in all configurations for all event types");
        return false;
      }

      return true;
    },

    id: function () {
      var result = [settings.stressType.toLowerCase()];
      if (settings.superGraphMode) result.push("sg");
      if (settings.stopOnError) result.push("stop");
      return result.join("-");
    },

    toString: function () {
      return this.id() + "-" + this.injectOnActionGreaterThanEq;
    }
  };

  var currentState = {
    init: function (defaults) {
      if (!defaults) {
        defaults = {};
      }

      this.restarts = typeof defaults.restarts != "undefined" ? defaults.restarts : 0;
      this.restartLimitReached = 0;
      this.retry = false;

      this.currentAction = 0;
      this.currentEvent = 0;
      this.foundError = false;
      this.isFiring = false;
      this.firstEspressoAction = true;
      
      this.graph = new Graph(self.getId(), {
        applicationId: taskInfo.applicationId,
        className: taskInfo.className,
        methodName: taskInfo.methodName,
        graphType: settings.graphType
      });
    }
  };

  this.getId = function () {
    return taskInfo.title + "-" + currentMode.toString();
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
      this.stats = new Statistics(taskInfo, settings);
      this.coverage = new Coverage(taskInfo, Env.device);
      this.snapshotter = new Snapshotter(Env.device);  
    }
  };

  /**
   * Interface
   */

  this.perform = function (callback, data) {
    strategyUtils.loop(taskInfo, configuration, settings, {
      currentMode: currentMode,
      currentState: currentState,
      Env: Env,
      AndroidObjects: AndroidObjects,
      tools: tools,
      self: self
    }, function(result, device.androidInterface) { // modified callback
      if (settings.stopOnError) {
        callback(result);
      } else {
        taskInfo.title += "-stop-on-error";
        device.androidInterface.aggregateTests(taskInfo, [currentMode.results[0]], function (error) {
          taskInfo.title = taskInfo.title.substring(0, taskInfo.title.lastIndexOf("-stop-on-error"));
          callback(result);
        });
      }
    }, data);
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
   * Utils
   */

  function nextToInject(messageEventName) {
    if (messageEventName) {
      // Called by postAction
      this.messageEventName = messageEventName;
    } else {
      // Called by postInject
      messageEventName = this.messageEventName;
    }

    if (currentMode.injectOnActionGreaterThanEq <= currentState.currentAction) {
      while (currentState.currentEvent < settings.eventTypes.length) {
        var eventType = settings.eventTypes[currentState.currentEvent++];
        if (eventType == "pause-stop-restart" && messageEventName == "((is displayed on the screen to the user and with content description: is \"More options\") or (is displayed on the screen to the user and with class name: a string ending with \"OverflowMenuButton\")) single click") {
          console.log(TAG, testLongName.grey, "nextToInject(" + eventType + "): false (ignoring false positive)");
        } else {
          return eventType;
        }
      }
    }
  }

  /**
   * Implementation of Android hooks
   */

  this.testStarted = strategyUtils.retryify("testStarted", this, function (pid, looper, androidTestRunner) {
    AndroidObjects.androidTestRunner = androidTestRunner;
  });

  this.testEnded = strategyUtils.retryify("testEnded", this, function (looper, androidTestRunner, foundError) {
    console.log(TAG, testLongName.grey, foundError ? ("test ended").red : "test ended");
    currentState.foundError = foundError;
  });

  this.processCrashed = strategyUtils.retryify("testEnded", this, function (err) {
    console.log(TAG, testLongName.grey, "process crashed".red, err);
    if (!currentState.retry) {
      currentState.foundError = true;
    }
  });

  this.preAction = strategyUtils.retryify("preAction", this, function (looper, msgInfo) {
    var isEspressoInjectionMessage = msgInfo.isEspressoInjectionMessage();

    if (isEspressoInjectionMessage) {
      // var messageEventName = strategyUtils.getMessageEventName(msgInfo);
      // console.log(TAG, testLongName.grey, "preAction", messageEventName.grey);

      if (currentState.firstEspressoAction) {
        currentState.firstEspressoAction = false;
      }
    }

    Env.exec.delayCurrentAction = currentState.isFiring || tools.snapshotter.takingSnapshot;

    if (!Env.exec.delayCurrentAction && isEspressoInjectionMessage) {
      console.log(TAG, testLongName.grey, "currentAction", currentState.currentAction);
    }
  });

  var messageEventName;

  this.postAction = strategyUtils.retryify("postAction", this, function (looper, msgInfo) {
    var isEspressoInjectionMessage = msgInfo.isEspressoInjectionMessage();

    currentState.currentEvent = 0;

    if (isEspressoInjectionMessage) {
      messageEventName = strategyUtils.getMessageEventName(msgInfo);

      // console.log(TAG, testLongName.grey, "postAction", messageEventName.grey);

      var injectionEvent = nextToInject(messageEventName);

      if (injectionEvent != undefined) {
        function performInjection() {
          if (!settings.superGraphMode || Reduction.shouldInject(injectionEvent, messageEventName)) {
            console.log(TAG, testLongName.grey, "firing " + injectionEvent);
            currentState.isFiring = true;
            looper.fire(injectionEvent);
          } else {
            console.log(TAG, testLongName.grey, ("performInjection(" + injectionEvent + "): false (redundant)").green);
          }
        }

        if (configuration.graphMode()) {
          tools.snapshotter.take(looper, { bitmap: settings.graphType == "bitmap", dump: true })
          .then(function(snapshot) {
            tools.viewConnector.addSnapshot(snapshot, messageEventName, currentState.currentAction);
            performInjection();
          }, function(err) {
            self.retry("postAction snapshot", err);
          });
        } else {
          performInjection();
        }
      }

      currentState.currentAction++;
    }
  });

  this.preInject = strategyUtils.retryify("preInject", this, function (looper) {
    Env.exec.delayCurrentInjection = tools.snapshotter.takingSnapshot;
  });

  this.postInject = strategyUtils.retryify("postInject", this, function (looper) {
    var injectionEvent = nextToInject();

    if (injectionEvent != undefined && (!settings.superGraphMode || Reduction.shouldInject(injectionEvent, messageEventName))) {
      console.log(TAG, testLongName.grey, "firing " + injectionEvent);
      currentState.isFiring = true;
      looper.fire(injectionEvent);
    } else {
      currentState.isFiring = false;
    }
  });

  var Reduction = (function() {
    var nodeToSuperNodeIds = {};
    var newSuperGraphNodeObserver = undefined;

    function getSuperNode(node) {
      var superNodeId = nodeToSuperNodeIds[node.id];
      if (typeof superNodeId != "undefined") {
        return globals.superGraph.getNodeById(superNodeId);
      } else {
        tools.stats.startTimer("superGraphLookupOverhead");
        var result = tools.viewConnector.findNode(globals.superGraph, node);
        tools.stats.stopTimer("superGraphLookupOverhead");
        return result;
      }
    }

    return {
      shouldInject: function(eventType, messageEventName) {
        var node = currentState.graph.getNodeById(currentState.graph.data.lastNodeId);
        var superNode = getSuperNode(node);

        var edgeLabel = eventType + "\n" + messageEventName;

        var shouldInject = !superNode || !superNode.outgoingEdges.find(function(superEdge) {
          return edgeLabel == superEdge.label;
        });

        if (!superNode) {
          // Add current node to super graph, or create if not there
          superNode = tools.viewConnector.addNodeToSuperGraph(node, true);
          nodeToSuperNodeIds[node.id] = superNode.id;
        }

        if (shouldInject) {
          globals.superGraph.connect(superNode, globals.superGraphDummyNode, edgeLabel);
        }

        return shouldInject;
      }
    };
  })();
}

/**
 * Exports.
 */

exports.Configuration = Configuration;
exports.Strategy = Strategy;
