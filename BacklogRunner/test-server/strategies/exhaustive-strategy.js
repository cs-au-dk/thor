require("colors");

var sh = { exec: require("child_process").execSync };
var seedrandom = require("seedrandom");

var eventify = require("../../utils/eventify");
var strategyUtils = require("../../utils/strategy");
var config = require("../../config").config;
var globals = require("./globals");

var Type = globals.Type;
var Injection = globals.Injection;

var TAG = "exhaustive-strategy";

/**
 * Configuration.
 */

function Configuration(settings) {
  var self = this;

  this.graphMode = function() {
    return false;
  };
}

function Strategy(taskInfo, configuration, settings) {
  var self = this;

  /* Provide hooks for other strategies */
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
    seeds: undefined,
    execution: 0,

    init: function (saved) {
      if (saved) {
        console.log(TAG, "continuing from saved state (seed=" + saved.seed + ")");
        this.results = saved.results;
        this.seeds = saved.seeds;
        this.execution = saved.execution;
      } else {
        this.results = [];
        this.seeds = settings.seeds.length == settings.limit ? settings.seeds : [];
        for (var i = settings.seeds.length; i < settings.limit; i++) {
          this.seeds.push(Math.random().toString());
        }
        this.execution = 0;
      }
    },

    save: function () {
      return {
        results: currentMode.results,
        seeds: currentMode.seeds,
        execution: currentMode.execution
      };
    },

    getCoinFlipper: function() {
      var currentSeed = this.seeds[this.execution];
      var oldSeed = this.getCoinFlipper.seed;
      if (!oldSeed || currentSeed != oldSeed) {
        this.getCoinFlipper.seed = currentSeed;
        this.getCoinFlipper.rnd = seedrandom(currentSeed);
      }

      var rnd = this.getCoinFlipper.rnd;

      if (rnd() >= 2/3) {
        return function() { return false; };
      } else {
        return function() { return Math.round(rnd()) == 0; };
      }
    },

    nextMode: function(currentState, result) {
      return this.execution < settings.limit;
    },

    id: function () {
      var result = [settings.stressType.toLowerCase()];
      result.push(settings.limit);
      result.push("execution");
      result.push(this.execution);
      result.push("seed");
      result.push(this.seeds[this.execution]);
      return result.join("-");
    },

    toString: function () {
      return this.id() // TODO: + this.seeds[this.execution] ???
    }
  };

  var currentState = {
    init: function (defaults) {
      if (!defaults) {
        defaults = {};
      }

      this.currentEvent = 0;
      this.currentAction = 0;
      this.restarts = typeof defaults.restarts != "undefined" ? defaults.restarts : 0;
      this.restartLimitReached = 0;
      this.retry = false;
      this.foundError = false;
      this.isFiring = false;
      this.firstEspressoAction = true;
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
    viewConnector: undefined,

    init: function() {
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
    self.unregister();
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

    var coin = currentMode.getCoinFlipper();
    while (currentState.currentEvent < settings.eventTypes.length) {
      var eventType = settings.eventTypes[currentState.currentEvent++];
      if (eventType == "pause-stop-restart" && messageEventName == "((is displayed on the screen to the user and with content description: is \"More options\") or (is displayed on the screen to the user and with class name: a string ending with \"OverflowMenuButton\")) single click") {
        console.log(TAG, testLongName.grey, "nextToInject(" + eventType + "): false (ignoring false positive)");
      } else if (coin()) {
        console.log(TAG, testLongName.grey, "nextToInject(" + eventType + "): true");
        return eventType;
      } else {
        console.log(TAG, testLongName.grey, "nextToInject(" + eventType + "): false");
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
    } else {
      // console.log(TAG, testLongName.grey, "preAction");
    }

    Env.exec.delayCurrentAction = currentState.isFiring;

    if (!Env.exec.delayCurrentAction && isEspressoInjectionMessage) {
      console.log(TAG, testLongName.grey, "currentAction", currentState.currentAction);
    }
  });

  this.postAction = strategyUtils.retryify("postAction", this, function (looper, msgInfo) {
    var isEspressoInjectionMessage = msgInfo.isEspressoInjectionMessage();

    currentState.currentEvent = 0;

    if (isEspressoInjectionMessage) {
      var messageEventName = strategyUtils.getMessageEventName(msgInfo);

      // console.log(TAG, testLongName.grey, "postAction", messageEventName.grey);

      var injectionEvent = nextToInject(messageEventName);

      if (injectionEvent != undefined) {
        console.log(TAG, testLongName.grey, "firing " + injectionEvent);
        currentState.isFiring = true;
        looper.fire(injectionEvent);
      }

      currentState.currentAction++;
    } else {
      // console.log(TAG, testLongName.grey, "postAction");
    }
  });

  this.preInject = strategyUtils.retryify("preInject", this, function (looper) {
    // console.log(TAG, testLongName.grey, "preInject");
  });

  this.postInject = strategyUtils.retryify("postInject", this, function (looper) {
    // console.log(TAG, testLongName.grey, "postInject");

    var injectionEvent = nextToInject();

    if (injectionEvent != undefined) {
      console.log(TAG, testLongName.grey, "firing " + injectionEvent);
      currentState.isFiring = true;
      looper.fire(injectionEvent);
    } else {
      currentState.isFiring = false;
    }
  });
}

/**
 * Exports.
 */

exports.Configuration = Configuration;
exports.Strategy = Strategy;
