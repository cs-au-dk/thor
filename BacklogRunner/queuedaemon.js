#!/usr/bin/env node

var TAG = "queuedaemon";

require("colors");

var child_process = require("child_process");
var execFile = child_process.execFile;
var execSync = child_process.execSync;
var fs = require("fs");
var kue = require("kue");
var express = require("express");
var directory = require("serve-index");

require("./utils/polyfill");

var Globals = require("./test-server/strategies/globals");
var Coverage = require("./test-server/coverage").Coverage;
var extractor = require("./test-extractor/test-extractor");
var config = require("./config").config;
var utils = require("./utils/utils");
var Graph = require("./utils/graph").Graph;
var emulator = require("./utils/emulator");
var strategySelector = require("./test-server/strategies/strategy-selector").strategySelector;

var Type = Globals.Type;

/**
 * 0) Start test-server is demanded
 */

if (process.execArgv.indexOf("--harmony")) {
  console.log(TAG, "remember to run node with --harmony flag".red);
  process.exit();
}

/**
 * 1) Start ADB server
 */

execSync(config.adbPath + "/adb start-server");

/**
 * 2) Create the job queue
 */

var jobs = kue.createQueue();
// jobs.on("error", function(err) {
  // console.log(TAG, err.toString().red);
// });

/**
 * UI integration
 */

var currentStrategy;

kue.app.use("/thor", express.static(__dirname + "/ui"));
kue.app.use("/out", directory(config.backlogOutPath, { icons: true }));
kue.app.use("/out", express.static(config.backlogOutPath));
kue.app.get("/out/*.dot", function server(req, res) {
  var path = req.path.replace("/out", config.backlogOutPath);
  var ext = path.substring(path.lastIndexOf(".")+1, path.length);
  if (ext == "dot") {
    execSync("dot -Tpng " + path + " -o " + path.replace(".dot", ".png"));
    path = path.replace(".dot", ".png");
  }
  res.sendfile(path);
});
kue.app.get("/thor/tests", extractor.listener);
kue.app.post("/thor/exec", function(req, res) {
  if (req.query.type == "replay-continue") {
    if (currentStrategy) {
      currentStrategy.continue();
    }
  } else if (req.query.type == "event-type-fire") {
    execSync(config.adbPath + "/adb shell service call event 1 s16 " + req.query.event);
  }
  res.end();
});
kue.app.listen(3043, "0.0.0.0");

/**
 * Restart old jobs.
 */

kue.Job.rangeByType("aggregate", "active", 0, 1000000, "desc", function(err, selected) {
  selected.forEach(function(job) {
    job.state("inactive").save();
  });
});

/**
 * Job: Aggregate.
 */

jobs.process("aggregate", 1, function(job, done) {
  if (job.data.succeededWorkaround) { done(); return; }

  console.log(TAG, "running an aggregate " + job.id);

  job.data.succeeded = job.data.succeeded || [];
  job.data.failed = job.data.failed || [];
  job.data.progress = job.data.progress || [];
  job.data.time = { started: (job.data.time && job.data.time.started) || Date.now() };
  
  if (job.data.kind == "aggregate-only") {
    onSubjobsComplete(job, done);
  } else {
    var settings = getSettings(job);

    function fail(msg) {
      job.failed().error(msg);
      done(msg);
    }
    
    var awaiting = job.data.tasks.length;
    var runningTests = 0;
    var nextTest = 0;

    function runParallel() {
      var diff = (Globals.emulatorPool.size * 2) - runningTests;

      var started = 0;

      while (started < diff) {
        if (nextTest <= job.data.tasks.length - 1) {
          var task = job.data.tasks[nextTest];
          var taskInfo = getTaskInfo(job, task, nextTest == 0);
          runTest(taskInfo);

          job.progress(nextTest, job.data.tasks.length);

          nextTest++;
        }

        started++;
      }
      runningTests += diff;
    }

    function runTest(taskInfo) {
      if (job.data.succeeded.indexOf(taskInfo.title) >= 0 || job.data.failed.indexOf(taskInfo.title) >= 0) {
        process.nextTick(function() {
          console.log(TAG, ("already run " + taskInfo.title + " (succeeded=" + (job.data.succeeded.indexOf(taskInfo.title) >= 0) + ", failed=" + (job.data.failed.indexOf(taskInfo.title) >= 0) + ")").grey);
          next();
        });
      } else {
        var strategy = strategySelector(taskInfo, settings);

        strategy.addListener("progress", function(saved) {
          job.data.progress = job.data.progress.filter(function(progress) { return progress.title != taskInfo.title; });
          job.data.progress.push({
            title: taskInfo.title,
            saved: saved
          });
          job.save();
        });

        var progress = job.data.progress.find(function(progress) { return progress.title == taskInfo.title; });

        strategy.perform(function(result) {
          if (result.error || result.testFailed || result.testRunFailed) {
            job.data.failed.push(taskInfo.title);
          } else {
            job.data.succeeded.push(taskInfo.title);
          }
          job.data.progress = job.data.progress.filter(function(progress) { return progress.title != taskInfo.title; });
          job.save();
          next();
        }, { saved: progress && progress.saved });

        currentStrategy = strategy;
      }
    }

    function next() {
      awaiting--; runningTests--;
      awaiting == 0 ? onSubjobsComplete(job, done) : runParallel();
    }

    runParallel();
  }
});

