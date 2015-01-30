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

var TAG = "one-by-one-strategy";

/**
 * Configuration.
 */

function Configuration(settings) {
  var self = this;

  this.configurations = settings.configurations;

  this.graphMode = function() {
    return settings.snapshot;
  };

  // Misc.

  this.init = function(data) {
    if (settings.stressType == Type.ALL && data && data.configurations) {
      self.configurations = data.configurations;
    }
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
    injectOnAction: 0,
    results: undefined,

    init: function(saved) {
      if (saved) {
        this.eventType = saved.eventType;
        this.injectOnAction = saved.injectOnAction;
        this.results = saved.results;
      } else {
        this.eventType = settings.eventTypes[0];
        this.initInjectOnAction();
        this.results = [];
      }
    },

    save: function () {
      return {
        eventType: currentMode.eventType,
        injectOnActionGreaterThanEq: currentMode.injectOnActionGreaterThanEq,
        servicesInfo: currentMode.servicesInfo,
        results: currentMode.results
      };
    },

    initInjectOnAction: function() {
      // For the all strategy, configurations are passed to Configuration.init by the preprocessing strategy
      this.injectOnAction = configuration.configurations[0];
      console.log(TAG, testLongName.grey, "--->----> init inject on action mode ---->---->-".blue + " :" + this.toString());
    },

    nextInjectOnAction: function() {
      var configurationIndex = configuration.configurations.indexOf(this.injectOnAction);
      this.injectOnAction = configuration.configurations[configurationIndex + 1];
      console.log(TAG, testLongName.grey, "--->----> next inject on action ---->---->-".blue + " :" + this.toString());
    },

    eventTypeHasMoreInjectionSites: function() {
      var configurationIndex = configuration.configurations.indexOf(this.injectOnAction);
      return configurationIndex < configuration.configurations.length - 1;
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

    nextMode: function(currentState) {
      if (currentState.foundError) {
        if (settings.stopOnError) {
          // Found error, stop further testing
          console.log(TAG, testLongName.grey, "Found error during stress testing, quitting");
          return false;
        }
      }

      var oldCurrentEventType = this.eventType;

      if (this.eventTypeHasMoreInjectionSites()) {
        this.nextInjectOnAction();
      } else {
        if (this.hasMoreEventTypes()) {
          this.nextEventType();
        } else {
          console.log(TAG, testLongName.grey, "Done stressing test in all configurations for all event types");
          return false;
        }
      }
  
      return true;
    },

    id: function() {
      var result = [settings.stressType.toLowerCase()];
      if (settings.stressType != "NONE") {
        result.push(this.eventType);
        result.push(settings.graphType);
      }
      if (settings.snapshot) result.push("ss");
      if (settings.collapse) result.push("col");
      if (settings.stopOnError) result.push("stop");
      if (settings.usedServicesMode) result.push("services");
      if (settings.randomInjectionMode) result.push("random");
      result.push(this.injectOnAction);
      return result.join("-");
    },

    toString: function() {
      return settings.stressType.toLowerCase() + "-" + this.eventType + "-C" + this.injectOnAction + "-" + (configuration.configurations.length-1);
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
   * Utils
   */

  var preActionView = undefined;

  /**
   * Implementation of Android hooks
   */

  this.testStarted = strategyUtils.retryify("testStarted", this, function(pid, looper, androidTestRunner) {
    AndroidObjects.androidTestRunner = androidTestRunner;
  });

  this.testEnded = strategyUtils.retryify("testEnded", this, function(looper, androidTestRunner, foundError) {
    console.log(TAG, testLongName.grey, foundError ? ("test ended").red : "test ended");
    currentState.foundError = foundError;
  });

  this.processCrashed = strategyUtils.retryify("testEnded", this, function(err) {
    console.log(TAG, "process crashed".red, err);
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
      if (currentState.currentAction == currentMode.injectOnAction) {

        if (currentMode.eventType == "pause-stop-restart") {
          // Pause-Stop-Restart strategy
          if (strategyUtils.getMessageEventName(msgInfo) == "((is displayed on the screen to the user and with content description: is \"More options\") or (is displayed on the screen to the user and with class name: a string ending with \"OverflowMenuButton\")) single click") {
            console.log(TAG, testLongName.grey, "ignoring false positive".green);
            injectionDecision = Injection.FALSE_POSITIVE;
            currentState.falsePositives++;
          }
        }

        if (injectionDecision != Injection.FALSE_POSITIVE) {
          injectionDecision = Injection.INJECT;
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
    }

    var possibleInjection = function() {
      if (injectionDecision == Injection.INJECT) {
        console.log(TAG, testLongName.grey, "firing");
        currentState.isFiring = true;
        looper.fire(currentMode.eventType);
      }
    };

    if (isEspressoInjectionMessage) {
      if (configuration.graphMode() && (settings.snapshot || injectionDecision != Injection.IGNORE)) {
        var currentEventName = strategyUtils.getMessageEventName(msgInfo);
        tools.snapshotter.take(looper, { bitmap: settings.snapshot || settings.graphType == "bitmap", dump: true })
        .then(function(snapshot) {
          tools.viewConnector.addSnapshot(snapshot, currentEventName, currentState.currentAction);
          preActionView = snapshot.view;
          possibleInjection();
        });
      } else {
        possibleInjection();
      }

      currentState.currentAction++;
    }
  });

  var preInjectSnapshotted = false; // put into currentState?

  this.preInject = strategyUtils.retryify("preInject", this, function(looper) {
    postInjectSnapshotted = false;

    if (settings.ignoreNoEffectMode && !settings.snapshot) {
      // Only take snapshot if not snapshot mode (otherwise snapshot already taken in post action)
      if (!preInjectSnapshotted) {
        tools.snapshotter.take(looper, { bitmap: settings.snapshot || settings.graphType == "bitmap", dump: true })
        .then(function(snapshot) {
          preActionView = snapshot.view;
        });
        preInjectSnapshotted = true;
      }
    }

    Env.exec.delayCurrentInjection = tools.snapshotter.takingSnapshot || currentState.paused;
  });

  var postInjectSnapshotted = false;

  this.postInject = strategyUtils.retryify("postInject", this, function(looper) {
    preInjectSnapshotted = false;

    if (settings.ignoreNoEffectMode && !postInjectSnapshotted) {
      tools.snapshotter.take(looper, { bitmap: settings.snapshot || settings.graphType == "bitmap", dump: true })
      .then(function(snapshot) {
        if (typeof preActionView != "undefined") {
          if (snapshot.view == preActionView) {
            if (currentMode.eventTypeHasMoreInjectionSites()) {
              currentState.ignoredInjections++;
              currentMode.nextInjectOnAction();
            }
          } else {
            console.log(TAG, testLongName.grey, "ignore-no-effect-mode: injection did have effect".red);
          }
        } else {
          console.log(TAG, testLongName.grey, "ignore-no-effect-mode: expected preActionView".red);
        }
      });
      postInjectSnapshotted = true;
    }

    currentState.isFiring = false;
    if (settings.replay) {
      currentState.paused = true;
    }
  });
}

/**
 * Hooks.
 */

exports.Configuration = Configuration;
exports.Strategy = Strategy;