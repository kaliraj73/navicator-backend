#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR/backend"
if [ ! -f package.json ]; then
  npm init -y >/dev/null
fi
npm install express ws cors dotenv archiver adm-zip jsonwebtoken >/dev/null
cp -n .env.example .env || true
echo "Install complete. Run ./start.sh"