function getSettings(job) {
  var log = typeof job.data.log == "string" ? job.data.log == "true" : job.data.log;
  var logFilter = log && typeof job.data.logFilter != "undefined" && job.data.logFilter.length > 0 ? job.data.logFilter : undefined;
  var list = [];
  if (job.data.stress.configurations instanceof Array) {
    list = job.data.stress.configurations;
  } else if (typeof job.data.stress.configurations === 'string') {
    list = job.data.stress.configurations.split(',');
  }
  var configurations = list.map(function(configuration) { return parseInt(configuration); });
  configurations.sort();

  return {
    stressType: job.data.stress.type,
    eventTypes: job.data.stress.eventTypes || [],
    configurations: configurations,
    limit: parseInt(job.data.stress.limit),
    seeds: job.data.stress.seeds.trim().length > 0 ? job.data.stress.seeds.split(",").map(function(seed) { return seed.trim(); }) : [],
    minimize: {
      lowerBound: parseInt(job.data.stress.minimize.lowerBound),
      upperBound: parseInt(job.data.stress.minimize.upperBound) || Number.POSITIVE_INFINITY // Number.POSITIVE_INFINITY if NaN
    },
    replay: typeof job.data.replay == "string" ? job.data.replay == "true" : job.data.replay,
    snapshot: typeof job.data.snapshot == "string" ? job.data.snapshot == "true" : job.data.snapshot,
    collapse: typeof job.data.collapse == "string" ? job.data.collapse == "true" : job.data.collapse,
    stopOnError: typeof job.data.stopOnError == "string" ? job.data.stopOnError == "true" : job.data.stopOnError,
    superGraphMode: typeof job.data.superGraphMode == "string" ? job.data.superGraphMode == "true" : job.data.superGraphMode,
    graphType: job.data.graphType,
    ignoreNoEffectMode: typeof job.data.ignoreNoEffectMode == "string" ? job.data.ignoreNoEffectMode == "true" : job.data.ignoreNoEffectMode,
    usedServicesMode: typeof job.data.usedServicesMode == "string" ? job.data.usedServicesMode == "true" : job.data.usedServicesMode,
    randomInjectionMode: typeof job.data.randomInjectionMode == "string" ? job.data.randomInjectionMode == "true" : job.data.randomInjectionMode,
    log: log,
    logFilter: logFilter
  }
}

function getTaskInfo(job, task, first) {
  return {
    title: job.data.title + "-" + task.class + "." + task.method,
    name: job.data.name,
    applicationId: job.data.applicationId,
    className: task.class,
    methodName: task.method,
    install: false
  };
}

function onSubjobsComplete(job, done) {
  var settings = getSettings(job);

  job.data.time.ended = Date.now();
  job.data.time.total = utils.momentify(job.data.time.ended - job.data.time.started);

  // Super graph

  if (settings.superGraphMode) {
    job.data.paths = job.data.paths || {};
    job.data.paths.superGraph = config.modules.superGraph.outDir + "/" + job.data.name + "/" + Globals.superGraph.name + ".dot";

    job.data.remotePaths = job.data.remotePaths || {};
    job.data.remotePaths.superGraph = config.modules.superGraph.remoteDir + "/" + job.data.name + "/" + Globals.superGraph.name + ".dot";

    Globals.superGraph.dump(config.modules.superGraph.outDir + "/" + job.data.name);
    Globals.superGraph = new Graph("super");
  }

  // Coverage report

  var taskInfo = {
    title: job.data.title,
    name: job.data.name,
    applicationId: job.data.applicationId
  };
  new Coverage(taskInfo).merge().generateReport();

  // Aggregation


  combineAggregationOutput(job.data.name, job, function(err) {

    completeAggregationJob(job, done, err);

  }, getTaskInfo);
  
  /* TODO: Enable to generate stop-on-error output whenever we can (hence whenever we have the first configuration run)
  if (settings.stressType == Type.NONE || settings.stressType == Type.MINIMIZE || settings.stressType == Type.EXHAUSTIVE || settings.stopOnError) {
    combineAggregationOutput(job.data.name, job, function(err) {

      completeAggregationJob(job, done, err);

    }, getTaskInfo);
  } else {
    combineAggregationOutput(job.data.name + "-stop-on-error", job, function(err1) {

      combineAggregationOutput(job.data.name, job, function(err2) {

        completeAggregationJob(job, done, err1 ? err1 : err2)

      }, getTaskInfo);

    }, function(job, task) {
      var taskInfo = getTaskInfo(job, task);
      taskInfo.title += "-stop-on-error";
      return taskInfo;
    })
  } 
  */ 
}

function combineAggregationOutput(name, job, callback, getTaskInfo) {
  var outDir = config.modules.aggregation.outDir + "/" + name
  var params = ["-jar", "-XX:-UseConcMarkSweepGC", "-Xms6g", "-Xmx6g", config.spoonPath, "--noprettify", "--aggregateout", outDir];
  job.data.tasks.forEach(function(task) {
    var taskInfo = getTaskInfo(job, task);
    var path = config.modules.spoonrunner.outDir + "/" + taskInfo.title + "/result.json";
    if (fs.existsSync(path)) {
      params.push("--aggregate", path);
    } else {
      console.log(TAG, "missing result file for task ", task, path);
    }
  });

  execFile("java", params, { env: process.env }, function(error, stdout, stderr) {
    job.data.result_error = error;
    job.data.result_stdout = stdout;
    job.data.result_stderr = stderr;
    job.save();
    
    // And finish the job
    console.log(TAG, "finished an aggregation " + job.id + " output in: " + outDir);

    var err;
    if (stderr.indexOf("java.lang.OutOfMemoryError") >= 0) {
      err = "Aggregation failed due to java.lang.OutOfMemoryError.";
    }

    callback(err);
  });
}

function completeAggregationJob(job, done, err) {
  if (err) {
    job.failed().error(err);
  }
  job.data.succeededWorkaround = true;
  job.save();
  done(err);
}