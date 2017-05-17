var fs = require("fs");
var execSync = require("child_process").execSync;

var config = require("../config").config;

var TAG = "coverage";

function Coverage(taskInfo, device) {
	var self = this;

	var androidCoverageFilePath = "/data/data/" + taskInfo.applicationId + "/coverage.ec";

	function getLocalCoverageFilePath(uid) {
		return config.modules.coverage.rawDir + "/" + taskInfo.name + "/" + taskInfo.title + (uid ? "-" + uid : "") + ".ec";
	}

	this.success = false;
	this.taken = false;

	this.start = function() {
		self.taken = false;
	};

	this.end = function(androidTestRunner, uid) {
		// Output coverage file on Android side
		if (!self.taken) {
			self.success = false;
			var i = 0;
			while (!self.success && i++ < 3) {
				try {
					androidTestRunner.generateCoverageReport(androidCoverageFilePath);

					// Pull and rename coverage file to local side
					try {
						var stdout = execSync(config.adbPath + "/adb -s " + device.serial + " pull " + androidCoverageFilePath + " " + getLocalCoverageFilePath(uid)).toString();
						console.log(TAG, "coverage correctly collected");
						self.success = true;
					} catch (e) {
					}
				}
				catch(err) {
					console.log(TAG, "error generating the report".red, err, err.stack);
				}
			}
			self.taken = true;
		}
	};

	this.merge = function() {
		var data = config.modules.coverage.rawDir + "/" + taskInfo.name;

		if (fs.existsSync(data)) {
			var arguments = [
				{ key: "dir.data", value: data },
				{ key: "file.dest", value: config.modules.coverage.rawDir + "/" + taskInfo.name + ".ec" }
			];
			arguments = arguments.map(function(pair) {
				return "-D" + pair.key + "=\"" + pair.value + "\"";
			});
			execSync("ant " + arguments.join(" ") + " merge");
		}

		return self;
	};

	this.generateReport = function() {
		var data = config.modules.coverage.rawDir + "/" + taskInfo.name + ".ec";

		if (fs.existsSync(data)) {
			var arguments = [
				{ key: "file.coverage", value: data },
				{ key: "dir.classfiles", value: config.projects[taskInfo.applicationId].classDir },
				{ key: "dir.sourcefiles", value: config.projects[taskInfo.applicationId].srcDir },
				{ key: "dir.dest", value: config.modules.coverage.reportDir + "/" + taskInfo.name }
			];
			arguments = arguments.map(function(pair) {
				return "-D" + pair.key + "=\"" + pair.value + "\"";
			});
			// console.log(TAG, "ant " + arguments.join(" ") + " report");
			execSync("ant " + arguments.join(" ") + " report");
		}

		return self;
	};

	this.register = function(device, strategy) {
		device.testManagerInterface.addObserver("testStarted", function() {
			self.start();
		}, self);
		device.testManagerInterface.addObserver("testEnded", function(looper, androidTestRunner, foundError) {
			if (!strategy.currentState.retry) {
				self.end(androidTestRunner, strategy.currentMode.toString());
			}
		}, self);
		device.testManagerInterface.addObserver("processCrashed", function() {
			if (!strategy.currentState.retry) {
				self.end(strategy.AndroidObjects.androidTestRunner, strategy.currentMode.toString());
			}
		}, self);
	};

	this.unregister = function(tmi) {
		tmi.removeObserverByOwner("testEnded", self);
	};
}

exports.Coverage = Coverage;