#!/bin/bash

echo "Building the Gradle plugin"

(cd GradlePlugin && ./gradlew install)

echo "Building the instrumentation"

(cd Instrumentation/SootAndroidInstrumentation && ./gradlew install)

echo "Building the Espresso wrapper"

(cd Robotium2Espresso && ./gradlew install)

echo "Compiling app: AnyMemo"

(cd Applications/AnyMemo && ./gradlew assembleFreeDebug assembleProDebugTest)

echo "Compiling app: Car-Cast"

(cd Applications/Car-Cast && ./gradlew assembleDebug assembleDebugTest)

echo "Compiling app: Numix Calculator"

(cd Applications/com.numix.calculator && ./gradlew assembleDebug assembleDebugTest)

echo "Compiling app: Pocket Code"

(cd Applications/Catroid-latest && ./gradlew assembleDebug assembleDebugTest)

echo "Compiling app: Pocket Paint"

(cd Applications/Paintroid && ./gradlew assembleDebug assembleDebugTest)

