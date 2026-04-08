#!/usr/bin/env bash
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
echo ""
echo "══════════════════════════════════════"
echo "  CODE COMBAT v2 — VPS Deploy Script"
echo "══════════════════════════════════════"
echo ""
if ! command -v docker &>/dev/null; then
  echo "➜ Installing Docker…"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
else
  echo "✓ Docker: $(docker --version)"
fi
cd "$APP_DIR"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠  Created .env from .env.example — edit CORS_ORIGIN before production use."
fi
mkdir -p logs
echo "➜ Building image…"
docker compose build --no-cache
echo "➜ Starting containers…"
docker compose up -d --remove-orphans
sleep 5
PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 || echo "3000")
if curl -sf "http://localhost:${PORT}/health" > /dev/null; then
  echo "✅ Running at http://$(hostname -I | awk '{print $1}'):${PORT}"
  echo "   Host:     http://$(hostname -I | awk '{print $1}'):${PORT}/coding-combat-host.html"
  echo "   Player 1: http://$(hostname -I | awk '{print $1}'):${PORT}/coding-combat-player.html?slot=1"
  echo "   Player 2: http://$(hostname -I | awk '{print $1}'):${PORT}/coding-combat-player2.html"
else
  echo "❌ Health check failed."
  docker compose logs --tail=30
  exit 1
fi
