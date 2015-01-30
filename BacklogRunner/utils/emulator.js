var sh = require("execSync");
var exec = require("child_process").exec;
var Promise = require('bluebird')
var adb = require('adbkit')
var ProgressBar = require('progress');

var config = require("../config").config;
var testServer = require("../test-server/test-server");
var child = require('child_process');
var testManager = require("../test-server/test-manager.js");
var TestManagerInterface = testManager.TestManagerInterface;
var AndroidInterface = testManager.AndroidInterface;

var TAG = "emulator";

var client = adb.createClient();

// TODO: - Kill the TestManager server when the device dies

function FakeEventifier() {
  var self = this;

  var current = [];
  var callback = null;
  
  setInterval(function() {
    client.listDevices().then(function(devices) {
      // console.log("Accepted now", devices);
      // console.log("Current devices ", devices);
      /* Accepted devices are the current ones (unless disconnected) + the new ones */
      var acceptedNewDevices = [];
      for (i = 0; i < devices.length; i++) {
        if (devices[i].type == "device" && current.indexOf(devices[i].id) < 0) { 
          // console.log("new device detected ", devices[i]);
          var uuid = sh.exec(config.adbPath +"/adb -s " + devices[i].id + " shell getprop emu.uuid").stdout.trim()
          if (self.connected(devices[i].id, uuid)) {
            acceptedNewDevices.push(devices[i].id);
          } else {
            // console.log(TAG, "new device " + devices[i].id + " refused by the pool");
          }
        } else if (current.indexOf(devices[i].id) >= 0) {
          acceptedNewDevices.push(devices[i].id);
        }
      }
      current = acceptedNewDevices;
    });
  }, 5000);

  this.onConnected = function(cb) {
    callback = cb;
  };

  this.connected = function(serial, uuid) {
    // console.log("connected ", serial)
    if (typeof callback == "function") {
      return callback(serial, uuid);
    }
  };
}
  
function EmulatorPool(num) {
  var self = this;

  /* Serial based maps and lists */
  var emulators = {};
  var availables = [];

  var awaiting = null;

  this.size = !num ? config.modules.emulatorPool.poolSize : num;

  var watchdog = null;
  new FakeEventifier().onConnected(function(serial, uuid) {
  	if (awaiting == null || watchdog != null || awaiting.uuid != uuid) {
      return false;
    }

    var configuringOne = awaiting;
    
    console.log(TAG, "new device found " + serial)
    configuringOne.attachSerial(serial);
    emulators[configuringOne.serial] = configuringOne;

    var afterLoad = function() {
      // Logcat is up, let's unlock the screen and wait another 5 secs
      if (awaiting != configuringOne) {
        console.log("oh oh...someone killed " + configuringOne + " in the meantime");
        return;
      }
      try {
        configuringOne.prepare();
        setTimeout(function() {
          // Now it should be ok, if it is not, someone will kill it
          if(awaiting == configuringOne) {
            console.log(TAG, "device " + configuringOne + " is now available")
            awaiting = null;
            availables.push(serial);
            dispatchAvailable();
          }
          else {
            console.log("oh oh...someone killed " + configuringOne + " in the meantime");
          }
        }, 5000);
      }
      catch(err) {
        console.log("Error preparing the emulator, killing " + err + "".red)
        self.forceKill(function(){})
      }
    }


    watchdog = setInterval( function() {
      if(awaiting != configuringOne) {
        console.log("oh oh...someone killed " + configuringOne + " in the meantime");
        clearInterval(watchdog)
        watchdog = null;
        
      }
      else {
        if(configuringOne.isBooted()) {
          console.log("device " + configuringOne + " is now booted ");
          clearInterval(watchdog)
          setTimeout(function(){
            watchdog = null;
            afterLoad();
          }, 8000)
        }
      }
    }, 4000)
    return true;
  });
  
  var removeEmu = function(serial) {
    if (!serial) {
      return;
    }
    delete emulators[serial];
    
    var aIdx = availables.indexOf(serial);
    if (aIdx >= 0) {
      availables.splice(aIdx, 1);
    }
  };
  
  var releaseEmulator = function(device) {
    if(!emulators[device.serial]) {
      console.log(TAG, "The released emulator " + device + " is no more available, do not recycle after killing".red)
    }
    else {
      var aIdx = availables.indexOf(device.serial)
      if(aIdx >= 0) {
          console.log(TAG, "The device " + device + " is already available ! double recycle ?! ".yellow)
          dispatchAvailable();
      }
      else {
        availables.push(device.serial);
        dispatchAvailable();
      }
    }
  };

  var waitingQueue = [];
  this.pick = function(callback) {
      waitingQueue.push(callback);
      dispatchAvailable();
  };

  var dispatchAvailable = function() {
    if (waitingQueue.length > 0 && availables.length > 0) {
      var goneBusy = availables.shift()
      
      var device = emulators[goneBusy];

      console.log("Device picked " + device + " with serial " + goneBusy);

      var waiter = waitingQueue.shift();
      waiter(device);
    }
  };

  /* Watchdog */
  setInterval(function() {
    /* can not start two emulator together, otherwise I will loose the mapping between
    * emulators serials and emulators obj (with pids)
    * if we are waiting for an emulator, keep waiting, do not start new ones
    */
    if (awaiting == null && watchdog == null && Object.keys(emulators).length < self.size) {
      // console.log(TAG, "#emulators=" + Object.keys(emulators).length + ", size=" + self.size);
      var newOne = null;
      while(newOne == null) {
        try {
          newOne = new Emulator(releaseEmulator, removeEmu);
        }
        catch(err) { console.log("Error creating an emulator ", err) }
      }
      awaiting = newOne;

      console.log(TAG, "emulator object created: " + newOne)

      // Wait for 45 second to be available or busy, otherwise it is lost
      setTimeout(function() {
        if (awaiting == newOne) {
          console.log(TAG, newOne + " is offline");
          awaiting = "HOLD";
          newOne.forceKill(function () {
            awaiting = null;
          });
        } else {
          console.log(TAG, newOne + " is online");
        }
      }, 95000);
    }
  }, 5000);
}

