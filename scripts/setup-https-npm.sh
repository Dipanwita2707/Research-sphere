#!/bin/bash
set -e

echo "=== Creating shared Docker network ==="
sudo docker network create researchsphere-net 2>/dev/null || true

echo "=== Updating ResearchSphere app (frontend moves off port 80) ==="
cd /home/ubuntu/Sgt-Ums
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --force-recreate

echo "=== Starting Nginx Proxy Manager ==="
mkdir -p /home/ubuntu/nginx-proxy
cp /home/ubuntu/Sgt-Ums/scripts/nginx-proxy/docker-compose.yml /home/ubuntu/nginx-proxy/docker-compose.yml 2>/dev/null || true
cd /home/ubuntu/nginx-proxy
if [ ! -f docker-compose.yml ]; then
  echo "ERROR: docker-compose.yml not found in ~/nginx-proxy"
  exit 1
fi
sudo docker compose up -d

echo ""
echo "=== Done ==="
sudo docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
echo ""
echo "Next steps:"
echo "  1. Point researchsphere.duckdns.org -> 3.7.214.150 in DuckDNS"
echo "  2. AWS Security Group: open ports 80, 443, 81 (81 = My IP only)"
echo "  3. Open http://3.7.214.150:81"
echo "     Login: admin@example.com / changeme"
echo "  4. Add Proxy Host:"
echo "     Domain: researchsphere.duckdns.org"
echo "     Forward: researchsphere-frontend:3000 (scheme http)"
echo "  5. SSL tab: Request Let's Encrypt cert, Force SSL"
