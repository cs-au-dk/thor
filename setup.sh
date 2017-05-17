#!/bin/bash

COMPRESSION="tgz"
HOMEFOLDER="/home/$USER"
OS_NAME="linux"

case "$(uname -s)" in
Linux)
  ;;

Darwin)
  COMPRESSION="zip"
  HOMEFOLDER="/Users/$USER"
  OS_NAME="macosx"
  ;;

*)
  echo "Unsupported OS"
  exit 1
  ;;
esac


read -p "Install dependencies (y/n)?" answer
case ${answer:0:1} in
  y|Y )
    case "$(uname -s)" in

    Linux)
      sudo apt-get update
      sudo apt-get -y install openjdk-7-jdk
      sudo apt-get -y install bison
      sudo apt-get -y install g++-multilib
      sudo apt-get -y install gperf
      sudo apt-get -y install libxml2-utils
      sudo apt-get -y install make
      sudo apt-get -y install zlib1g-dev:i386
      sudo apt-get -y install git zip gradle curl redis-server dpkg-dev nodejs-legacy npm ack-grep
      sudo apt-get install libgl1-mesa-dev
      ;;

    Darwin)
      brew install git redis # ... incomplete ...
      ;;

    esac
  ;;
  n|N )
  ;;
esac

# -----------------------------------
# -----------------------------------
# -----------------------------------

echo "Downloading latest Android SDK"

if [ -f "$HOMEFOLDER/Downloads/android-sdk_r24.1.2-$OS_NAME.$COMPRESSION" ]; then
  echo "- already there..."
else
  curl "http://dl.google.com/android/android-sdk_r24.1.2-$OS_NAME.$COMPRESSION" -o "$HOMEFOLDER/Downloads/android-sdk_r24.1.2-$OS_NAME.$COMPRESSION"
fi

# ---------------------------------
# ---------------------------------
# ---------------------------------

echo "Unpacking latest Android SDK"

case "$(uname -s)" in

Linux)
  if [ -d "$HOMEFOLDER/android-sdk-$OS_NAME" ]; then
    echo "- already there..."
  else
    mkdir -p $HOMEFOLDER/android-sdk-$OS_NAME
    tar zxvf "$HOMEFOLDER/Downloads/android-sdk_r24.1.2-$OS_NAME.$COMPRESSION" -C $HOMEFOLDER/
  fi
  ;;

Darwin)
  if [ -d "$HOMEFOLDER/android-sdk-$OS_NAME" ]; then
    echo "- already there..."
  else
    mkdir -p $HOMEFOLDER/android-sdk-$OS_NAME
    unzip "$HOMEFOLDER/Downloads/android-sdk_r24.1.2-$OS_NAME.$COMPRESSION" -d $HOMEFOLDER/
  fi
  ;;

esac

# -------------------------------------------------------------------------------
# -------------------------------------------------------------------------------
# -------------------------------------------------------------------------------

read -p "Install Android SDK dependencies (build tools, SDKs, ...) (y/n)?" answer

function install {
  MATCHING=$($HOMEFOLDER/android-sdk-$OS_NAME/tools/android list sdk -u --all | grep -m 1 "$1")
  echo "Found $MATCHING"
  if [[ $MATCHING =~ (([0-9]*)-.*)$ ]]; then 
    echo "- sdk item number is ${BASH_REMATCH[2]}"
  fi
  $HOMEFOLDER/android-sdk-$OS_NAME/tools/android update sdk -u -a -t ${BASH_REMATCH[2]}
}

case ${answer:0:1} in
  y|Y )
    install "Android.* 4.1.2"
    install "Android.* 4.4.2"
    install "Android.* 5.0.1"
    install "Android SDK Build-tools.* 19.1[^\.]*"
    install "Android SDK Build-tools.* 21.1.2"
    install "Android SDK Platform-tools.* 23.0.1"
    install "Android Support Repository"
    install "Android Support Library"
    install "Google Repository"
  ;;
  n|N )
  ;;
esac

# ---------------------
# ---------------------
# ---------------------

echo "Creating SD card"

mkdir -p $HOMEFOLDER/android_images

if [ -f "$HOMEFOLDER/android_images/mysd1.img" ]; then
  echo "- already there..."
else
  $HOMEFOLDER/android-sdk-$OS_NAME/tools/mksdcard -l mysd1 1024M $HOMEFOLDER/android_images/mysd1.img
fi

# -----------------
# -----------------
# -----------------

echo "Cloning Thor"

sudo mkdir -p /Volumes/Android4.4.3
sudo chown -R $USER /Volumes

