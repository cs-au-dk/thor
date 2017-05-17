var sys = require("sys");
var exec = require("child_process").exec;
var polyfill = require("../utils/polyfill");
var sh = { exec: require("child_process").execSync };
var fs = require("fs");
var config = require("../config").config;

var TAG = "test-extractor";

var extractTests = function(callback) {
  var result = [];
  var lastApplication = null;
  var lastPackage = null;
  var lastClass = null;

  /**
   * Generate out files.
   */
  sh.exec("mkdir -p " + config.modules.testextractor.outDir);

  var apkCount = 0;
  for (var applicationId in config.projects) {
    if (!fs.existsSync(config.modules.testextractor.outDir + "/" + applicationId) && fs.existsSync(config.projects[applicationId].apks.debugTest)) {
      console.log(TAG, "extracting tests from " + applicationId);
      sh.exec("java -jar bintools/apktool.jar d " + config.projects[applicationId].apks.debugTest + " " + config.modules.testextractor.outDir + "/" + applicationId);
    }
    apkCount++;
  }

  /**
   * Look in out files.
   */

  var addToResult = function(applicationId, packageName, className, innerClassName, methodName, unstable) {
    if (innerClassName)
      className = className + "$" + innerClassName;

    if (!lastApplication || applicationId != lastApplication.name) {
      lastApplication = {
        name: applicationId,
        packages: []
      };
      result.push(lastApplication);
      lastPackage = lastClass = null;
    }

    if (!lastPackage) {
      var packages = packageName.split(".");
      lastPackage = {
        type: "package",
        name: packages[0],
        unqualifiedName: packages[0],
        packages: [],
        classes: []
      };
      lastApplication.packages.push(lastPackage);
    }

    if (packageName != lastPackage.name) {
      if (!packageName.startsWith(lastPackage.name)) {
        var commonPackage = packageName.commonPrefix(lastPackage.name);
        commonPackage = commonPackage.substring(0, commonPackage.lastIndexOf("."));
        while (lastPackage.name != commonPackage) {
          lastPackage = lastPackage.parent;
        }
      }

      var packages = packageName.substr(lastPackage.name.length+1).split(".");
      for (var i = 0; i < packages.length; i++) {
        var newLastPackage = {
          type: "package",
          name: lastPackage.name + "." + packages[i],
          unqualifiedName: packages[i],
          packages: [],
          classes: [],
          parent: lastPackage
        };
        lastPackage.packages.push(newLastPackage);
        lastPackage = newLastPackage;
      }
    }

    if (!lastClass || className != lastClass.name) {
      lastClass = {
        type: "class",
        name: className,
        methods: []
      };
      lastPackage.classes.push(lastClass);
    }

    lastClass.methods.push({ type: "method", name: methodName, unstable: unstable });
  };

  var done = 0;
  function checkDone() {
    if (++done == apkCount && typeof callback == "function") {
      callback(result);
    }
  }

  for (var applicationId in config.projects) {
    if (!fs.existsSync(config.modules.testextractor.outDir + "/" + applicationId)) {
      checkDone();
      continue;
    }

    (function(applicationId) {
      var appOutDir = config.modules.testextractor.outDir + "/" + applicationId + "/smali/" + applicationId.replace(/\./g, "/");
      exec("ack \".method public test\" \"" + appOutDir + "\"", function(error, stdout, stderr) {
        if (stderr || error) {
          console.log(TAG, ("unexpected result during 'ack \".method public test\" \"" + appOutDir + "\"'").red);
          checkDone();
          return;
        }

        var fileRegExp = new RegExp(/smali\/(\w+\/)+(\w+(\$\w+)?)\.smali/);
        var testRegExp = new RegExp(/.method public \w+()/);

        var ackResults = stdout.split("\n");

        var lastSlashedPath = null;
        var lastSlashedPathContent = null;

        for (var j = 0; j < ackResults.length; j++) {
          var ackResult = ackResults[j].trim();
          if (ackResult) {
            var slashedPath = fileRegExp.exec(ackResult)[0];
            var dottedPath = slashedPath.substring(6, slashedPath.length-6).replace(/\//g, ".");

            var packageName = dottedPath.substring(0, dottedPath.lastIndexOf("."));
            var classAndInnerClassName = dottedPath.substring(dottedPath.lastIndexOf(".")+1).split("$");
            var className = classAndInnerClassName[0];
            var innerClassName = classAndInnerClassName.length == 2 ? classAndInnerClassName[1] : null;
            var methodName = testRegExp.exec(ackResult)[0].replace(".method public ", "");

            if (slashedPath != lastSlashedPath) {
              lastSlashedPathContent = fs.readFileSync(config.modules.testextractor.outDir + "/" + applicationId + "/" + slashedPath).toString().split('\n');
            }

            var unstable = false;
            for (var k = 0; k < lastSlashedPathContent.length; k++) {
              var line = lastSlashedPathContent[k];
              if (line != ".method public " + methodName + "()V") {
                continue;
              }

              while (k++ < lastSlashedPathContent.length && (line = lastSlashedPathContent[k].trim()) != ".end method") {
                if (line.startsWith(".annotation") && line.endsWith("UnstableTest;")) {
                  unstable = true;
                  break;
                }
              }
              break;
            }

            addToResult(applicationId, packageName, className, innerClassName, methodName, unstable);
          }
        }

        checkDone();
      });
    })(applicationId);
  }
};

var listener = function(req, res) {
  extractTests(function(result) {
    (function removeCircularity(obj) {
      if (obj) {
        obj.parent = null;
        for (var key in obj) {
          if (typeof obj[key] == "object") {
            removeCircularity(obj[key]);
          }
        }
      }
    })(result);
    res.send(result);
  });
};

exports.listener = listener;