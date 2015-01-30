package dk.au.cs.thor.testInstrumentation.instrumentation

import java.util

import soot._
import soot.jimple.Jimple

/**
 * Created by mezzetti on 11/09/14.
 */
object SootUtilities {

  def checkMethods(cls: String, t : Type): SootMethod = {
    val klass = Scene.v().getSootClass(cls)
    if(klass.resolvingLevel() == SootClass.DANGLING) {

      /* generating method */
      var arg = Scene.v().getRefType(cls);
      var params = new util.ArrayList[Type];
      params.add(arg)
      var mref = Scene.v().makeMethodRef(
        Scene.v().getSootClass(cls),
        "valueOf",
        params,
        arg,
        true
      )
      mref.resolve();
      return klass.getMethod("valueOf", util.Arrays.asList(t))
    }
    else
      return klass.getMethod("valueOf", util.Arrays.asList(t))
  }

  def getSwitchMethod(v : Value) : SootMethod = {
    v.getType match {
      case arr: ArrayType => {
        return null; // An array seems to be an Object :-)
      }
      case t: BooleanType => {
        return checkMethods("java.lang.Boolean", t)
      }
      case t: ByteType => {
        /* Got integer on dalvik in place of byte */
        val newt = IntType.v()
        return checkMethods("java.lang.Integer", newt)
//        return checkMethods("java.lang.Byte", t)
      }
      case t: CharType => {
        return checkMethods("java.lang.Character", t)
      }
      case t: DoubleType => {
        return checkMethods("java.lang.Double", t)
      }
      case t: FloatType => {
        return checkMethods("java.lang.Float", t)
      }
      case t: IntType => {
        return checkMethods("java.lang.Integer", t)
      }
      case t: LongType => {
        return checkMethods("java.lang.Long", t)
      }
      case t: ShortType => {
        /* Got integer on dalvik in place of short */
        val newt = IntType.v()
        return checkMethods("java.lang.Integer", newt)
      }
      case _ => {
        return null;
      }
    }
  }
  var counter = 0L;
  def addTmpRef(body: Body): Local =
  {
    counter+=1
    val tmpRef = Jimple.v().newLocal("tmpRef"+counter, RefType.v("test"));
    body.getLocals().add(tmpRef);
    return tmpRef;
  }

  def addTmpString(body: Body): Local =
  {
    counter+=1
    val tmpString = Jimple.v().newLocal("tmpString"+counter, RefType.v("java.lang.String"));
    body.getLocals().add(tmpString);
    return tmpString;
  }
  def addTmpInt(body: Body): Local =
  {
    counter+=1
    val tmpInt = Jimple.v().newLocal("tmpInt"+counter, IntType.v());
    body.getLocals().add(tmpInt);
    return tmpInt;
  }
  def addTmpObj(body: Body): Local =
  {
    counter+=1
    val tmpObj = Jimple.v().newLocal("tmpObj"+counter, RefType.v("java.lang.Object"));
    body.getLocals().add(tmpObj);
    return tmpObj;
  }
  def addPrintStreamRef(body: Body): Local =
  {
    counter+=1
    val tmpRef = Jimple.v().newLocal("tmpPrintStream"+counter, RefType.v("java.io.PrintStream"));
    body.getLocals().add(tmpRef);
    return tmpRef;
  }
  def addArrayLocal(body: Body): Local =
  {
    counter+=1
    val tmp = Jimple.v().newLocal("argsArray"+counter, ArrayType.v(Scene.v().getRefType("java.lang.Object"), 1));
    body.getLocals.add(tmp);
    return tmp;
  }

}
