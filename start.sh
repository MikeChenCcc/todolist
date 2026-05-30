#!/bin/bash
unset ELECTRON_RUN_AS_NODE
cd "$(dirname "$0")"
./node_modules/electron/dist/electron.exe .
