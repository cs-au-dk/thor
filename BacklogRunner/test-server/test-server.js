var sh = require("execSync");
var config = require("./../config").config;
var net = require("net");
var execFile = require("child_process").execFile;
var Reflect = require('harmony-reflect'); /* for direct proxies ECMA6*/

var Future = require('fibers/future');
var Fiber = require('fibers');

var TAG = "test-server";

var MESSAGE_SPEC_LENGTH = 6;


function RemoteProxy(target, device) {
  return Proxy(target, {
    get: function(target, name, receiver) {
        // console.log("RemoteProxy queried of a _." + name + " property, that is in target:" + (name in target) + "-" +target.hasOwnProperty(name) + "-" + typeof target[name] + " target was:", target);
        if (name != "toString" && (name in target || name == "inspect")) { /* It is a debugging property that is not in the target */
             return target[name]; 
        }

        return function() {
            var args = (arguments.length > 0) ? Array.prototype.slice.call(arguments) : [];
            var future = new Future();
            remoteInvoke(name, target, args, future, device);
            future.wait();
            var result = future.get();
            if (result instanceof Error) {
                throw result;
            } else {
                return result;
            }
        };
    },
    set: function(target, name, val, receiver) {
      if (name in target) {
        target[name] = val;
        return true;
      }
      // everything not found on the target object itself should
      // be added to the target's _attributes map
      target._attributes[name] = val;
      return true;
    }
  });
}

function RemoteReference(val) {
  this.reference = val
}

function toAndroid(value){
    if(value == null) {
        return { type: "VOID", value: "" };
    }
    else if(typeof value == "object") {
        /* then it is a remote reference!! */
        return { type: "REMOTEREF", value: value.reference };
    }
    else {
        return { type: (typeof value).toString().toUpperCase(), value: value };
    }
}
function proxify(obj, device) {
    var rf = new RemoteReference(obj);
    var proxy = new RemoteProxy(rf, device);
    return proxy;
}
function fromAndroid(obj, device) {
    if (obj.type == "REMOTEREF") {
        return proxify(obj.value, device)
    } else if (obj.type == "ARRAY") {
        return obj.value.map(function (x) { return fromAndroid(x, device); });
    } else if (obj.type == "BOOLEAN") {
        if (typeof obj.value != "boolean") {
            console.log(TAG, ("expected boolean, but was " + (typeof obj.value)).red);
        }
        return typeof obj.value == "boolean" ? obj.value : obj.value == "true";
    } else if (obj.type == "NUMBER") {
        if (typeof obj.value != "number") {
            console.log(TAG, ("expected number, but was " + (typeof obj.value)).red);
        }
        return typeof obj.value == "number" ? obj.value : parseInt(obj.value);
    }
    return obj.value;
}

function remoteInvoke(method, obj, params, future, device) {
    // var time = Date.now();
    var client = net.connect({ port: device.toPort, host: "127.0.0.1" }, function() { //'connect' listener
        // console.log('client connected in ' + (Date.now() - time) + " milliseconds");
        // time = Date.now();
        // console.log("remoteInvoke-->" + device.toPort);
        sendInvoke(client, method, obj, params);
    });

    var buffer = "";
    client.on('data', function(data) {
        buffer += data;
    });
    client.on('end', function() {
        try {
            var len = parseInt(buffer.substring(0, MESSAGE_SPEC_LENGTH), 10);
            client.end();
            var objStr = buffer.substring(MESSAGE_SPEC_LENGTH);
            var obj = JSON.parse(objStr);
            var unboxedObj = fromAndroid(obj, device);
            future.return(unboxedObj);
        }
        catch(err) {
            console.log(TAG, ("error receiving response of remote invocation of " + method + ", buffer:").red, buffer);
            client.end();
            future.return(new Error());
        }
    });
}

function sendInvoke(socket, method, obj, params) {
    var boxedParams = params.map(toAndroid);
    var inv = { method: method, obj: toAndroid(obj), params: boxedParams };
    var invStr = JSON.stringify(inv);
    var responseLength = new String(Buffer.byteLength(invStr, "utf8"));
    var responsePrefixPadding = "000000";
    var responsePrefix = responsePrefixPadding.substring(0, responsePrefixPadding.length - responseLength.length) + responseLength;
    socket.write(responsePrefix + invStr);
}