if [ -d "/Volumes/Android4.4.3/thor" ]; then
  if (cd /Volumes/Android4.4.3/thor && ls .git); then
    echo "- already there, resetting..."
    (cd /Volumes/Android4.4.3/thor && git fetch --all && git reset --hard origin/master)
  else
    rm -rf /Volumes/Android4.4.3/thor
    git clone https://github.com/cs-au-dk/thor.git /Volumes/Android4.4.3/thor
  fi
else
  case "$(uname -s)" in

  Linux)
    git clone https://github.com/cs-au-dk/thor.git /Volumes/Android4.4.3/thor
    ;;

  Darwin)
    # Work around permissions in /Volumes
    sudo mkdir -p /Volumes/Android4.4.3
    sudo chmod +a "$USER:allow:add_subdirectory,add_file,directory_inherit" /Volumes/Android4.4.3/
    cd /Volumes/Android4.4.3
    mkdir thor
    cd thor
    git init && git remote add origin https://github.com/cs-au-dk/thor.git && git fetch origin && git reset --hard origin/master
    ;;

  esac
fi

echo "Getting test server dependencies"

(cd /Volumes/Android4.4.3/thor/BacklogRunner && sudo npm install)

echo "Initializing Thor"

(cd /Volumes/Android4.4.3/thor/Android && sudo ./init.sh)

if [ ! -f "/Volumes/Android4.4.3/thor/Robotium2Espresso/local.properties" ]; then
  echo "sdk.dir=$HOMEFOLDER/android-sdk-$OS_NAME" >> /Volumes/Android4.4.3/thor/Robotium2Espresso/local.properties
fi

echo "Initializing applications"

if [ ! -f "/Volumes/Android4.4.3/thor/Applications/AnyMemo/local.properties" ]; then
  echo "sdk.dir=$HOMEFOLDER/android-sdk-$OS_NAME" >> /Volumes/Android4.4.3/thor/Applications/AnyMemo/local.properties
fi

if [ ! -f "/Volumes/Android4.4.3/thor/Applications/Car-Cast/local.properties" ]; then
  echo "sdk.dir=$HOMEFOLDER/android-sdk-$OS_NAME" >> /Volumes/Android4.4.3/thor/Applications/Car-Cast/local.properties
fi

if [ ! -f "/Volumes/Android4.4.3/thor/Applications/com.numix.calculator/local.properties" ]; then
  echo "sdk.dir=$HOMEFOLDER/android-sdk-$OS_NAME" >> /Volumes/Android4.4.3/thor/Applications/com.numix.calculator/local.properties
fi

if [ ! -f "/Volumes/Android4.4.3/thor/Applications/Catroid-latest/local.properties" ]; then
  echo "sdk.dir=$HOMEFOLDER/android-sdk-$OS_NAME" >> /Volumes/Android4.4.3/thor/Applications/Catroid-latest/local.properties
fi

if [ ! -f "/Volumes/Android4.4.3/thor/Applications/Paintroid/local.properties" ]; then
  echo "sdk.dir=$HOMEFOLDER/android-sdk-$OS_NAME" >> /Volumes/Android4.4.3/thor/Applications/Paintroid/local.properties
fi

echo "Downloading the instrumented Android images"

if [ -f "$HOMEFOLDER/Downloads/android-images.zip" ]; then
  echo "- already there..."
else
  curl http://brics.dk/thor/files/android-images.zip -o $HOMEFOLDER/Downloads/android-images.zip
fi

if [ -d "/Volumes/Android4.4.3/thor/Android/out/target/product/generic_x86" ]; then
  rm -rf /Volumes/Android4.4.3/thor/Android/out/target/product/generic_x86/*
else
  mkdir -p /Volumes/Android4.4.3/thor/Android/out/target/product/generic_x86
fi

unzip $HOMEFOLDER/Downloads/android-images.zip -d "/Volumes/Android4.4.3/thor/Android/out/target/product/generic_x86/"

echo "Setting ANDROID_HOME"

case "$(uname -s)" in
Linux)
  echo "export ANDROID_HOME=/Volumes/Android4.4.3/thor/Android" >> $HOMEFOLDER/.bashrc
  . $HOMEFOLDER/.bashrc
  ;;

Darwin)
  ANDROID_LOCATION="/Volumes/Android4.4.3/thor/Android"
  echo "export ANDROID_HOME=$ANDROID_LOCATION" >> $HOMEFOLDER/.bashrc
  echo "export PATH=\$PATH:$ANDROID_LOCATION/platform-tools:$ANDROID_LOCATION/tools:$ANDROID_LOCATION/build-tools/android-4.4.2" >> $HOMEFOLDER/.bashrc
  . $HOMEFOLDER/.bashrc
  ;;
esac