package dk.au.cs.thor.testInstrumentation.instrumentation

import com.typesafe.config.ConfigFactory

import scala.xml.XML
import java.io.File

object Globs {
  object Configuration {
    val v = ConfigFactory.load(Globs.getClass.getClassLoader)
    val outDir = v.getString("app.outDir")
    val androidCoreLocation = v.getString("app.androidCoreLocation")
    val androidFrameworkStubsLocation = v.getString("app.androidFrameworkStubsLocation")
  }

  object Packages {
    object Espresso {
      val Latest = "android.support.test.espresso"
      val Old = "com.google.android.apps.common.testing.ui.espresso"
    }
  }

  object Classes {
    object Instrumentation {
      val logTag = "TestOrchestrator"

      object TracingSupport {
        val name = "android.os.TracingSupport"
      }

      object EventManager {
        val name = "android.app.EventManager"
        val notifyNewTestActionMethod = "void notifyNewTestStatement(java.lang.String,java.lang.Object[])"
      }
    }

    object Espresso {
      object Latest {
        val Builder = "android.support.test.espresso.NoMatchingViewException$Builder"
      }
      object Old {
        val Builder = "com.google.android.apps.common.testing.ui.espresso.NoMatchingViewException$Builder"
      }
    }
  }

  object Signatures {
    object Espresso {
      object Latest {
        val check = "<com.google.android.apps.common.testing.ui.espresso.ViewInteraction: com.google.android.apps.common.testing.ui.espresso.ViewInteraction check(com.google.android.apps.common.testing.ui.espresso.ViewAssertion)>"
        val perform = "<com.google.android.apps.common.testing.ui.espresso.ViewInteraction: com.google.android.apps.common.testing.ui.espresso.ViewInteraction perform(com.google.android.apps.common.testing.ui.espresso.ViewAction[])>"
      }

      object Old {
        val check = "<android.support.test.espresso.ViewInteraction: android.support.test.espresso.ViewInteraction check(android.support.test.espresso.ViewAssertion)>"
        val perform = "<android.support.test.espresso.ViewInteraction: android.support.test.espresso.ViewInteraction perform(android.support.test.espresso.ViewAction[])>"
      }
    }
  }

  private val xmlFile = io.Source.fromInputStream(getClass.getResourceAsStream("/apps.xml")).mkString
  private val xml = XML.loadString(xmlFile)

  val apps = for {
    appElem <- xml \ "app"
    id = (appElem \ "@id").text
    dirs = (for (dirElem <- appElem \ "dirs" \ "dir") yield ((dirElem \ "@name").text, dirElem.text)).toMap
    files = (for (fileElem <- appElem \ "files" \ "file") yield ((fileElem \ "@name").text, fileElem.text)).toMap
  } yield new App(id, new App.Dirs(dirs), new App.Files(files))
}

case class App(val id: String, val dirs: App.Dirs, val files: App.Files)

object App {

  case class Dirs(val base: String, val appBase: String, val appClasses: String, val appResources: String) {
    def this(dirs: Map[String, String]) = this(
      dirs.getOrElse("BASE", null),
      dirs.getOrElse("APP_BASE", null),
      dirs.getOrElse("APP_CLASSES", null),
      dirs.getOrElse("APP_RESOURCES", null)
    )
  }

  case class Files(val appResourcesValues: String, val testApk: String) {
    def this(files: Map[String, String]) = this(
      files.getOrElse("APP_RESOURCES_VALUES", null),
      files.getOrElse("TEST_APK", null)
    )
  }
  
}