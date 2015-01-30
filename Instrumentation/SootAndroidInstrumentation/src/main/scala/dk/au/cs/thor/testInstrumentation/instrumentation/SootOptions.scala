package dk.au.cs.thor.testInstrumentation.instrumentation

import java.io.File

import soot.options.Options

case class SootOptions( PathIn:File,
                    PathOut:File,
                    App:App,
                    Output:Int = Options.output_format_dex
)