function connectionListener(device) {
    var rt = function(socket) {
        socket.setEncoding("utf8");

        // console.log("incomingConnection", socket);
        var buffer = "";
        var charsToRead = -1;
        var closed = false;
        var ignore = false;

        function checkBuffer() {
            if (charsToRead == -1) {
                if (buffer.length < MESSAGE_SPEC_LENGTH) {
                    // Not ready yet
                    return false;
                } else {
                    charsToRead = parseInt(buffer.substring(0, MESSAGE_SPEC_LENGTH), 10);
                }
            }

            if (Buffer.byteLength(buffer, "utf8") == charsToRead + MESSAGE_SPEC_LENGTH) {
                // Done reading
                receive(buffer.substring(MESSAGE_SPEC_LENGTH, charsToRead + MESSAGE_SPEC_LENGTH));
                return true;
            } else {
                return false;
            }
        }

        function receive(message) {
            var cmds;
            try {
              cmds = JSON.parse(message);
            } catch (err) {
                console.log(TAG, "could not parse message".red, message);
                return;
            }
            for (var i = 0; i < cmds.length; i++) {
                var cmd = cmds[i];
                if (cmd.cmd == "TEST_MANAGER_RPC") {
                    if (cmd.method) {
                        receiveInvokeCmd(cmd);
                    } else if (cmd.object && cmd.property) {
                        receiveReadWritePropertyCmd(cmd); 
                    } else {
                        console.log(TAG, "neither invoke nor read/write cmd".red, JSON.stringify(cmd));
                    }
                } else {
                    console.log(TAG, "unknown cmd".red, JSON.stringify(cmd));
                }
            }
        }

        function receiveInvokeCmd(cmd) {
            try {
                var unboxedParams;
                if (cmd.parameters) {
                    var curry = function(obj) {
                        return fromAndroid(obj,device);
                    }

                    unboxedParams = cmd.parameters.map(curry);
                }
                
                var mtd = device.testManagerInterface[cmd.method];
                var response = mtd.apply(null, unboxedParams);
                if (typeof response == "undefined") {
                    send(toAndroid(null));
                } else {
                    send(toAndroid(response));
                }
            }
            catch (err) {
                console.log(TAG, "Error in receiveInvokeCmd(" + cmd + ")".red, err, err.stack);
                throw err;
            }
        }

        function receiveReadWritePropertyCmd(cmd) {
            try {
                if (cmd.hasOwnProperty("value")) {
                    if (cmd.value.type != (typeof device.testManagerInterface[cmd.object][cmd.property]).toUpperCase()) {
                        console.log(TAG, ("possible type violation for "+ cmd.object + "." + cmd.property 
                            + ", assigning " + cmd.value.type + " to " 
                            + (typeof device.testManagerInterface[cmd.object][cmd.property]).toUpperCase()).yellow);
                    }

                    device.testManagerInterface[cmd.object][cmd.property] = fromAndroid(cmd.value, device);
                }

                var response = device.testManagerInterface[cmd.object][cmd.property];
                var type = (typeof response).toUpperCase();

                if (type == "UNDEFINED") {
                    console.log(TAG, "undefined value of " + cmd.object + "." + cmd.property + " forthcoming problems".red);
                }

                send(toAndroid(response));
            }
            catch (err) {
                console.log(TAG, "Error in receiveReadWritePropertyCmd()".red, err);
                throw err;
            }
        }

        function send(obj) {
            var responseString = JSON.stringify(obj);
            var responseLength = new String(Buffer.byteLength(responseString, "utf8"));
            var responsePrefixPadding = "000000";
            var responsePrefix = responsePrefixPadding.substring(0, responsePrefixPadding.length - responseLength.length) + responseLength;
            socket.write(responsePrefix + responseString);
        }

        socket.on("data", function (data) {
            if (!closed) {
                buffer += data;
                Fiber(function() {
                    if (checkBuffer()) {
                        socket.end();
                        closed = true;
                    }
                }).run();
            }
        });
    }
    return rt;
}

function start(device) {
    console.log("device " + device + " can now communicate on port " + device.fromPort)
    var srv = net.createServer(connectionListener(device)).listen(device.fromPort);

    srv.on("close", function() {
        console.log(TAG, "server for " + device + " closed");
    });

    return srv;
}

/**
 * Exports
 */

exports.start = start;