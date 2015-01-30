var TAG = "TestInfo";

var Services = {
	AUDIO: "AudioService"
};

var TestInfo = {
	diff: function(looper) {
		var result = [];
		if (!looper.servicesStatus().mPlayer().wasPlaying() && looper.servicesStatus().mPlayer().isPlaying()) {
			result.push({ service: Services.AUDIO, active: true });
		} else if (looper.servicesStatus().mPlayer().wasPlaying() && !looper.servicesStatus().mPlayer().isPlaying()) {
			result.push({ service: Services.AUDIO, active: false });
		}
		return result;
	},

	haveBeen: function(looper) {
		var result = [];
		if (looper.servicesStatus().mPlayer().haveBeenPlaying()) {
			result.push({ service: Services.AUDIO });
		}
		return result;
	},

	updateWas: function(looper) { looper.servicesStatus().updateWas(); },
	resetIs: function(looper) { looper.servicesStatus().resetIs(); },
	resetWas: function(looper) { looper.servicesStatus().resetWas(); },
	resetHaveBeen: function(looper) { looper.servicesStatus().resetHaveBeen(); }
};

exports.Services = Services;
exports.TestInfo = TestInfo;