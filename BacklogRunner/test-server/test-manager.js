var fs = require("fs");
var extend = require("node.extend");

var utils = require("../utils/utils");
var emulator = require("../utils/emulator");
var testServer = require("./test-server");
var config = require("./../config").config;
var path = require("path");
var exec = require("child_process").exec;
var execFile = require("child_process").execFile;
var spawn = require('child_process').spawn
var colors = require("colors");

var TAG = "test-manager";


/**
 * Test manager interface.
 */

function TestManagerInterface(device) {
  var self = this;
  
  var hooks = ["testStarted", "testEnded", "preAction", "postAction", "preInject", "postInject", "postFire", "foundError", "sendViewState", "waitForDispatch", "autoDispatch", "messageEnqueued", "processCrashed"];
  
  eventify(self, hooks);

  this.Execution = {
    delayCurrentAction: false,
    delayCurrentInjection: false,
    blockMessages: false
  }


  this.log = function(args) {
    console.log(TAG, args);
  };

  this.close = function() {
    try {
      self.server.close();
    }
    catch (err) {
      console.log(TAG, "error closing server".red, err);
    }
  };

  this.hookify = function(strategy) {
    strategy.register = function() {
      hooks.forEach(function(hookName) {
        if (typeof strategy[hookName] == "function") {
          self.addObserver(hookName, strategy[hookName], strategy);
        }
      });
    };

    strategy.unregister = function(objs) {
      hooks.forEach(function(hookName) {
        if (typeof strategy[hookName] == "function") {
          self.removeObserver(hookName, strategy[hookName]);
        }
        self.removeObserverByOwner(hookName, strategy);
      });

      if (objs) {
        objs.forEach(function(obj) {
          obj && obj.unregister(self);
        });
      }
    };
  };
  
  this.server = testServer.start(device);
}

/**
 * Android interface.
 */

