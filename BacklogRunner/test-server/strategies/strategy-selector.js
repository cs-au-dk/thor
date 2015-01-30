var globals = require("./globals");
var Type = globals.Type;

var OneByOneStrategy = require("./one-by-one-strategy").Strategy;
var OneByOneConfiguration = require("./one-by-one-strategy").Configuration;

var PreprocessingStrategy = require("./preprocessing-strategy").Strategy;
var PreprocessingConfiguration = require("./preprocessing-strategy").Configuration;

var CollapseStrategy = require("./collapse-strategy").Strategy;
var CollapseConfiguration = require("./collapse-strategy").Configuration;

var ExhaustiveStrategy = require("./exhaustive-strategy").Strategy;
var ExhaustiveConfiguration = require("./exhaustive-strategy").Configuration;

var MinimizeStrategy = require("./minimize-strategy").Strategy;
var MinimizeConfiguration = require("./minimize-strategy").Configuration;

var AggressiveStrategy = require("./aggressive-strategy").Strategy;
var AggressiveConfiguration = require("./aggressive-strategy").Configuration;

var NoInjectionStrategy = require("./no-injection-strategy").Strategy;

var TAG = "strategy-selector";

function NoOpStrategy() {
	this.perform = function(callback) {
		callback({});
	};
}

function strategySelector(taskInfo, settings, noStacking) {
	if (settings.stressType == Type.NONE) {
		return new NoInjectionStrategy(taskInfo, settings);
	}
	
	if (settings.eventTypes.length == 0) {
		console.log(TAG, "cannot run strategies with 0 event types".red);
		return new NoOpStrategy();
	}

	if (settings.stressType == Type.EXHAUSTIVE) {
		return new ExhaustiveStrategy(taskInfo, new ExhaustiveConfiguration(settings), settings);
	}

	if (settings.stressType == Type.AGGRESSIVE) {
		return new AggressiveStrategy(taskInfo, new AggressiveConfiguration(settings), settings);
	}

	if (settings.stressType == Type.MINIMIZE) {
		return new MinimizeStrategy(taskInfo, new MinimizeConfiguration(settings), settings);
	}

	if (settings.collapse) {
		return new CollapseStrategy(taskInfo, new CollapseConfiguration(settings), settings);
	}
	var oneByOneStrategy = new OneByOneStrategy(taskInfo, new OneByOneConfiguration(settings), settings);
	if (noStacking) {
		return oneByOneStrategy;
	} else {
		return new PreprocessingStrategy(taskInfo, new PreprocessingConfiguration(settings), settings, oneByOneStrategy);
	}
}

exports.strategySelector = strategySelector;