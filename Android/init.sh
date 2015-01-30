case "$(uname -s)" in

  Darwin)

    # Create platform-tools folder in Android, containing adb (needed by spoon)
    ln -s /Volumes/Android4.4.3/androidtestingproject/Android/out/host/darwin-x86/bin platform-tools;;

  Linux)

    # Create platform-tools folder in Android, containing adb (needed by spoon)
    ln -s /Volumes/Android4.4.3/androidtestingproject/Android/out/host/linux-x86/bin platform-tools

    # Make ack command available
    ln -s /usr/bin/ack-grep /usr/bin/ack;;

  CYGWIN*|MINGW32*|MSYS*)
    echo "MS Windows"
    ;;

  *)
    echo "other OS (or missing cases for above OSs)" 
    ;;

esac