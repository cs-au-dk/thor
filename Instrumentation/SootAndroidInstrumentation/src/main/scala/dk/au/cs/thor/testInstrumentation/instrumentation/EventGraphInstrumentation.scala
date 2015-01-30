package dk.au.cs.thor.testInstrumentation.instrumentation

import soot._
import soot.jimple._

import scala.collection.JavaConversions._

class EventGraphInstrumentation extends BodyTransformer {

  override def internalTransform(b: soot.Body, phaseName: String, options: java.util.Map[String, String]): scala.Unit = {
    val units = b.getUnits();

    //important to use snapshotIterator here
    val it = units.snapshotIterator();
    while (it.hasNext()) {
      val cUnit = it.next();
      val u = cUnit.asInstanceOf[Stmt];
      if (u.containsInvokeExpr()) {
        val invokeExpr = u.getInvokeExpr;

        val isEspressoCheckInvocation = invokeExpr.getMethod().getSignature().equals(Globs.Signatures.Espresso.Latest.check) ||
                                        invokeExpr.getMethod().getSignature().equals(Globs.Signatures.Espresso.Old.check)
        val isEspressoPerformInvocation = invokeExpr.getMethod().getSignature().equals(Globs.Signatures.Espresso.Latest.perform) ||
                                          invokeExpr.getMethod().getSignature().equals(Globs.Signatures.Espresso.Old.perform)

        if (isEspressoCheckInvocation || isEspressoPerformInvocation) {


          /* We are sure it is on an instance of a ViewMatcher */
          val base = invokeExpr.asInstanceOf[InstanceInvokeExpr].getBase

          val args = invokeExpr.getArgs()
          /*
            * Creating the array:  (1) create a new local
            * variable, then (2) assign the new-array expression
            * to that variable.
            */
          val arrayVar = Jimple.v().newLocal("EventArgsArray", ArrayType.v(Scene.v().getRefType("java.lang.Object"), 1));
          b.getLocals.add(arrayVar);
          var arrExp = Jimple.v().newNewArrayExpr(Scene.v().getRefType("java.lang.Object"), IntConstant.v(args.size() + 1));
          units.insertBefore(Jimple.v().newAssignStmt(arrayVar, arrExp), u);

          units.insertBefore(
            Jimple.v().newAssignStmt(Jimple.v().newArrayRef(arrayVar, IntConstant.v(0)),
              base),
            u);

          /* Putting the method signature in a string local */
          val tmpString = addTmpString(b);
          units.insertBefore(Jimple.v().newAssignStmt(tmpString,
            StringConstant.v(invokeExpr.getMethod().getSignature())), u);

          /* Assigning the parameters to the array */
          var count = 1;
          args.toList.foreach {
            arg =>
              units.insertBefore(
                Jimple.v().newAssignStmt(Jimple.v().newArrayRef(arrayVar, IntConstant.v(count)),
                  arg),
                u);
              count += 1;
          }

          val toCall = Scene.v().getSootClass(Globs.Classes.Instrumentation.EventManager.name).getMethod(Globs.Classes.Instrumentation.EventManager.notifyNewTestActionMethod);
          units.insertBefore(Jimple.v().newInvokeStmt(
            Jimple.v().newStaticInvokeExpr(toCall.makeRef(), tmpString, arrayVar)), u);

          //check that we did not mess up the Jimple
          b.validate();
        }
      }
    }
  }

  def addTmpRef(body: Body): Local = {
    val tmpRef = Jimple.v().newLocal("EventTmpRef", RefType.v("test"));
    body.getLocals().add(tmpRef);
    return tmpRef;
  }

  def addTmpString(body: Body): Local = {
    val tmpString = Jimple.v().newLocal("EventTmpString", RefType.v("java.lang.String"));
    body.getLocals().add(tmpString);
    return tmpString;
  }

  def addPrintStreamRef(body: Body): Local = {
    val tmpRef = Jimple.v().newLocal("EventTmpPrintStream", RefType.v("java.io.PrintStream"));
    body.getLocals().add(tmpRef);
    return tmpRef;
  }
}