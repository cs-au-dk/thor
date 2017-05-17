require("colors");

var sh = { exec: require("child_process").execSync };

var Statistics = require("./statistics").Statistics;
var Coverage = require("../coverage").Coverage;
var Snapshotter = require("../../utils/snapshotter").Snapshotter;
var ViewConnector = require("../../utils/view-connector").ViewConnector;

var eventify = require("../../utils/eventify");
var strategyUtils = require("../../utils/strategy");
var Graph = require("../../utils/graph").Graph;
var config = require("../../config").config;
var globals = require("./globals");
var TestInfo = require("./test-info.js").TestInfo;
var EventTypeArbiter = require("./event-type-arbiter.js").EventTypeArbiter;

var Type = globals.Type;
var Injection = globals.Injection;

var TAG = "collapse-strategy";

/**
 * Configuration.
 */

function Configuration(settings) {
  var self = this;

  this.graphMode = function() {
    return settings.snapshot || settings.superGraphMode;
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
    eventType: settings.eventTypes[0],
    injectOnActionGreaterThanEq: 0,
    servicesInfo: undefined,
    results: undefined,
    
    init: function(saved) {
      if (saved) {
        console.log(TAG, "continuing from saved state (eventType=" + saved.eventType + ", injectOnActionGreaterThanEq=" + saved.injectOnActionGreaterThanEq + ", ...)");
        this.eventType = saved.eventType;
        this.injectOnActionGreaterThanEq = saved.injectOnActionGreaterThanEq;
        this.servicesInfo = saved.servicesInfo;
        this.results = saved.results;
      } else {
        this.eventType = settings.eventTypes[0],
        this.initInjectOnAction();
        this.results = [];
      }
    },

    save: function() {
      return {
        eventType: currentMode.eventType,
        injectOnActionGreaterThanEq: currentMode.injectOnActionGreaterThanEq,
        servicesInfo: currentMode.servicesInfo,
        results: currentMode.results
      };
    },

    initInjectOnAction: function() {
      this.injectOnActionGreaterThanEq = 0;
      console.log(TAG, testLongName.grey, "--->----> init inject on action mode ---->---->-".blue + " :" + this.toString());
    },

    nextInjectOnAction: function(currentState) {
      this.injectOnActionGreaterThanEq = currentState.currentAction;
    },

    eventTypeHasMoreInjectionSites: function(currentState, result) {
      if (settings.stressType == Type.ALL) {
        var failed = currentState.foundError || result.testRunFailed || result.testFailed;
        return !settings.stopOnError && failed && this.injectOnActionGreaterThanEq < currentState.currentAction
      } else {
        var lastConfiguration = settings.configurations[settings.configurations.length - 1];
        return lastConfiguration > currentState.currentAction;
      }      
    },

    nextEventType: function() {
      var eventTypeIndex = settings.eventTypes.indexOf(this.eventType);
      this.eventType = settings.eventTypes[eventTypeIndex + 1];
      this.initInjectOnAction();
      console.log(TAG, testLongName.grey, "--->----> next event type ---->---->-".blue + " :" + this.toString());
    },

    hasMoreEventTypes: function() {
      var eventTypeIndex = settings.eventTypes.indexOf(this.eventType);
      return eventTypeIndex < settings.eventTypes.length - 1;
    },

    nextMode: function(currentState, result) {
      if (this.eventTypeHasMoreInjectionSites(currentState, result)) {
        this.nextInjectOnAction(currentState);
      } else {
        do {
          if (this.hasMoreEventTypes()) {
            this.nextEventType();
          } else {
            console.log(TAG, testLongName.grey, "Done stressing test in all configurations for all event types");
            return false;
          }
        } while (!EventTypeArbiter.eventTypeRelevant(settings, this.eventType, this.servicesInfo));
      }

      return true;
    },

    id: function() {
      var result = [settings.stressType.toLowerCase()];
      if (settings.stressType != "NONE") {
        result.push(this.eventType);
        result.push(settings.graphType);
      }
      if (settings.superGraphMode) result.push("sg");
      if (settings.snapshot) result.push("ss");
      if (settings.collapse) result.push("col");
      if (settings.stopOnError) result.push("stop");
      if (settings.usedServicesMode) result.push("services");
      if (settings.randomInjectionMode) result.push("random");
      return result.join("-");
    },

    toString: function() {
      if (settings.stressType == Type.ALL) {
        return this.id() + "-" + this.injectOnActionGreaterThanEq;
      } else {
        return this.id() + "-" + settings.configurations.join("-") + "-action-" + this.injectOnActionGreaterThanEq;
      }
    }
  };

  var currentState = {
    init: function(defaults) {
      if (!defaults) {
        defaults = {};
      }

      this.restarts = typeof defaults.restarts != "undefined" ? defaults.restarts : 0;
      this.restartLimitReached = 0;
      this.retry = false;

      this.currentAction = 0;
      this.injectionSites = 0;
      this.ignoredInjections = 0;
      this.falsePositives = 0;
      this.foundError = false;
      this.isFiring = false;
      this.firstEspressoAction = true;
      this.paused = false;
      this.graph = new Graph(self.getId(), {
        applicationId: taskInfo.applicationId,
        className: taskInfo.className,
        methodName: taskInfo.methodName,
        graphType: settings.graphType
      });
    }
  };

  this.getId = function() {
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

  this.perform = function(callback, data) {
    strategyUtils.loop(taskInfo, configuration, settings, {
      currentMode: currentMode,
      currentState: currentState,
      Env: Env,
      AndroidObjects: AndroidObjects,
      tools: tools,
      self: self
    }, callback, data);
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
   * Manual tool controls.
   */

  this.continue = function() {
    console.log(TAG, "continue");
    currentState.paused = false;
  };

  /**
   * Implementation of Android hooks
   */

  this.testStarted = strategyUtils.retryify("testStarted", this, function(pid, looper, androidTestRunner) {
    TestInfo.resetIs(looper);
    TestInfo.resetWas(looper);

    if (currentMode.eventType == settings.eventTypes[0] && currentMode.injectOnActionGreaterThanEq == 0) {
      // First run of the test case
      TestInfo.resetHaveBeen(looper);
    }

    AndroidObjects._androidTestRunner = androidTestRunner;
  });

  this.testEnded = strategyUtils.retryify("testEnded", this, function(looper, androidTestRunner, foundError) {
    console.log(TAG, testLongName.grey, foundError ? ("test ended").red : "test ended");
    currentState.foundError = foundError;

    var servicesInfo = TestInfo.haveBeen(looper);
    currentMode.servicesInfo = currentMode.servicesInfo || [];
    servicesInfo.forEach(function(serviceInfo) {
      if (currentMode.servicesInfo.indexOf(serviceInfo.service) < 0) {
        currentMode.servicesInfo.push(serviceInfo.service);
      }
    });

    if (currentMode.eventType == "data-connection-off") {
      looper.fire("data-connection-on");
    }
  });

  this.processCrashed = strategyUtils.retryify("processCrashed", this, function(err) {
    console.log(TAG, testLongName.grey, "process crashed".red, err);
    if (!currentState.retry) {
      currentState.foundError = true;
    }
  });

  this.preAction = strategyUtils.retryify("preAction", this, function(looper, msgInfo) {
    var isEspressoInjectionMessage = msgInfo.isEspressoInjectionMessage();

    if (isEspressoInjectionMessage) {
      if (currentState.firstEspressoAction && configuration.graphMode()) {
        tools.snapshotter.take(looper, { bitmap: settings.snapshot || settings.graphType == "bitmap", dump: true })
        .then(function(snapshot) {
          tools.viewConnector.addSnapshot(snapshot);
        }, function(err) {
          retry("snapshot (preAction)", err);
        });
      }

      if (currentState.firstEspressoAction) {
        currentState.firstEspressoAction = false;
      }
    }

    Env.exec.delayCurrentAction = currentState.isFiring || tools.snapshotter.takingSnapshot || currentState.paused;

    if (!Env.exec.delayCurrentAction && isEspressoInjectionMessage) {
      console.log(TAG, testLongName.grey, "currentAction", currentState.currentAction);
    }
  });

  this.postAction = strategyUtils.retryify("postAction", this, function(looper, msgInfo) {
    var isEspressoInjectionMessage = msgInfo.isEspressoInjectionMessage();

    var injectionDecision = Injection.NONE;

    if (isEspressoInjectionMessage) {
      var messageEventName = strategyUtils.getMessageEventName(msgInfo);

      if (currentMode.injectOnActionGreaterThanEq <= currentState.currentAction
        && (settings.stressType == Type.ALL || settings.configurations.indexOf(currentState.currentAction) >= 0)) {

        if (currentMode.eventType == "pause-stop-restart") {
          // Pause-Stop-Restart strategy
          if (messageEventName == "((is displayed on the screen to the user and with content description: is \"More options\") or (is displayed on the screen to the user and with class name: a string ending with \"OverflowMenuButton\")) single click") {
            console.log(TAG, testLongName.grey, "ignoring false positive".green);
            injectionDecision = Injection.FALSE_POSITIVE;
            currentState.falsePositives++;
          }
        }

        if (injectionDecision != Injection.FALSE_POSITIVE) {

          // We should inject! Ask all our strategies if we can ignore this action!

          // First check if the event type is "relevant", do this before super graph querying!

          if (!EventTypeArbiter.shouldInject(settings, looper, currentMode.eventType, currentState)) {
            injectionDecision = Injection.IGNORE;
          }

          // Now query the super graph (if super graph mode and not ignored)

          if (injectionDecision != Injection.IGNORE) {
            if (settings.superGraphMode) {
              injectionDecision = Reduction.shouldInject(messageEventName);
            } else {
              injectionDecision = Injection.INJECT;
            }
          }
        }

        // Stats

        currentState.injectionSites++;

        if (injectionDecision == Injection.IGNORE) {
          console.log(TAG, testLongName.grey, "ignoring injection".green);
          currentState.ignoredInjections++;
        }

        // Replay mode

        if (settings.replay && injectionDecision == Injection.INJECT) {
          currentState.paused = true;
        }
      }

      function possibleInjection() {
        if (injectionDecision == Injection.INJECT) {
          console.log(TAG, testLongName.grey, "firing");
          currentState.isFiring = true;
          looper.fire(currentMode.eventType);
        }
      }

      if (configuration.graphMode() && (settings.snapshot || injectionDecision != Injection.IGNORE)) {
        var currentEventName = strategyUtils.getMessageEventName(msgInfo);
        tools.snapshotter.take(looper, { bitmap: settings.snapshot || settings.graphType == "bitmap", dump: true })
        .then(function(snapshot) {
          tools.viewConnector.addSnapshot(snapshot, currentEventName, currentState.currentAction);
          possibleInjection();
        }, function(err) {
          retry("snapshot (postAction)", err);
        });
      } else {
        possibleInjection();
      }

      currentState.currentAction++;
    }
  });

  this.preInject = strategyUtils.retryify("preInject", this, function(looper) {
    postInjectSnapshotted = false;
    
    Env.exec.delayCurrentInjection = tools.snapshotter.takingSnapshot || currentState.paused;
  });

  var postInjectSnapshotted = false;
  this.postInject = strategyUtils.retryify("postInject", this, function(looper) {
    // Take snapshot in order to add "injection" edges to graph
    if (settings.snapshot) {
      if (postInjectSnapshotted) {
        console.log(TAG, testLongName.grey, "postInject: already snapshotted".yellow);
      } else {
        tools.snapshotter.take(looper, { bitmap: settings.snapshot || settings.graphType == "bitmap", dump: true })
        .then(function(snapshot) {
          tools.viewConnector.addSnapshot(snapshot, currentMode.eventType, undefined, true);
        }, function(err) {
          retry("snapshot (postInject)", err);
        });
        postInjectSnapshotted = true;
      }
    }

    currentState.isFiring = false;
    if (settings.replay) {
      currentState.paused = true;
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
      shouldInject: function(messageEventName) {
        var result = Injection.INJECT;
        
        var graph = currentState.graph;

        var node = graph.getNodeById(graph.data.lastNodeId);
        var superNode = getSuperNode(node);

        var edgeLabel = currentMode.eventType + "\n" + messageEventName;

        if (result == Injection.INJECT) {
          if (edgeLabel == defaultEdgeLabel) {
            console.log(TAG, testLongName.grey, "not ignoring, edge.label is unknown".red);
          } else if (superNode && superNode.outgoingEdges.find(function(superEdge) { return edgeLabel == superEdge.label; })) {
            result = Injection.IGNORE;
          }
        }

        // Add current node to super graph, or create if not there
        if (!superNode) {
          superNode = tools.viewConnector.addNodeToSuperGraph(node, true);
          nodeToSuperNodeIds[node.id] = superNode.id;
        }

        // Add incoming edge to super graph
        if (typeof newSuperGraphNodeObserver == "function") {
          newSuperGraphNodeObserver(superNode);
          newSuperGraphNodeObserver = undefined;
        }

        if (result == Injection.INJECT) {
          // Add outgoing edge to super graph
          newSuperGraphNodeObserver = function(superNodeTo) {
            globals.superGraph.connect(superNode, superNodeTo, edgeLabel);
          };
        }

        return result;
      }
    };
  })();
}

/**
 * Exports.
 */

exports.Configuration = Configuration;
exports.Strategy = Strategy;