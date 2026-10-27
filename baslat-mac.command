#!/bin/bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 24 veya üzerini kurun ve tekrar deneyin."
  read -r -p "Kapatmak için Enter…"
  exit 1
fi
node -e 'if(Number(process.versions.node.split(".")[0])<24){console.error("Node.js 24 veya üzeri gereklidir.");process.exit(1)}'
if [ ! -d node_modules ]; then npm ci; fi
npm run setup
npm run build
echo "Tarayıcıda http://127.0.0.1:3100 adresini açın. Durdurmak için Ctrl+C."
npm start