function AndroidInterface(device) {
  var self = this;

  function aggregateTests(taskInfo, results, callback) {
    var uid = taskInfo.title;
    var testLongName = taskInfo.methodName

    var bigInstance = (results.length > 20)

    params = ["-jar", "-XX:-UseConcMarkSweepGC", (bigInstance?"-Xms6g":"-Xms512m"), (bigInstance?"-Xmx6g":"-Xmx1g"), config.spoonPath, "--noprettify", "--aggregateout", config.modules.spoonrunner.outDir + "/" + uid];
    results.forEach(function(res) {
      var path = res.outputPath + "/result.json";
      if (fs.existsSync(path)) {
        params.push("--aggregate", path);
      } else {
        console.log(TAG, "missing result file for path".red, path);
      }
    });
    var rn = spawn("java", params, { env: process.env });
    var pid = parseInt(rn.pid);

    /*TODO: Remove this workaround, this is a workaround for processes that are quitting, but not sending an exit event
    * to detect this, we look at the processes, if the pid is no more there, then we are allowed to proceed anyway.
    */
    var gone = false;
    var wd = setInterval(function() {
      try {
        var rt = exec("ps -e | grep " + pid + " | grep -v grep", function (error, stdout, stderr) {
          if(stdout.toString().trim() == "" && pid > 0) {
            if(!gone) {
              console.log(TAG, testLongName.grey, "the aggregating process " + pid + " exited, but we are still here !!! ".red);
              gone = true;
            }
            else {
              console.log(TAG, testLongName.grey, "the spoonrun process " + pid + " exited by a long time now, and we haven't received an exit !!! ".red);
              
              console.log(TAG, testLongName.grey, ("FAKE Aggregated " + pid).red )      
              pid = -1;
              clearInterval(wd);
              callback(false);
            }
          }
        })
      }
      catch(err){}
    }, 6000)

    // console.log(TAG, testLongName.grey, "aggregating " + pid)
    var stdout = "";
    var stderr = "";
    rn.stdout.on('data', function (data) {
      stdout += data.toString()
    });

    rn.stderr.on('data', function (data) {
      stderr += data.toString()
    });

    rn.on('exit', function (code) {
      // console.log(TAG, testLongName.grey, "aggregated " + pid)
      if(pid > 0) {
        pid = -1;
        clearInterval(wd);
        callback(code != 0)
      }
    });
  }

  function androidRunTest(mode, taskInfo, settings, callback) {

    var testLongName = taskInfo.methodName

    var result = {};
    
    var params = getParams(mode, taskInfo, settings);
    result.outputPath = params.outPath;
    
    // console.log(TAG, testLongName.grey, "spoonRun started");

    var rn = spawn("java", params.vals, { env: process.env })  

    var pid = parseInt(rn.pid);
    
    var stdout = ""
    var stderr = ""
    
    var exitHandler = function(code) {
      // console.log(TAG, testLongName.grey, "normal callback");
      pid = -1;
      clearInterval(wd);

      result.testFailed = stdout.indexOf("STRL.testFailed") >= 0;
      result.testRunFailed = stdout.indexOf("STRL.testRunFailed") >= 0 || (!result.testFailed && code != 0);

      if (stdout.indexOf("IllegalStateException") >= 0) {
        console.log(TAG, "emulator broken: IllegalStateException".red);
        result.emulatorBroken = true;
      } else if (stdout.indexOf("IllegalArgumentException: Unknown device serial") >= 0) {
        console.log(TAG, "emulator broken: IllegalArgumentException".red);
        result.emulatorBroken = true;
      }
      
      var thereIsProblem = function(str) {
        if(str.indexOf("Unable to find instrumentation target package") >= 0 || 
        str.indexOf("Unable to find instrumentation info for: ComponentInfo") >= 0) {
          console.log(TAG, testLongName.grey, "Error: missing instrumentation, maybe app not installed".red);
          return true;
        }
        else if(str.indexOf("SDK path not specified") >= 0) {
          console.log(TAG, testLongName.grey, "Error: SDK path not specified, check your ANDROID_HOME".red);
          return true;
        }
        else if(str.indexOf("APK path does not exist") >= 0) {
          console.log(TAG, testLongName.grey, "Error: APK path does not exist".red);
          return true;
        } else if (str.indexOf("InstallException on device") >= 0) {
          console.log(TAG, testLongName.grey, "Error: Install exception on device (likely timeout)".red);
          return true;
        }
        else
          return false;
      }

      result.missingApk = thereIsProblem(stdout) || thereIsProblem(stderr)

      callback(result);
    }
    /*TODO: Remove this workaround, this is a workaround for processes that are quitting, but not sending an exit event
    * to detect this, we look at the processes, if the pid is no more there, then we are allowed to proceed anyway.
    */
    var gone = false;
    var wd = setInterval(function() {
      var rt = exec("ps -e | grep " + pid + " | grep -v grep", function (error, stdout, stderr) {
        if(stdout.toString().trim() == "" && pid > 0) {
          
          if(!gone) {
            console.log(TAG, testLongName.grey, "the spoonrun process " + pid + " exited, but we are still here !!! ".red);
            gone = true;
          }
          else {
            console.log(TAG, testLongName.grey, "the spoonrun process " + pid + " exited by a long time now, and we haven't received an exit !!! ".red);
            pid = -1;

            exitHandler(0)
          }
        }
      })
    }, 12000)


    rn.stdout.on("data", function(data){
      stdout += data;
      /* TODO: ANOTHER WORKAROUND */
      // console.log(data.toString());
      if(data.toString().indexOf("EXIT-HOOK") >= 0) {
        // console.log(TAG, testLongName.grey, "Test-ended detected, spoon has now called halt/exit ")
        setTimeout( function() {
          // console.log(TAG, testLongName.grey, "waited 5 seconds now " + (pid>0 ? " process has not called exit".red : "process exited by himself"))
          if( pid > 0) {
            var rt = exec("ps -e | grep " + pid + " | grep -v grep", function (error, stdout, stderr) {
              if(stdout.toString().trim() != "") {
                console.log(TAG, testLongName.grey, "the process " + pid + " is still there, not died".red, stdout.toString()) 
                exec("jstack -l " + pid, function (error, stdout, stderr) {
                  console.log(TAG, testLongName.grey, "the stacktrace is ".red, stdout.toString())
                  exec("lsof -p " + pid, function (error, stdout, stderr) {
                    console.log(TAG, testLongName.grey, "the open file descriptors are ".red, stdout.toString())
                    setTimeout(function(){
                      if(pid > 0) {
                       exec("kill -9 " + pid);
                       console.log(TAG, testLongName.grey, "killed ".red)
                      }
                    }, 5000)
                  })
                })
              }
            })
          }
        }, 6000)
      }
    })
    rn.stderr.on("data", function(data) {
      stderr += data;
      // console.log(data.toString());
    })
    rn.on("exit", function(code) {
      // console.log(TAG, testLongName.grey, "spoonRun ended");
      if(pid > 0) {
        exitHandler(code)
      }
    })
  }

  function getParams(mode, taskInfo, settings) {
    var res = {};

    var uid = taskInfo.title + mode.toString();
    res.outPath = config.modules.spoonrunner.outDir + "/" + uid;
    res.vals = [
      "-jar",
      "-Xmx1g",
      config.spoonPath,
      "--sdk", config.androidPath,
      "--apk", path.normalize(config.projects[taskInfo.applicationId].apks.debug),
      "--test-apk", path.normalize(config.projects[taskInfo.applicationId].apks.debugTest),
      "--output", res.outPath,
      "--noprettify",
      "--debug", 
      "--method-name", taskInfo.methodName,
      "--class-name", taskInfo.className,
      "--deviceSerial", device.serial
    ];
    if (!taskInfo.install) {
      res.vals.push("--noinstall");
    }
    if (!settings.log) {
      res.vals.push("--filterLog", "no logging");
    } else if (settings.logFilter) {
      res.vals.push("--filterLog", settings.logFilter);
    }
    res.vals.push("--nohtml", "--runId", mode.toString());
    return res;
  }

  this.runTest = function() {
    androidRunTest.apply(null, arguments);
  }
  this.aggregateTests = aggregateTests;
};

