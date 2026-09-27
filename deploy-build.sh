#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/holographic-harmony"
npm run build
cd ..
rm -rf dist
cp -R holographic-harmony/dist dist
printf '%s\n' "${VERCEL_GIT_COMMIT_SHA:-unknown}" > dist/DEPLOYED_GIT_SHA.txt
