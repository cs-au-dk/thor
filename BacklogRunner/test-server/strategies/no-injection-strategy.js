var colors = require("colors");
var mkdirp = require("mkdirp");
var fs = require("fs");

var Statistics = require("./statistics").Statistics;
var Coverage = require("../coverage").Coverage;
var Snapshotter = require("../../utils/snapshotter").Snapshotter;
var ViewConnector = require("../../utils/view-connector").ViewConnector;

var eventify = require("../../utils/eventify");
var strategyUtils = require("../../utils/strategy");
var Graph = require("../../utils/graph").Graph;
var config = require("../../config").config;
var globals = require("./globals");

var TAG = "no-injection-strategy";

function Strategy(taskInfo, settings) {
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
    results: undefined,

    init: function (saved) {
      if (saved) {
        console.log(TAG, "continuing from saved state");
        this.results = saved.results;
      } else {
        this.results = [];
      }
    },

    save: function () {
      return {
        results: currentMode.results
      };
    },

    nextMode: function() {
      return false;
    },

    id: function() {
      var result = [settings.stressType.toLowerCase()];
      if (settings.snapshot) result.push("ss");
      return result.join("-");
    },

    toString: function() {
      return "none";
    }
  };

  var currentState = {
    init: function(defaults) {
      if (!defaults) {
        defaults = {};
      }

      this.currentAction = 0;
      this.injectionSites = 0;
      this.firstEspressoAction = true;
      this.retry = false;
      this.restarts = typeof defaults.restarts != "undefined" ? defaults.restarts : 0;
      this.restartLimitReached = 0;
      this.pid = -1;

      if (settings.snapshot && typeof this.graph == "undefined") {
        this.graph = new Graph(self.getId());
      } else if (typeof this.graph != "undefined") {
        this.graph.reset(self.getId())
      }
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
    strategyUtils.loop(taskInfo, undefined, settings, {
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
    currentState.retry = true
    console.log(TAG, testLongName.grey, "retrying".red);
    sh.exec("adb -s " + Env.device.serial + " shell am force-stop " + taskInfo.applicationId);
    self.unregister([tools.stats, tools.coverage, tools.snapshotter]);
  };
  
  /**
   * Hook implementations.
   */

  this.testStarted = strategyUtils.retryify("testStarted", this, function(pid, looper, androidTestRunner) {
    AndroidObjects.androidTestRunner = androidTestRunner;
  });

  this.testEnded = strategyUtils.retryify("testEnded", this, function(looper, androidTestRunner, foundError) {
    console.log(TAG, testLongName.grey, foundError ? "test ended".red : "testEnded");
  });

  this.preAction = strategyUtils.retryify("preAction", this, function(looper, msgInfo) {
    var isEspressoInjectionMessage = msgInfo.isEspressoInjectionMessage();
    if (isEspressoInjectionMessage) {
      if (currentState.firstEspressoAction && settings.snapshot) {
        tools.snapshotter.take(looper, { bitmap: settings.snapshot || settings.graphType == "bitmap", dump: true })
        .then(function(snapshot) {
          tools.viewConnector.addSnapshot(snapshot);
        }, function(err) {
          retry("snapshot (preAction)", err);
        })
        .done();
      }

      if (currentState.firstEspressoAction) {
        currentState.firstEspressoAction = false;
      }
    }

    Env.exec.delayCurrentAction = tools.snapshotter.takingSnapshot;

    if (!Env.exec.delayCurrentAction && isEspressoInjectionMessage) {
      console.log(TAG, testLongName.grey, "currentAction", currentState.currentAction);
    }
  });

  this.postAction = strategyUtils.retryify("postAction", this, function(looper, msgInfo) {
    if (msgInfo.isEspressoInjectionMessage()) {
      if (settings.snapshot) {
        var currentEventName = strategyUtils.getMessageEventName(msgInfo);
        tools.snapshotter.take(looper, { bitmap: settings.snapshot || settings.graphType == "bitmap", dump: true })
        .then(function(snapshot) {
          tools.viewConnector.addSnapshot(snapshot, currentEventName, currentState.currentAction);
        }, function(err) {
          retry("snapshot (postAction)", err);
        })
        .done();
      }

      currentState.currentAction++;
      currentState.injectionSites++;
    }
  });
}

/**
 * Hooks.
 */

exports.Strategy = Strategy;