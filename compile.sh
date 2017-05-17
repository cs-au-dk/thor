#!/bin/bash

HOMEFOLDER="/home/$USER"
THORP="/Volumes/Android4.4.3/thor"

case "$(uname -s)" in
Linux)
  ;;

Darwin)
  HOMEFOLDER="/Users/$USER"
  ;;

*)
  echo "Unsupported OS"
  exit 1
  ;;
esac

JAVA_VERSION=`java -version 2>&1`

if [[ $JAVA_VERSION == *"java version \"1.7"* ]]; then
  echo "Using java 7"
else
  echo "java 7 is required"
  exit 1
fi

echo "Building the Gradle plugin"

(cd $THORP/GradlePlugin && ./gradlew install)

echo "Building the instrumentation"

(cd $THORP/Instrumentation/SootAndroidInstrumentation && ./gradlew install)

echo "Building the Espresso wrapper"

(cd $THORP/Robotium2Espresso && ./gradlew install)

echo "Compiling app: AnyMemo"

(cd $THORP/Applications/AnyMemo && ./gradlew assembleProDebug assembleProDebugTest)

echo "Compiling app: Car-Cast"

(cd $THORP/Applications/Car-Cast && ./gradlew assembleDebug assembleDebugTest)

echo "Compiling app: Numix Calculator"

(cd $THORP/Applications/com.numix.calculator && ./gradlew assembleDebug assembleDebugTest)

echo "Compiling app: Pocket Code"

(cd $THORP/Applications/Catroid-latest && ./gradlew assembleDebug assembleDebugTest)

echo "Compiling app: Pocket Paint"

(cd $THORP/Applications/Paintroid && ./gradlew assembleDebug assembleDebugTest)

