var pdu = require("../../utils/project-data");
var testManager = require("../test-manager.js");
var globals = require("./globals");

var TAG = "statistics";

function Statistics(taskInfo, settings) {
	var self = this;

	var testName = taskInfo.className + "." + taskInfo.methodName;
	var clocks = {};

	this.clearOld = function(id) {
		pdu.getDynamicProjectData(taskInfo.applicationId, id, function(data) {
			initializeFields(id, data);

			data.statistics[taskInfo.name].tests[testName] = []; // Clear old test data
			
			pdu.setDynamicProjectData(taskInfo.applicationId, id, data);
		});
		return self;
	};

	/**
	 * Timers.
	 */

	this.startTimer = function(name) {
		clocks[name] = clocks[name] || { total: 0, started: undefined };
		clocks[name].started = Date.now();
		return self;
	};

	this.stopTimer = function(name) {
		var clock = clocks[name];
		if (clock) {
			clock.total += Date.now() - clock.started;
			clock.started = undefined;
		}
		return self;
	};

	this.resetTimer = function(name) {
		clocks[name] = { total: 0, started: undefined };
		return self;
	};

	this.commit = function(id, currentState, currentMode) {
		var testData = {};

		["injectionSites", "ignoredInjections", "falsePositives", "restarts"].forEach(function(property) {
			if (currentState && currentState.hasOwnProperty(property)) {
				testData[property] = currentState[property];
			}
		});

		["bestLowerBound", "bestUpperBound", "worstLowerBound", "worstUpperBound", "eventTypeSearches", "injectionSiteSearches"].forEach(function(property) {
			if (currentMode && currentMode.hasOwnProperty(property)) {
				testData[property] = currentMode[property];
			}
		});

		if (settings.superGraphMode) {
			testData.superGraphSize = globals.superGraph.size;
		}

		pdu.getDynamicProjectData(taskInfo.applicationId, id, function(data) {
			initializeFields(id, data);

			// Copy clocks to testData
			for (var clockName in clocks) {
				if (!clocks.hasOwnProperty(clockName)) {
					continue;
				}

				var clock = clocks[clockName];
				testData[clockName] = clock.total;
			}

			data.statistics[taskInfo.name].tests[testName].push(testData);
			
			pdu.setDynamicProjectData(taskInfo.applicationId, id, data);
		});
		return self;
	};

	this.register = function(device, strategy) {
		device.testManagerInterface.addObserver("testStarted", function() {
			self.resetTimer("time").resetTimer("superGraphLookupOverhead").startTimer("time");
		}, self);
		device.testManagerInterface.addObserver("testEnded", function() {
			self.stopTimer("time");
		}, self);
		device.testManagerInterface.addObserver("processCrashed", function() {
			self.stopTimer("time");
		}, self);
	};

	this.unregister = function(tmi) {
		tmi.removeObserverByOwner("testStarted", self);
		tmi.removeObserverByOwner("testEnded", self);
	};

	/**
	 * Utils
	 */

	function initializeFields(id, data) {
		data.statistics = data.statistics || {};
		data.statistics[taskInfo.name] = data.statistics[taskInfo.name] || {};
		data.statistics[taskInfo.name].tests = data.statistics[taskInfo.name].tests || {};
		data.statistics[taskInfo.name].tests[testName] = data.statistics[taskInfo.name].tests[testName] || [];
	}
}

exports.Statistics = Statistics;