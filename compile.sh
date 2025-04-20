#!/usr/bin/env bash

# This script compiles the installer script to a binary and builds the ISO file into ./artifacts

cd ./PlutoInstallerScript
npm i
node build.js
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
mkdir -p ../isoconfig/airootfs/usr/bin
mv installPluto ../isoconfig/airootfs/usr/bin
rm sea-prep.blob

cd ..

# ISO assembly

sudo mkarchiso -v -w ./work_dir -o ./artifacts ./isoconfig
sudo rm -r ./work_dir
