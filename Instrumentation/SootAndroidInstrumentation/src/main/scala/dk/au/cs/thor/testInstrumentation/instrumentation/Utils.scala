package dk.au.cs.thor.testInstrumentation.instrumentation

import java.io._
import java.util.zip._
import java.io.File
import scala.collection.JavaConversions._

object Utils {

  def copyFile(src: File, dest: File) {
    new FileOutputStream(dest) getChannel() transferFrom(
      new FileInputStream(src) getChannel, 0, Long.MaxValue )
  }

  def zip(out: File, files: Iterable[File], basePath: File) = {
//    println("base path is " + basePath)
    def relative(path: File) = {
      (basePath.toURI().relativize(path.toURI())).getPath
    }

    val zip = new ZipOutputStream(new FileOutputStream(out))

    files.foreach { name =>
//      println("zipping " + name + " relativepath " + relative(name))
      zip.putNextEntry(new ZipEntry(relative(name)))
      val in = new BufferedInputStream(new FileInputStream(name))
      var b = in.read()
      while (b > -1) {
        zip.write(b)
        b = in.read()
      }
      in.close()
      zip.closeEntry()
    }
    zip.close()
  }

  def unzip(in: File, out: File) = {
    val zipFile = new ZipFile(in)
    val enm = zipFile.entries()
    while (enm.hasMoreElements) {
      val entry = enm.nextElement()
      val filePath = new File(out, entry.getName);
//      println("writing " + out + " -- " + entry.getName)
      if(entry.isDirectory)
        filePath.mkdirs()
      else {
        filePath.getParentFile.mkdirs()
        filePath.createNewFile()
        val fileout = new FileOutputStream(filePath)
        val unzipedFileIn = zipFile.getInputStream(entry)

        val buf = new Array[Byte](1024)
        var len = 0
        while ( {
          len = unzipedFileIn.read(buf)
          len != -1
        })
          fileout.write(buf, 0, len)
        fileout.close()
      }
    }
  }

  def recursiveListFiles(f: File): Array[File] = {
    val these = f.listFiles
    these ++ these.filter(_.isDirectory).flatMap(recursiveListFiles)
  }
  
  def splitNewLines(x:String):Array[String] =  {
    x.split("\\r?\\n")
  }

}

object Namespaces {
  val Android = "http://schemas.android.com/apk/res/android"
}
