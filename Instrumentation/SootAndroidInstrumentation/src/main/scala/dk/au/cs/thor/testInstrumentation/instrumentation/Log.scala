package dk.au.cs.thor.testInstrumentation.instrumentation

object Log {
  def d(tag: String, log: String) = println(tag + ": " + log)

  def i(tag: String, msg: String) = println(Console.BLUE + s"[${tag}] ${msg}" + Console.BLACK)

  def v(tag: String, msg: String) = println(s"[${tag}] ${msg}")

  def warn(tag: String, msg: String) = println(Console.RED + s"[${tag}] ${msg}" + Console.BLACK)

  def err(tag: String, msg: String) = println(Console.RED_B + s"[${tag}] ${msg}" + Console.WHITE_B)
}