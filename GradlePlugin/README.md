# Instrumentation Gradle Plugin 

Forked from https://github.com/crashlytics/gradle-plugin-example.

Original README follows.

# Original Readme

![image](http://www.crashlytics.com/blog/wp-content/uploads/2013/07/Gradle.png)

This project is an example of a Gradle plugin based on the contents of this blog post:
http://www.crashlytics.com/blog/defining-custom-pre-and-post-processing-tasks-in-gradle



## What's here:

* plugin : The preprocessor plugin
* exampleProjects/basicExample : An example project with no flavors
* exampleProjects/multiFlavorExample : An example project with multiple flavors

## How to use:

To test, first move to the plugin folder

    $ cd plugin
    
Then install the plugin to your local repository

    $ gradle install  

Then change directory to an example project

    $ cd ../exampleProjects/multiFlavorExample/MultiFlavorExample  

Finally, assemble the example project using the installed plugin  

    $ gradle assemble  

You should see "\*\*\*Hello World!***" in your output.  

## Contact

Questions? Suggestions? Contact @jakeout on Twitter.
