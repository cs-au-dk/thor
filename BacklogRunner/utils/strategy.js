var globals = require("../test-server/strategies/globals");
var config = require("../config").config;

var TAG = "strategy";

function loop(taskInfo, configuration, settings, strategy, callback, data) {
  console.log(TAG, taskInfo.methodName.grey, ("--->----> begin ---->---->-").blue);

  var currentMode = strategy.currentMode;
  var currentState = strategy.currentState;
  var Env = strategy.Env;
  var tools = strategy.tools;

  configuration && configuration.init && configuration.init(data);
  currentState && currentState.init && currentState.init();
  currentMode && currentMode.init && currentMode.init(data && data.saved && data.saved.currentMode);

  if (configuration && configuration.graphMode()) {
    globals.superGraph.memorize();
  }

  function looper(device) {
    if (!device) {
      globals.emulatorPool.pick(function (device) {
        Env.exec = device.testManagerInterface.Execution;
        Env.device = device;

        tools.init();

        device.testManagerInterface.hookify(strategy.self);

        looper(device);
      });
      return;
    }

    console.log(TAG, taskInfo.methodName.grey, ("--->----> on device: " + device + " ------>---->-").blue);

    strategy.self.register();
    tools.stats && tools.stats.register(Env.device, strategy);
    tools.coverage && tools.coverage.register(Env.device, strategy);

    device.androidInterface.runTest(currentMode, taskInfo, settings, function (result) {
      strategy.self.unregister([tools.stats, tools.coverage, tools.snapshotter]);

      if (result.missingApk) {
        console.log(TAG, "Missing apk for " + taskInfo.className + "." + taskInfo.methodName + " on " + device + " retrying")
        taskInfo.install = true;
        currentState.init();
        looper(device);
      } else {
        taskInfo.install = false;

        if (result.emulatorBroken) {
          // Restart
          console.log(TAG, taskInfo.methodName.grey, "result.emulatorBroken".red);
          // globals.superGraph.undo();

          device.forceKill(function () {
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
          console.log(TAG, taskInfo.methodName.grey, "currentState.retry".red);
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
            var dir = config.modules.graph.outDir + "/" + strategy.self.getId();
            var remoteDir = config.modules.graph.remoteDir + "/" + strategy.self.getId();
            
            result.paths = result.paths || {};
            result.remotePaths = result.remotePaths || {};

            result.paths.graph = dir + "/" + currentState.graph.name + ".dot";
            result.remotePaths.graph = remoteDir + "/" + currentState.graph.name + ".dot";

            currentState.graph.dump(dir);
          }

          currentMode.results.push(result);

          if (configuration && configuration.graphMode()) {
            globals.superGraph.memorize();
          }

          next(result);
        }
      }
    });

    function save() {
      strategy.self.notifyListeners("progress", {
        currentMode: currentMode.save()
      });
    }

    function next(result) {
      currentMode.execution++;

      tools.stats && tools.stats.commit(currentMode.id(), currentState);

      if (currentMode.nextMode(currentState, result)) {
        save();
        currentState.init();
        looper(device);
      } else {
        tools.stats && tools.stats.commit(taskInfo.name, undefined, currentMode); // Used in minimize?
        done();
      }
    }

    function done() {
      console.log(TAG, taskInfo.methodName.grey, "-->------>---  all modes explored --|-----|----|-".blue);
      device.androidInterface.aggregateTests(taskInfo, currentMode.results, function (error) {
        if (error) {
          callback({ error: "Could not aggregate" });
        } else {
          var callbackArg = {};
          for (var i = 0; i < currentMode.results.length; i++) {
            var result = currentMode.results[i];
            if (result.testFailed) {
              callbackArg.testFailed = true;
            }
            if (result.testRunFailed) {
              callbackArg.testRunFailed = true;
            }
          }
          callback(callbackArg, device.androidInterface);
        }
      });
      device.recycle();
    }
  }

  looper();
}

function retryify(name, strategy, f) {
  return function () {
    try {
      f.apply(strategy, arguments);
    }
    catch (err) {
      strategy.retry.apply(strategy, [name, err]);
    }
  };
}

function getMessageEventName(msgInfo) {
  var viewMatcher = "?";
  var action = "?";

  if (msgInfo.containsActionDetails()) {
    try {
      viewMatcher = msgInfo.interaction().viewMatcher().toString();
    } catch (err) {
    }

    try {
      action = msgInfo.action().getDescription();
    } catch (err) {
    }
  }

  return (viewMatcher + " " + action).trim();
}

exports.loop = loop;
exports.retryify = retryify;
exports.getMessageEventName = getMessageEventName;