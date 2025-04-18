#!/usr/bin/env bash

node build.js # bundle all code into single js
terser dist/bundle.js > dist/minifiedBundle.js
cp node installPluto
node --experimental-sea-config sea-config.json
npx postject installPluto NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2