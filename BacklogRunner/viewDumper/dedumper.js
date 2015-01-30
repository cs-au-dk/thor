var parser = require("./viewParser");

var fs = require('fs');

/**
 * Parsing
 */

function level(line) {
    var count = 0;
    while (line.charAt(count) == " ") count++;
    return count;
}

function parseView (view) {
    return parser.parse(view);
}

function parseDumpLines(dumpLines) {
    var level0 = level(dumpLines[0]);
    var root = parseView(dumpLines[0]);
    root.children = [];

    var curPath = [root];

    function last() { return curPath[curPath.length - 1]; };
    function curLevel() { return level0 + curPath.length; };

    for (var i = 1; i < dumpLines.length; i++) {
        try {
            var parsedView = parseView(dumpLines[i]);
        }
        catch(err) {
            break;
        }
        if (level(dumpLines[i]) == curLevel() + 1) {
            curPath.push(last().children[last().children.length - 1]);
            last().children = [];
            last().children.push(parsedView);
        }
        else if (level(dumpLines[i]) == curLevel()) {
            last().children.push(parsedView);
        }
        else if (level(dumpLines[i]) < curLevel()) { // going up
            var diff = level(dumpLines[i]) - curLevel();
            for (var v = 0; v < diff; v++) {
                curPath.pop();
            };
            last().children.push(parsedView);
        }
    }

    return root;
}

function parse(data) {
    var lines = data.split("\n");
    return parseDumpLines(lines);
}

/**
 * Exports
 */

exports.parse = parse;