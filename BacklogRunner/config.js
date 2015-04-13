exports.config = {
  adbPath: process.platform=="darwin"?"/Volumes/Android4.4.3/thor/Android/out/host/darwin-x86/bin"
  :"/Volumes/Android4.4.3/thor/Android/out/host/linux-x86/bin",
  androidPath: "/Volumes/Android4.4.3/thor/Android",
  backlogOutPath: process.env.HOME + "/backlogOut",
  debug: true,
  modules: {
    aggregation: {
      outDir: process.env.HOME + "/backlogOut/aggregates"
    },
    compare: {
      dir: "/Volumes/Android4.4.3/thor/BacklogRunner/compare",
      resultDir: process.env.HOME + "/backlogOut/comparisons"
    },
    coverage: {
      rawDir: process.env.HOME + "/backlogOut/coverage/raw",
      reportDir: process.env.HOME + "/backlogOut/coverage/reports"
    },
    emulatorPool: {
      poolSize: 1,
      skin: "WXGA800"
    },
    graph: {
      outDir: process.env.HOME + "/backlogOut/graph",
      remoteDir: "/out/graph"
    },
    spoonrunner: {
      outDir: process.env.HOME + "/backlogOut/spoonruns"
    },
    superGraph: {
      outDir: process.env.HOME + "/backlogOut/super-graphs",
      outDirRel: "out/super-graphs",
      remoteDir: "/out/super-graphs"
    },
    testextractor: {
      outDir: process.env.HOME + "/backlogOut/test-extractor"
    },
    viewBugChecker: {
      outDir: process.env.HOME + "/backlogOut/view-bugs"
    },
    appData: {
      outDir: process.env.HOME + "/backlogOut/app-data"
    }
  },
  projects: {
    "org.liberty.android.fantastischmemo": {
      srcDir: "/Volumes/Android4.4.3/thor/Applications/AnyMemo/src",
      classDir: "/Volumes/Android4.4.3/thor/Applications/AnyMemo/build/intermediates/classes/pro/debug",
      apks: {
        debug: "/Volumes/Android4.4.3/thor/Applications/AnyMemo/build/apk/AnyMemo-pro-debug-unaligned.apk",
        debugTest: "/Volumes/Android4.4.3/thor/Applications/AnyMemo/build/apk/AnyMemo-pro-debug-test-unaligned.apk"
      }
    },
    "com.jadn.cc": {
      srcDir: "/Volumes/Android4.4.3/thor/Applications/Car-Cast/cc/src",
      classDir: "/Volumes/Android4.4.3/thor/Applications/Car-Cast/build/intermediates/classes/debug",
      apks: {
        debug: "/Volumes/Android4.4.3/thor/Applications/Car-Cast/build/outputs/apk/Car-Cast-debug-unaligned.apk",
        debugTest: "/Volumes/Android4.4.3/thor/Applications/Car-Cast/build/outputs/apk/Car-Cast-debug-test-unaligned.apk"
      }
    },
    "com.numix.calculator": {
      srcDir: "/Volumes/Android4.4.3/thor/Applications/com.numix.calculator/app/src",
      classDir: "/Volumes/Android4.4.3/thor/Applications/com.numix.calculator/app/build/intermediates/classes/debug",
      apks: {
        debug: "/Volumes/Android4.4.3/thor/Applications/com.numix.calculator/app/build/outputs/apk/app-debug-unaligned.apk",
        debugTest: "/Volumes/Android4.4.3/thor/Applications/com.numix.calculator/app/build/outputs/apk/app-debug-test-unaligned.apk"
      }
    },
    "org.catrobat.catroid": {
      srcDir: "/Volumes/Android4.4.3/thor/Applications/Catroid-latest/catroid/src",
      classDir: "/Volumes/Android4.4.3/thor/Applications/Catroid-latest/build/intermediates/classes/debug",
      apks: {
        debug: "/Volumes/Android4.4.3/thor/Applications/Catroid-latest/build/outputs/apk/Catroid-latest-debug-unaligned.apk",
        debugTest: "/Volumes/Android4.4.3/thor/Applications/Catroid-latest/build/outputs/apk/Catroid-latest-debug-test-unaligned.apk"
      }
    },
    "org.catrobat.paintroid": {
      srcDir: "/Volumes/Android4.4.3/thor/Applications/Paintroid/Paintroid/src",
      classDir: "/Volumes/Android4.4.3/thor/Applications/Paintroid/build/intermediates/classes/debug",
      apks: {
        debug: "/Volumes/Android4.4.3/thor/Applications/Paintroid/build/outputs/apk/Paintroid-debug-unaligned.apk",
        debugTest: "/Volumes/Android4.4.3/thor/Applications/Paintroid/build/outputs/apk/Paintroid-debug-test-unaligned.apk"
      }
    }
  },
  spoonPath: "spoon/spoon-runner/target/spoon-runner-1.1.2-SNAPSHOT-jar-with-dependencies.jar",
};
