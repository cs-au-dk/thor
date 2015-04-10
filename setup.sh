#!/bin/bash

read -p "Install dependencies (y/n)?" answer
case ${answer:0:1} in
  y|Y )
    sudo apt-get update
    sudo apt-get -y install openjdk-7-jdk
    sudo apt-get -y install bison
    sudo apt-get -y install g++-multilib
    sudo apt-get -y install gperf
    sudo apt-get -y install libxml2-utils
    sudo apt-get -y install make
    sudo apt-get -y install zlib1g-dev:i386
    sudo apt-get -y install git zip sudo apt-get install gradle sudo apt-get install curl redis-server dpkg-dev nodejs-legacy npm ack-grep
  ;;
  n|N )
    break
  ;;
esac

echo "Downloading latest Android SDK"

if [ -f "/home/$USER/Downloads/android-sdk_r24.1.2-linux.tgz" ]; then
  echo "- already there..."
else
  curl http://dl.google.com/android/android-sdk_r24.1.2-linux.tgz -o /home/$USER/Downloads/android-sdk_r24.1.2-linux.tgz
fi

echo "Unpacking latest Android SDK"

if [ -d "/home/$USER/android-sdk-linux" ]; then
  echo "- already there..."
else
  mkdir -p /home/$USER/android-sdk-linux
  tar zxvf /home/$USER/Downloads/android-sdk_r24.1.2-linux.tgz -C /home/$USER/
fi

read -p "Install Android SDK dependencies (build tools, SDKs, ...) (y/n)?" answer

function install {
  MATCHING=$(/home/$USER/android-sdk-linux/tools/android list sdk -u --all | grep -m 1 "$1")
  echo "Found $MATCHING"
  if [[ $MATCHING =~ (([0-9]*)-.*)$ ]]; then 
    echo "- sdk item number is ${BASH_REMATCH[2]}"
  fi
  /home/$USER/android-sdk-linux/tools/android update sdk -u -a -t ${BASH_REMATCH[2]}
}

case ${answer:0:1} in
  y|Y )
    install "Android.*4.1.2"
    install "Android.*4.4.2"
    install "Android.*5.0.1"
    install "Android SDK Build-tools.*19.1[^\.]*"
    install "Android SDK Build-tools.*21.1.2"
    install "Android Support Repository"
    install "Android Support Library"
    install "Google Repository"
  ;;
  n|N )
    break
  ;;
esac

echo "Creating SD card"

mkdir -p /home/$USER/android_images

if [ -f "/home/$USER/android_images/mysd1.img" ]; then
  echo "- already there..."
else
  /home/$USER/android-sdk-linux/tools/mksdcard -l mysd1 1024M /home/$USER/android_images/mysd1.img
fi

echo "Cloning Thor"

sudo mkdir -p /Volumes/Android4.4.3
sudo chown -R $USER /Volumes

if [ -d "/Volumes/Android4.4.3/thor" ]; then
  echo "- already there, resetting..."
  (cd /Volumes/Android4.4.3/thor && git reset --hard)
else
  git clone https://github.com/cs-au-dk/thor.git /Volumes/Android4.4.3/thor
fi

echo "Getting test server dependencies"

(cd /Volumes/Android4.4.3/BacklogRunner && npm install)

echo "Initializing Thor"

(cd /Volumes/Android4.4.3/thor/Android && sudo ./init.sh)

if [ ! -f "/Volumes/Android4.4.3/thor/Robotium2Espresso/local.properties" ]; then
  echo "sdk.dir=/home/$USER/android-sdk-linux" >> /Volumes/Android4.4.3/thor/Robotium2Espresso/local.properties
fi

echo "Initializing applications"

if [ ! -f "/Volumes/Android4.4.3/thor/Applications/AnyMemo/local.properties" ]; then
  echo "sdk.dir=/home/$USER/android-sdk-linux" >> /Volumes/Android4.4.3/thor/Applications/AnyMemo/local.properties
fi

if [ ! -f "/Volumes/Android4.4.3/thor/Applications/Car-Cast/local.properties" ]; then
  echo "sdk.dir=/home/$USER/android-sdk-linux" >> /Volumes/Android4.4.3/thor/Applications/Car-Cast/local.properties
fi

if [ ! -f "/Volumes/Android4.4.3/thor/Applications/com.numix.calculator/local.properties" ]; then
  echo "sdk.dir=/home/$USER/android-sdk-linux" >> /Volumes/Android4.4.3/thor/Applications/com.numix.calculator/local.properties
fi

if [ ! -f "/Volumes/Android4.4.3/thor/Applications/Catroid-latest/local.properties" ]; then
  echo "sdk.dir=/home/$USER/android-sdk-linux" >> /Volumes/Android4.4.3/thor/Applications/Catroid-latest/local.properties
fi

if [ ! -f "/Volumes/Android4.4.3/thor/Applications/Paintroid/local.properties" ]; then
  echo "sdk.dir=/home/$USER/android-sdk-linux" >> /Volumes/Android4.4.3/thor/Applications/Paintroid/local.properties
fi

echo "Downloading the instrumented Android images"

if [ -f "/home/$USER/Downloads/android-images.zip" ]; then
  echo "- already there..."
else
  curl http://brics.dk/thor/files/android-images.zip -o /home/$USER/Downloads/android-images.zip
fi

if [ -d "/Volumes/Android4.4.3/thor/Android/out/target/product/generic_x86" ]; then
  rm -rf /Volumes/Android4.4.3/thor/Android/out/target/product/generic_x86/*
else
  mkdir -p /Volumes/Android4.4.3/thor/Android/out/target/product/generic_x86
fi

unzip /home/$USER/Downloads/android-images.zip -d /Volumes/Android4.4.3/thor/Android/out/target/product/generic_x86

echo "Setting ANDROID_HOME"

echo "ANDROID_HOME=/Volumes/Android4.4.3/thor/Android" >> /home/$USER/.bashrc
. /home/$USER/.bashrc

