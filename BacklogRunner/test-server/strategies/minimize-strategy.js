require("colors");

var sh = { exec: require("child_process").execSync };

var Statistics = require("./statistics").Statistics;

var eventify = require("../../utils/eventify");
var strategyUtils = require("../../utils/strategy");
var config = require("../../config").config;
var globals = require("./globals");

var Type = globals.Type;
var Injection = globals.Injection;

var TAG = "minimize-strategy";

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
    eventType: settings.eventTypes[0],
    buggyEventType: undefined,
    lowerBound: settings.minimize.lowerBound,
    upperBound: settings.minimize.upperBound,
    bestLowerBound: settings.minimize.lowerBound,
    bestUpperBound: settings.minimize.upperBound,
    worstLowerBound: settings.minimize.lowerBound,
    worstUpperBound: settings.minimize.upperBound,
    eventTypeSearches: 0,
    injectionSiteSearches: 0,
    last: false,
    results: undefined,

    init: function (saved) {
      if (saved) {
        console.log(TAG, "continuing from saved state (eventType=" + saved.eventType + ", lowerBound=" + this.lowerBound + ", upperBound=" + this.upperBound + ")");
        this.eventType = saved.eventType;
        this.buggyEventType = saved.buggyEventType;
        this.lowerBound = saved.lowerBound;
        this.upperBound = saved.upperBound;
        this.bestLowerBound = saved.bestLowerBound;
        this.bestUpperBound = saved.bestUpperBound;
        this.worstLowerBound = saved.worstLowerBound;
        this.worstUpperBound = saved.worstUpperBound;
        this.eventTypeSearches = saved.eventTypeSearches;
        this.injectionSiteSearches = saved.injectionSiteSearches;
        this.last = saved.last;
        this.results = saved.results;
      } else {
        this.eventType = settings.eventTypes[0],
        this.buggyEventType = undefined;
        this.lowerBound = settings.minimize.lowerBound;
        this.upperBound = settings.minimize.upperBound;
        this.bestLowerBound = settings.minimize.lowerBound; 
        this.bestUpperBound = settings.minimize.upperBound;
        this.worstLowerBound = settings.minimize.lowerBound;
        this.worstUpperBound = settings.minimize.upperBound;
        this.eventTypeSearches = 0;
        this.injectionSiteSearches = 0;
        this.last = false;
        this.results = [];
      }
    },

    save: function () {
      return {
        eventType: currentMode.eventType,
        buggyEventType: currentMode.buggyEventType,
        lowerBound: currentMode.lowerBound,
        upperBound: currentMode.upperBound,
        bestLowerBound: currentMode.bestLowerBound,
        bestUpperBound: currentMode.bestUpperBound,
        worstLowerBound: currentMode.worstLowerBound,
        worstUpperBound: currentMode.worstUpperBound,
        eventTypeSearches: currentMode.eventTypeSearches,
        injectionSiteSearches: currentMode.injectionSiteSearches,
        last: currentMode.last,
        results: currentMode.results
      };
    },

    hasMoreEventTypes: function() {
      var eventTypeIndex = settings.eventTypes.indexOf(this.eventType);
      return eventTypeIndex < settings.eventTypes.length - 1;
    },

    nextEventType: function() {
      var eventTypeIndex = settings.eventTypes.indexOf(this.eventType);
      this.eventType = settings.eventTypes[eventTypeIndex + 1];
      console.log(TAG, testLongName.grey, "--->----> next event type ---->---->-".blue + " :" + this.toString());
    },

    mid: function() {
      var mid = Math.floor((this.lowerBound + this.upperBound) / 2);
      return this.lowerBound == mid ? Math.min(this.upperBound, mid+1) : mid;
    },

    nextMode: function(currentState, result) {
      var failed = currentState.foundError || result.testRunFailed || result.testFailed;

      if (!this.buggyEventType) {
        this.eventTypeSearches++;

        if (failed) {
          // We found the event type causing problems
          this.buggyEventType = this.eventType;

          if (this.upperBound == Number.POSITIVE_INFINITY) {
            console.log(TAG, testLongName.grey, "nextMode: upperBound=INFINITY -> upperBound=" + currentState.currentAction);
            this.upperBound = currentState.currentAction;
            this.bestUpperBound = currentState.currentAction;
            this.worstUpperBound = currentState.currentAction;
          }
        } else if (this.hasMoreEventTypes()) {
          // No error detected, try the next event type
          this.nextEventType();
        } else {
          // None of the selected event types caused problems
          console.log(TAG, testLongName.grey, "nothing to minimize".green);
          return false;
        }
      } else {
        this.injectionSiteSearches++;

        if (this.last || (failed && this.mid() == this.upperBound)) {
          var worst = this.worstUpperBound - this.worstLowerBound + 1;
          if (failed) {
            // New best bounds
            this.bestLowerBound = this.mid();
            this.bestUpperBound = this.upperBound;

            console.log(TAG, testLongName.grey, ("succeeded in minimizing (from " + worst + ")").green);
          } else {
            var best = this.bestUpperBound - this.bestLowerBound + 1;
            console.log(TAG, testLongName.grey, ("failed to minimize (from " + worst + " to " + best + ")").red);
          }
          return false;
        }

        if (failed) {
          // New best bounds
          this.bestLowerBound = this.lowerBound;
          this.bestUpperBound = this.upperBound;

          // We always inject in the right half, so increase lower bound
          this.lowerBound = this.mid();
        } else {
          // We always inject in the right half, so decrease upper bound
          // (minus 1 because it succeeded although we injected in mid)
          this.upperBound = Math.max(this.lowerBound, this.mid()-1);
        }

        if (this.lowerBound == this.upperBound) {
          this.last = true;
        }
      }

      console.log(TAG, testLongName.grey, "nextMode: lowerBound=" + this.lowerBound + ", mid=" + this.mid() + ", upperBound=" + this.upperBound);

      return true;
    },

    id: function () {
      var result = [settings.stressType.toLowerCase()];
      if (!this.buggyEventType) {
        result.push(this.eventType);
      } else {
        result.push(this.buggyEventType);
        result.push(this.lowerBound);
        result.push(this.mid());
        result.push(this.upperBound);
      }
      return result.join("-");
    },

    toString: function () {
      return this.id()
    }
  };

  var currentState = {
    init: function (defaults) {
      if (!defaults) {
        defaults = {};
      }

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
      this.stats = new Statistics(taskInfo, settings);
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
    }, callback, data);
  };

  /**
   * Error handling
   */

  this.retry = function(name, err) {
    console.log(TAG, testLongName.grey, ("retrying due to " + name).red, err, err.stack);
    currentState.retry = true;
    sh.exec(config.adbPath + "/adb -s " + Env.device.serial + " shell am force-stop " + taskInfo.applicationId);
    self.unregister([tools.stats]);
  };

  /**
   * Utils
   */

  function nextToInject(messageEventName) {
    var eventType;
    if (!currentMode.buggyEventType) {
      eventType = currentMode.eventType;
    } else {
      if (currentState.currentAction >= currentMode.mid() && currentState.currentAction <= currentMode.upperBound) {
        eventType = currentMode.buggyEventType;
      }
    }

    if (eventType == "pause-stop-restart" && messageEventName == "((is displayed on the screen to the user and with content description: is \"More options\") or (is displayed on the screen to the user and with class name: a string ending with \"OverflowMenuButton\")) single click") {
      console.log(TAG, testLongName.grey, "nextToInject(" + eventType + "): false (ignoring false positive)");
      return;
    }

    return eventType;
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

    if (isEspressoInjectionMessage) {
      var messageEventName = strategyUtils.getMessageEventName(msgInfo);

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
    currentState.isFiring = false;
  });
}

/**
 * Exports.
 */

exports.Configuration = Configuration;
exports.Strategy = Strategy;
