#!/bin/bash
set -e
cd /home/ubuntu/Sgt-Ums

echo "=== Running migrations (skip if DB already migrated) ==="
sudo docker run --rm --env-file .env.prod \
  -v /home/ubuntu/Sgt-Ums/backend:/app \
  -w /app node:18-alpine \
  sh -c 'apk add --no-cache openssl libc6-compat >/dev/null && npm ci --ignore-scripts >/dev/null 2>&1 && npx prisma migrate deploy' \
  || echo "Migration skipped or failed — continuing if DB is already set up"

echo "=== Building and starting containers ==="
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo "=== Container status ==="
sudo docker compose -f docker-compose.prod.yml ps

echo "=== Health check ==="
sleep 5
curl -sf http://localhost/api/health && echo ""
