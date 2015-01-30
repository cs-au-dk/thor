package dk.au.cs.thor.testInstrumentation.handling

import java.io.File
import java.util

import dk.au.cs.thor.testInstrumentation.instrumentation._
import soot.{Unit => SootUnit, _}
import soot.jimple.toolkits.scalar.ConstantPropagatorAndFolder
import soot.options.Options

import scalax.file.Path
import scala.sys.process._
import scala.collection.JavaConversions._

object SootRunners {

  
  def sootAndroidInstrumentApp(sootOptions:SootOptions): Unit = {
    try {
      
      val pathin = sootOptions.PathIn
      val pathout = sootOptions.PathOut
      val app = sootOptions.App
      
      println("analysing..." + pathout + " output in " + pathout)
      G.reset()

      // Options.v().set_verbose(true);
      Options.v().set_src_prec(Options.src_prec_dex)
      Options.v().set_output_format(sootOptions.Output)

      Options.v().set_allow_phantom_refs(true)
      // Options.v().set_keep_line_number(true)

      val procDir = new util.ArrayList[String]()
      procDir.add(pathin.getAbsolutePath)
   
      Options.v().set_include_all(true)

      Options.v().set_process_dir(procDir)
      Options.v().set_output_dir(pathout.getAbsolutePath)
      Options.v().set_soot_classpath(Globs.Configuration.androidFrameworkStubsLocation + ":" + app.dirs.appClasses)

      PhaseOptions.v().setPhaseOption("jop", "on")

      Scene.v().loadClass(Globs.Classes.Instrumentation.EventManager.name, SootClass.SIGNATURES)
      Scene.v().loadClass(Globs.Classes.Instrumentation.TracingSupport.name, SootClass.SIGNATURES)
      
      println("Processing dir is " + procDir)

      Scene.v().loadNecessaryClasses()
      Scene.v().loadBasicClasses()

      PackManager.v().getPack("jtp").add(new Transform("jtp.EventGraphInstrumentation", new EventGraphInstrumentation()))
      PackManager.v().getPack("jtp").add(new Transform("jtp.ViewHierarchyRemover", new ViewHierarchyRemover()))

      PackManager.v().runPacks()

      if (!Options.v().oaat()) {
        PackManager.v().writeOutput()
      }

      // Cleanup

      ("rm -rf " + Globs.Configuration.outDir + "/" + app.id)!

      ("mkdir -p " + Globs.Configuration.outDir + "/" + app.id)!

      // Run phases

      
    } catch {
      case e: Exception =>
        Log.err("SootRunners.sootAndroidInstrumentApp", s"${e}")
        e.getStackTrace.foreach (trace => Log.err("SootRunners.sootAndroidInstrumentApp", s"${trace}"))
        throw e
    }
  }
  
}