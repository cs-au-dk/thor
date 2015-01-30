package dk.au.cs.thor.testInstrumentation.handling

import java.io.File

import dk.au.cs.thor.testInstrumentation.instrumentation.{App, Globs, Utils}

class ApkCooker(app: App, folder:File) {

  val apkFile = new File(app.files.testApk)

  val deApkFld = new File(folder, apkFile.getName)
  val sootTmpDir = new File(folder, "tmp")
  private val classesOrig = new File(deApkFld, "classes.dex")
  private val sootTmpOut = new File(sootTmpDir, "classes.dex")

  deApkFld.mkdirs()
  sootTmpDir.mkdirs()

  def deapk() = {

    println("Unzipping from " + apkFile + " into " + deApkFld)
    Utils.unzip(apkFile, deApkFld)

    apkFile.renameTo(new File(apkFile.getAbsolutePath + "-old"))

    println("Copying " + classesOrig + " into " + sootTmpOut)
    Utils.copyFile(classesOrig, sootTmpOut)
    
  }
  
  def reapk() = {

    println("Copying " + sootTmpOut + " into " + classesOrig)
    Utils.copyFile(sootTmpOut, classesOrig)

    def listFiles(fl: File): List[File] = fl.listFiles().toList.foldLeft(List[File]()) ((l, fl) =>
      if (!fl.isDirectory) fl :: l else listFiles(fl) ::: l)

    println("Zipping from " + deApkFld + " into " + apkFile)
    Utils.zip(apkFile, listFiles(deApkFld), deApkFld)
    
  }
  
}