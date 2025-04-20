#!/usr/bin/env bash

# this script only compiles the installer binary, but does NOT create the ISO.
# useful for testing without rebuilding the whole squashfs each time.
# DON'T RUN THE INSTALLER ON YOUR LOCAL MACHINE!

node build.js # bundle all code into single js
terser dist/bundle.js > dist/minifiedBundle.js
if [ ! -f node-v23.11.0-linux-x64.tar.xz ]; then
	wget https://nodejs.org/dist/v23.11.0/node-v23.11.0-linux-x64.tar.xz
fi
if [ ! -d "node-v23.11.0-linux-x64" ]; then
	tar -xf node-v23.11.0-linux-x64.tar.xz
fi
cp node-v23.11.0-linux-x64/bin/node installPluto 
node --experimental-sea-config sea-config.json
npx postject installPluto NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2