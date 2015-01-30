package dk.au.cs.thor.gradle

import org.gradle.api.Project
import org.gradle.api.Plugin
import org.gradle.api.tasks.Exec

public class InstrumentationPlugin implements Plugin<Project> {
  String sootPath = "/Volumes/Android4.4.3/thor/Instrumentation/SootAndroidInstrumentation/build/install/SootAndroidInstrumentation/bin/SootAndroidInstrumentation"
  String workDir = "/Volumes/Android4.4.3/thor/Instrumentation/SootAndroidInstrumentation/"
  
  void apply(Project project) {
    project.configure(project) {
      if (it.hasProperty("android")) {
        logger.warn("Test variants...")
        project.android.testVariants.all { variant ->
          logger.warn("outputFile:" + variant.packageApplication.outputFile.toString())
          logger.warn("packageApplication:" + variant.packageApplication.toString())

          def mytask = project.tasks.create("runtask${variant.baseName}", Exec.class)

          mytask.configure {
            dependsOn variant.packageApplication
            doLast {
              println "Done instrumenting the tests"
            }
            workingDir "${workDir}"
            commandLine "${sootPath}"
            args = ["${variant.packageApplication.outputFile}"]
          }

          variant.packageApplication.doLast {
            println "Working on " + variant.packageApplication.outputFile
            mytask.execute()
          }
        }

        logger.warn("Application variants...");
      }
    }
  }
}
