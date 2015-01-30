var config = require("../config").config;
var polyfill = require("./polyfill");

var mkdirp = require("mkdirp");
var fs = require("fs");

var TAG = "project-data";

var defaultData = {};

/**
 * Utils
 */

function toCSV(project, id, data) {
  var statistics = data.statistics;

  var tests = [];

  for (var runId in statistics) {
    if (statistics.hasOwnProperty(runId)) {
      var runTests = statistics[runId].tests;
      for (var testName in runTests) {
        var result = runTests[testName];

        if (tests[testName]) {
          console.log(TAG, "Warning: duplicate tests in toCSV(), overriding...".red);
        }

        tests[testName] = result;
      }
    }
  }

  var result = [];

  for (var testName in tests) {
    if (tests.hasOwnProperty(testName)) {
      var testResult = tests[testName];

      testResult = testResult[0];

      var headers = ["project", "id", "test", "i"];
      for (var key in testResult) { if (testResult.hasOwnProperty(key)) { headers.push(key); } }
      result.push(headers.join(";"));
      break;
    }
  }

  for (var testName in tests) {
    if (tests.hasOwnProperty(testName)) {
      tests[testName].forEach(function(testResult, i) {
        var output = [project, id, testName, i];
        for (var key in testResult) { if (testResult.hasOwnProperty(key)) { output.push(testResult[key]); } }
        result.push(output.join(";"));
      });
    }
  }

  return result.join("\n");
}

/**
 * Get project data
 */

function getDynamicProjectData(project, id, callback) {
  getProjectData(project, function(data) {
    callback(data);
  }, id);
}

function getProjectData(project, callback, id) {
  var projectDataPath = config.modules.appData.outDir + "/" + project + "-" + id + ".json";
  if (fs.existsSync(projectDataPath)) {
    try {
      var data = fs.readFileSync(projectDataPath);
      return callback(JSON.parse(data));
    } catch (err) {
    }
  }
  return callback(defaultData);
}

/**
 * Set project data
 */

function setDynamicProjectData(project, id, data) {
  mkdirp.sync(config.modules.appData.outDir);
  fs.writeFileSync(config.modules.appData.outDir + "/" + project + "-" + id + ".json", JSON.stringify(data));
  fs.writeFileSync(config.modules.appData.outDir + "/" + project + "-" + id + ".csv", toCSV(project, id, data));
}

/**
 * Exports
 */

exports.getDynamicProjectData = getDynamicProjectData;
exports.setDynamicProjectData = setDynamicProjectData;