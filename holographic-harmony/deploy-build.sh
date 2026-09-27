#!/usr/bin/env bash
set -euo pipefail
npm run build
printf '%s\n' "${VERCEL_GIT_COMMIT_SHA:-unknown}" > dist/DEPLOYED_GIT_SHA.txt
rm -rf site
cp -R dist site