var referencePool = ["emulator1", "emulator2", "emulator3", "emulator4", "emulator5", "emulator6", "emulator7", "emulator8", "emulator9", "emulator11", "emulator12"];

var initialPool = referencePool.slice();

var emInfo = {
  "emulator1": {uuid:"54dd0657-6c80-422a-b938-fb91db1b3cab", toPort:4046, fromPort:4045}, 
  "emulator2": {uuid:"54dd0657-6c80-422a-b938-fb91db1b3cad", toPort:4048, fromPort:4047},
  "emulator3": {uuid:"54dd0657-6c80-422a-b938-fb91db1b3caf", toPort:4050, fromPort:4049},
  "emulator4": {uuid:"54dd0657-6c80-422a-b938-fb91db1b3cbb", toPort:4052, fromPort:4051},
  "emulator5": {uuid:"54dd0657-6c80-422a-b938-fb91db1b3cbd", toPort:4054, fromPort:4053},
  "emulator6": {uuid:"54dd0657-6c80-422a-b938-fb91db1b3cbf", toPort:4056, fromPort:4055},
  "emulator7": {uuid:"54dd0657-6c80-422a-b938-fb91db1b3ccb", toPort:4058, fromPort:4057},
  "emulator8": {uuid:"54dd0657-6c80-422a-b938-fb91db1b3ccd", toPort:4060, fromPort:4059},
  "emulator9": {uuid:"54dd0657-6c80-422a-b938-fb91db1b3ccf", toPort:4062, fromPort:4061},
  "emulator10": {uuid:"54dd0657-6c80-422a-b938-fb91db1b3cda", toPort:4064, fromPort:4063},
  "emulator11": {uuid:"54dd0657-6c80-422a-b938-fb91db1b3cdc", toPort:4066, fromPort:4065}//,
  //"emulator12": {uuid:"54dd0657-6c80-422a-b938-fb91db1b3cdf", toPort:4068, fromPort:4067}
};

