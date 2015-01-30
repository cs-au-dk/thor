#!/bin/bash

case "$(uname -s)" in

   Darwin)
     echo 'Mac OS X'
     redis-server /usr/local/etc/redis.conf;;

   Linux)
     echo 'Linux, always run with sudo'
     redis-server /etc/redis/redis.conf;;

   CYGWIN*|MINGW32*|MSYS*)
     echo 'MS Windows'
     ;;

   *)
     echo 'other OS (or missing cases for above OSs)' 
     ;;
esac




