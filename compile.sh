#!/bin/bash

THORP="/Volumes/Android4.4.3/thor/"
echo "Building the Gradle plugin"

(cd ${THORP}GradlePlugin && ./gradlew install)

echo "Building the instrumentation"

(cd ${THORP}Instrumentation/SootAndroidInstrumentation && ./gradlew install)

echo "Building the Espresso wrapper"

(cd ${THORP}Robotium2Espresso && ./gradlew install)

echo "Compiling app: AnyMemo"

(cd ${THORP}Applications/AnyMemo && ./gradlew assembleProDebug assembleProDebugTest)

echo "Compiling app: Car-Cast"

(cd ${THORP}Applications/Car-Cast && ./gradlew assembleDebug assembleDebugTest)

echo "Compiling app: Numix Calculator"

(cd ${THORP}Applications/com.numix.calculator && ./gradlew assembleDebug assembleDebugTest)

echo "Compiling app: Pocket Code"

(cd ${THORP}Applications/Catroid-latest && ./gradlew assembleDebug assembleDebugTest)

echo "Compiling app: Pocket Paint"

(cd ${THORP}Applications/Paintroid && ./gradlew assembleDebug assembleDebugTest)