function Emulator(recycleCallback, deadcallback) {
  // console.log(TAG, "emulator proxy created");
  var self = this;

  if (initialPool.length == 0) {
    throw "Unable to start so many emulators";
  }

  var bar = new ProgressBar(':bar', { total: 20 });
  var timer = setInterval(function () {
    if (bar.complete) {
      clearInterval(timer);
    }
  }, 500);

  this.name = initialPool.shift()
  this.portForwarded = false;
  this.toPort = emInfo[self.name].toPort;
  this.fromPort = emInfo[self.name].fromPort;
  this.uuid = emInfo[self.name].uuid;

  var stdout = "";
  var stderr = "";

  this.attachSerial = function(serial) {
    bar.tick(4)
    console.log("device " + serial + " is now bound with process " + self.mypid)
    self.serial = serial;
  };

  this.recycle = function() {
    console.log(TAG, "device recycled " + self)
    if(!isVirtualMemoryOk()) {
      console.log("device " + self.serial + " is has exceeded virtual memory, killing ".red)
      self.forceKill(function(){})
    }
    else
      recycleCallback(self);
  };

  
  /**
   * Process info
   */

  var getEmulatorPid = function() {
    var ps = sh.exec("ps aux -e | grep \".*emulator64-x86.*"+ self.uuid +"\"");
   
    var lines = ps.stdout.split("\n");
    lines = lines.filter(function(it) {return it.indexOf("grep") < 0})
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.indexOf("emulator") >= 0) {
        var rgx = /[^\s]*\s*([0-9]*)\s.*/
        var matches = line.match(rgx)
        var result = matches[1]
        if (!isNaN(result)) {
          return parseInt(result);
        }
      }
    }
    return -1;
  };

  var isVirtualMemoryOk = function() {

    var ps = sh.exec("ps aux -e | grep \".*emulator64-x86.*"+ self.uuid +"\"");
   
    var lines = ps.stdout.split("\n");
    lines = lines.filter(function(it) {return it.indexOf("grep") < 0})
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.indexOf("emulator") >= 0) {
        var rgx = /[^\s]+\s+[^\s]+\s+[^\s]+\s+([0-9]+)\s.*/
        var matches = line.match(rgx) 
        var result = matches[1]
        if (!isNaN(result)) {
          // console.log("Detected device with " + parseInt(result) + " virtual memory")
          return (parseInt(result) < 5000000);
        }
      }
    }
    return false;
  }

  var handleEmulatorNameAvailable = function() {
    if (initialPool.indexOf(self.name) < 0) {
        initialPool.push(self.name);
        initialPool.sort(function(a, b){return referencePool.indexOf(a)-referencePool.indexOf(b)});
    }
  }

  var setPortForwarding = function() {
    if(!self.serial)
      throw "Serial not yet attached";
    sh.exec(config.adbPath +"/adb -s " + self.serial + " shell settings put system local-entrypoint-port " + self.toPort); 
    var tmp = sh.exec(config.adbPath +"/adb -s " + self.serial + " forward tcp:" + self.toPort + " tcp:" + self.toPort); 
    //adb shell setting put
    sh.exec(config.adbPath +"/adb -s " + self.serial + " shell settings put system remote-endpoint-port " + self.fromPort); 
    self.portForwarded = true;
  }

  var unlockScreen = function() {
    if (!self.serial) {
      throw "Serial not yet attached";
    }
    sh.exec(config.adbPath + "/adb -s " + self.serial + " shell input keyevent 82");
  }

  var initTestServer = function() {
    if(!self.portForwarded)
      throw "Port forwarding not set correctly";
    self.testManagerInterface = new TestManagerInterface(self);
    self.androidInterface = new AndroidInterface(self);

  }

  this.prepare = function() {
    if(!self.serial) {
      throw "Serial not yet attached";
    }
    bar.tick(4)
    console.log("unlocking the screen")
    //if(!self.attached) {
    //  console.log("and starting logcat ")
    //  child.spawn(config.adbPath +"/adb",["-s",self.serial,"logcat"], {
    //    //detached: true,
    //    //env: process.env
    //  });
    //}
    unlockScreen();
    bar.tick(4)
    // Setting the port-forwarding
    console.log("setting port forwarding")
    setPortForwarding();
    bar.tick(4)
    // Setting the hooks to the AndroidTestInterface
    console.log("starting test server")
    initTestServer();
    bar.tick(4);

  }

  /**
   * Killing.
   */

  this.forceKill = function(callback) {
    var pid = getEmulatorPid();
    if(!self.mypid) self.mypid = pid;
    if(self.testManagerInterface)
      self.testManagerInterface.close();
    /* If the pid is not here, even now... assume it is dead */
    if (self.mypid < 0)
      callback();
    else {
      sh.exec("kill -HUP " + self.mypid)
      setTimeout(function(){
      sh.exec("kill -9 " + self.mypid);
        handleEmulatorNameAvailable()
        setTimeout(function() {
          console.log(self + " is now dead, he leaves us the following messages ", stdout, stderr);
          deadcallback(self.serial);
          callback();
        }, 1000);  
      }, 2000)
    }
  };

  /**
   * Infos.
   */

  this.isBooted = function() {
    if(!self.serial)
      throw "Serial not yet attached";
    var checkBooted = sh.exec(config.adbPath +"/adb -s " + self.serial + " shell getprop sys.boot_completed");
    return (checkBooted.stdout.trim() == "1")
  }
    
  var start = function() {
    console.log(TAG, ("-->------>--- starting emulator " + self.name + " :-)"));
    var runningPid = getEmulatorPid();
    if(runningPid < 0) {
      self.me = child.spawn("./" + self.name, config.modules.emulatorPool.skin ? [config.modules.emulatorPool.skin] : [], {
        detached: true,
        cwd: config.androidPath,
        env: process.env
      });
      // console.log("self.me.pid" + self.me.pid);

      self.me.on('close', function (code) {
        console.log(TAG, "emulator " + self + " exited with code " + code, "out:", stdout, "err:", stderr);
        try {
          clearInterval(pidChecker);
        }
        catch(err) {}
        handleEmulatorNameAvailable();
        deadcallback(self.serial);
      });

      self.me.stdout.on('data', function (data) {
        stdout += data.toString()
      });
      self.me.stderr.on('data', function (data) {
        stderr += data.toString()
      });

      var pidChecker = setInterval(function(){
        var pid = getEmulatorPid()
        if(pid < 0) {
          // console.log(TAG, "pid not found, something wrong when starting the emulator")
          return;
        }
        else clearInterval(pidChecker);
        self.mypid = pid
        self.attached = false;
        console.log(TAG, "emulator started with pid " + self.mypid);
      },2000)
    }
    else {
      console.log(TAG, "attaching the existing emulator, with pid:" + runningPid);
      self.attached = true;
      self.mypid = runningPid
    }
  }

  this.toString = function() {
    return self.name + "(" + (self.serial || "") + ")@" + self.mypid;
  }

  try {
    start();
  }
  catch(err) {
    handleEmulatorNameAvailable()
  }
  
};

exports.Emulator = Emulator;
exports.EmulatorPool = EmulatorPool;
