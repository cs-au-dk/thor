var sh = require("execSync");

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
					var cv = sh.exec(config.adbPath + "/adb -s " + device.serial + " pull " + androidCoverageFilePath + " " + getLocalCoverageFilePath(uid));
					if (cv.code != 0) {
						if(cv.stdout) console.log(TAG, "stdout:" + cv.stdout.toString().red)
						if(cv.stderr) console.log(TAG, "stderr:" + cv.stderr.toString().red)
					} else {
						console.log(TAG, "coverage correctly collected");
						self.success = true;
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
		var arguments = [
			{ key: "dir.data", value: config.modules.coverage.rawDir + "/" + taskInfo.name },
			{ key: "file.dest", value: config.modules.coverage.rawDir + "/" + taskInfo.name + ".ec" }
		];
		arguments = arguments.map(function(pair) {
			return "-D" + pair.key + "=\"" + pair.value + "\"";
		});
		sh.exec("ant " + arguments.join(" ") + " merge");

		return self;
	};

	this.generateReport = function() {
		var arguments = [
			{ key: "file.coverage", value: config.modules.coverage.rawDir + "/" + taskInfo.name + ".ec" },
			{ key: "dir.classfiles", value: config.projects[taskInfo.applicationId].classDir },
			{ key: "dir.sourcefiles", value: config.projects[taskInfo.applicationId].srcDir },
			{ key: "dir.dest", value: config.modules.coverage.reportDir + "/" + taskInfo.name }
		];
		arguments = arguments.map(function(pair) {
			return "-D" + pair.key + "=\"" + pair.value + "\"";
		});
		// console.log(TAG, "ant " + arguments.join(" ") + " report");
		sh.exec("ant " + arguments.join(" ") + " report");

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