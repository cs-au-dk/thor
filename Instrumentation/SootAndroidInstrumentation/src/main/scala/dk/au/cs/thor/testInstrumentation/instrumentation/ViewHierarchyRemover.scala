package dk.au.cs.thor.testInstrumentation.instrumentation

import soot._
import soot.jimple._

class ViewHierarchyRemover extends BodyTransformer {
  override def internalTransform(b: soot.Body, phaseName: String, options: java.util.Map[String, String]): scala.Unit = {
    val isBuilder = b.getMethod.getDeclaringClass.getName.contains(Globs.Classes.Espresso.Latest.Builder) ||
                    b.getMethod.getDeclaringClass.getName.contains(Globs.Classes.Espresso.Old.Builder)
    if (isBuilder && b.getMethod.getName.contains("<init>")) {
      val field = new internal.JInstanceFieldRef(b.getThisLocal, b.getMethod.getDeclaringClass.getFieldByName("includeViewHierarchy").makeRef())
      val units = b.getUnits()
      val last = units.getLast
      units.insertBefore( Jimple.v().newAssignStmt(field, IntConstant.v(0)) , last)

//      while(it.hasNext) {
//        val cur = it.next()
//        if(cur.isInstanceOf[AssignStmt]){
//          val ass = cur.asInstanceOf[AssignStmt]
//          println( " left " + ass.getLeftOp.getClass + " right " + ass.getRightOp.getClass + " instr " + ass)
//        }
//
//      }
      b.validate()
    }
  }
}