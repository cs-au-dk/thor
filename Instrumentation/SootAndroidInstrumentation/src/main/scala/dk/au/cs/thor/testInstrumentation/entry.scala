package dk.au.cs.thor.testInstrumentation
import java.io.{File, FilenameFilter}
import java.util

import dk.au.cs.thor.testInstrumentation.instrumentation._
import dk.au.cs.thor.testInstrumentation.handling.{SootRunners, ApkCooker}
import soot._
import soot.jimple.toolkits.scalar.ConstantPropagatorAndFolder
import soot.options.Options

import scala.sys.process.Process
import scalax.file.Path

object entry {
  val forcedLibrary = List("android.os.TracingSupport", "android.os.ProcessEntryPoint",
    "android.util.ProcessGsonHelper", "android.os.Process", "android.widget.TextClock",
    "android.view.ViewGroup", "android.widget.PopupWindow")
  
  def instrumentApplication(app:App) = {
    val apkCooker = new ApkCooker(app, new File(Globs.Configuration.outDir))
    val in = apkCooker.deapk()
    val opt = SootOptions(apkCooker.sootTmpDir, apkCooker.sootTmpDir, app)
    SootRunners.sootAndroidInstrumentApp(opt)
    apkCooker.reapk()
  }

  def libraryMain(arg:String): scala.Unit = {
    var arr = new Array[String](1)
    arr(0) = arg
    main(arr)
  }
  def main(args: Array[String]): scala.Unit = {
    try {
      println("Arguments: " + args.toList)

      cleanUp

      println("Working on file " + args(0))
      val app = Globs.apps.find(_.files.testApk.equals(args(0))).get
      instrumentApplication(app)

    } catch {
      case e: Exception =>
        Log.err("entry", s"${e}")
        e.getStackTrace foreach (trace => Log.err("entry", s"${trace}"))
        throw e
    }
  }

  def cleanUp() = {
    val outputtedApks = new File("instrumentation").listFiles(new FilenameFilter {
      override def accept(file: File, name: String) = name.endsWith(".apk")
    })
    if (outputtedApks != null) {
      outputtedApks.foreach(_.delete())
    }
  }
}