/**
 * Event setup.
 */

function eventify(obj, hookNames) {
  extend(obj, {
    addObserver: function(hookName, f, owner) {
      var hook = obj[hookName];
      if (!hook) {
        throw new Error("Unable to add observer for undefined hook");
      }
      if (typeof hook.observers == "undefined") {
        hook.observers = [];
      }
      hook.observers.push({ fun: f, owner: owner });
    },
    addObserverOnce: function(hookName, f, owner) {
      var hook = obj[hookName];
      var f2 = function() {
        f.apply(owner, arguments);
        obj.removeObserver(hookName, f2);
      };
      obj.addObserver(hookName, f2, owner);
    },
    invokeObservers: function(hookName, params) {
      var hook = obj[hookName];
      if (hook.observers) {
        var cpy = hook.observers.slice(0);
        var lastRet;
        for (var i = 0; i < cpy.length; i++) {
          var ret = cpy[i].fun.apply(cpy[i].owner, params);
          if (typeof ret != "undefined") {
            lastRet = ret;
          }
        }
        return lastRet;
      }
    },
    removeObserver: function(hookName, fun) {
      var hook = obj[hookName];
      if (hook.observers) {
        hook.observers = hook.observers.filter(function(x) {
          return x.fun != fun;
        });
      }
    },
    removeObserverByOwner: function(hookName, owner) {
      var hook = obj[hookName];
      if (hook.observers) {
        hook.observers = hook.observers.filter(function(x) {
          return x.owner != owner;
        });
      }
    }
  });

  hookNames.forEach(function(hookName) {
    obj[hookName] = function() {
      return obj.invokeObservers(hookName, arguments);
    };
  }); 
}

/**
 * Exports.
 */

exports.AndroidInterface = AndroidInterface;
exports.TestManagerInterface = TestManagerInterface;
