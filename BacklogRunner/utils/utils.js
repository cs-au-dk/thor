"use strict";

var config = require("../config").config;

var moment = require("moment");
var Future = require("fibers/future");
var Fiber = require("fibers")
var exec = require('child_process').exec;
var fs = require("fs");

/**
 * Diff
 */

function diff(o1, o2) {
    function visit(o1, o2, acc) {
        for (var k1 in o1) {
            if (typeof o1[k1] == "object" && o2 && typeof o2[k1] == "object") {
                var recursive = visit(o1[k1], o2[k1], {});
                if (!isEmpty(recursive)) {
                    acc[k1] = recursive;
                }
            } else {
                if (!o2 || o1[k1] !== o2[k1]) { // !o2.hasOwnProperty(k1) || 
                    acc[k1] = {
                        o1: o1[k1],
                        o2: o2 ? o2[k1] : undefined
                    };
                }
            }
        }
        return acc;
    }

    return visit(o2, o1, visit(o1, o2, {}));
}

/**
 * isEmpty
 */

function isEmpty(o) {
    for (var k in o) {
        if (o.hasOwnProperty(k)) {
            return false;
        }
    }
    return true;
}

/**
 * Fibers
 */

function sleep(ms) {
    var fiber = Fiber.current;
    setTimeout(function() {
        fiber.run();
    }, ms);
    Fiber.yield();
}

function momentify(time) {
    var result = "";
    var duration = moment.duration(time);

    var days = duration.days();
    if (days > 0) result += days + "d ";

    var hours = duration.hours();
    if (hours > 0) result += hours + "h ";

    var minutes = duration.minutes();
    if (minutes > 0) result += minutes + "m ";

    var seconds = duration.seconds();
    if (seconds > 0) result += seconds + "s";

    return result.trim();
}

/**
 * Main
 */

if (require.main === module) {
	if (process.argv[2] == "diff") {
		var path1 = process.argv[3];
		var path2 = process.argv[4];

		var o1 = JSON.parse(fs.readFileSync(path1));
		var o2 = JSON.parse(fs.readFileSync(path2));

		var res = diff(o1, o2);

		console.log(JSON.stringify(res, undefined, 2));
	} else {
        console.log("Usage:");
        console.log("  diff <path1.json> <path2.json>");
    }
}

exports.diff = diff;
exports.isEmpty = isEmpty;
exports.sleep = sleep;
exports.momentify = momentify;