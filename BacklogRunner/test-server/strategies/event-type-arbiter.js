var globals = require("./globals");
var TestInfo = require("./test-info.js").TestInfo;
var Services = require("./test-info.js").Services;

var TAG = "event-type-arbiter";

var EventTypeArbiter = {

	eventTypeRelevant: function(settings, eventType, servicesInfo) {
		if (typeof servicesInfo == "undefined" || !settings.usedServicesMode) {
			return true;
		} else {
			if (globals.isAudio(eventType)) {
				var useAudio = servicesInfo.some(function(serviceInfo) {
					return serviceInfo == Services.AUDIO;
				});
				if (!useAudio) {
					console.log(TAG, "event type irrelevant: audio not used".green);
				}
				return useAudio;
			} else {
				return true;
			}
		}
	},

	shouldInject: function(settings, looper, eventType, currentState) {

		// Special handling of data-connection-off ("environment event type")

		if (eventType == "data-connection-off") {
			if (!currentState.firstEspressoAction) {
				console.log(TAG, "data connection off not relevant".green);
			}
			return currentState.firstEspressoAction;
		}

		// Other event types

		if (settings.randomInjectionMode) {

			// Let a coin flip determine whether or not to inject

			if (Math.random() > 0.5) {
				return false;
			} else {

				// The usedServicesMode could potentially allow us to ignore this injection, so don't return!

			}
		}

		if (settings.usedServicesMode) {

			// Used services mode: Only inject if service actually used!

			var servicesInfo = settings.usedServicesMode ? TestInfo.diff(looper) : [];
			TestInfo.updateWas(looper);

			if (globals.isAudio(eventType)) {
				var useAudio = servicesInfo.some(function(serviceInfo) {
					return serviceInfo.service == Services.AUDIO && serviceInfo.active;
				});
				if (settings.usedServicesMode && !useAudio) {
					console.log(TAG, "audio not used".green);
				}
				if (useAudio) {

					// Event type is audio, and audio IS used: Inject!

					return true;
				} else {

					// Event type is audio, and audio IS NOT used: Don't inject!

					return false;
				}
			} else {
				return true;
			}
		} else {

			// Not used services mode: Always inject!

			return true;
		}
	}
};

exports.EventTypeArbiter = EventTypeArbiter;