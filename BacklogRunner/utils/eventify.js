var TAG = "eventify";

function init(obj) {
	var listeners = {};

	function addListener(name, g) {
		if (typeof listeners[name] == "undefined") {
			listeners[name] = [];
		}
		listeners[name].push(g);
		return obj;
	}

	function removeListener(name, g) {
		if (typeof listeners[name] != "undefined") {
			listeners[name] = listeners[name].filter(function(listener) { return listener != g; });
		}
		return obj;
	}

	function addListenerOnce(name, g) {
		addListener(name, function h() {
			g.apply(null, arguments);
			removeListener(name, h);
		});
		return obj;
	}
	
	function notifyListeners(name) {
		var newargs = [];
		for (var i = 0; i < arguments.length-1; i++) {
			newargs[i] = arguments[i+1];
		}


		if (typeof listeners[name] != "undefined") {
			for (var i = 0; i < listeners[name].length; i++) {
				var listener = listeners[name][i];
				listener.apply(null, newargs);
			}
		}
		return obj;
	}

	obj.addListener = addListener;
	obj.addListenerOnce = addListenerOnce;
	obj.removeListener = removeListener;
	obj.notifyListeners = notifyListeners;
}

function forward(obj, target) {
	obj.addListener = target.addListener;
	obj.addListenerOnce = target.addListenerOnce;
	obj.removeListener = target.removeListener;
	obj.notifyListeners = target.notifyListeners;
}

this.init = init;
this.forward = forward;