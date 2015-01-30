var q = require("../libs/q"); // require("q");

var TAG = "snapshotter";
var DEBUG = true;
var EXHAUSTIVE_DEBUG = false;

function Snapshotter(device) {
	var self = this;

	this.takingSnapshot = false;

	var tmi = device.testManagerInterface;
	
	this.take = function(looper, options) {
		var deferred = q.defer();

		if (self.takingSnapshot) {
		  console.log(TAG, "already taking snapshot".red);
		  return;
		}
		if (DEBUG) console.log(TAG, "taking snapshot");
		self.takingSnapshot = true;

		// Cancel snapshot if not taken in 15s
		var timedOut = false;
		var timeout = setTimeout(function() {
			console.log(TAG, "timeout".red);
			tmi.removeObserverByOwner("sendViewState", self);
			timedOut = true;
			self.takingSnapshot = false;
			deferred.reject("timeout");
		}, 15*1000);

		// Snapshot callback
		tmi.addObserverOnce("sendViewState", function(view, bitmap) {
			if (DEBUG) console.log(TAG, "snapshot returned");

			clearTimeout(timeout);
			self.takingSnapshot = false;

			deferred.resolveSync({ view: view, bitmap: bitmap });

			if (EXHAUSTIVE_DEBUG) console.log(TAG, "snapshot resolved");
		}, self);

		// Execute in a try-catch: if we issue a timeout, there may be issues on the Android site
		try {
			looper.takeSnapshotCrossProcess(options.bitmap, options.dump);
		}
		catch (err) {
			if (!timedOut) {
				throw err;
			}
		}

		return deferred.promise;
	};

	this.unregister = function(tmi) {
		tmi.removeObserverByOwner("sendViewState", self);
	};
}

exports.Snapshotter = Snapshotter;