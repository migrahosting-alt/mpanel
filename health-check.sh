#!/bin/bash

# ============================================
# mPanel Production Health Check
# ============================================
# Quickly verify all services are running correctly
# Run: bash health-check.sh
# ============================================

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🏥 mPanel Production Health Check"
echo "=================================="
echo ""

# Check Docker containers
echo "📦 Docker Containers:"
if docker compose ps | grep -q "Up"; then
    echo -e "${GREEN}✓${NC} PostgreSQL: $(docker ps --filter name=mpanel-postgres --format '{{.Status}}')"
    echo -e "${GREEN}✓${NC} Redis: $(docker ps --filter name=mpanel-redis --format '{{.Status}}')"
    echo -e "${GREEN}✓${NC} MinIO: $(docker ps --filter name=mpanel-minio --format '{{.Status}}')"
    echo -e "${GREEN}✓${NC} Prometheus: $(docker ps --filter name=mpanel-prometheus --format '{{.Status}}')"
    echo -e "${GREEN}✓${NC} Grafana: $(docker ps --filter name=mpanel-grafana --format '{{.Status}}')"
else
    echo -e "${RED}✗${NC} Docker containers not running"
fi
echo ""

# Check PM2 process
echo "⚙️  Backend Process:"
if pm2 list | grep -q "mpanel-backend"; then
    STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="mpanel-backend") | .pm2_env.status')
    if [ "$STATUS" == "online" ]; then
        echo -e "${GREEN}✓${NC} Backend: Online"
    else
        echo -e "${RED}✗${NC} Backend: $STATUS"
    fi
else
    echo -e "${RED}✗${NC} Backend not running"
fi
echo ""

# Check Nginx
echo "🌐 Web Server:"
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓${NC} Nginx: Active"
else
    echo -e "${RED}✗${NC} Nginx: Inactive"
fi
echo ""

# Check API Health
echo "🔍 API Health:"
if command -v curl &> /dev/null; then
    HEALTH_RESPONSE=$(curl -s http://localhost:3000/api/health 2>/dev/null)
    if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
        echo -e "${GREEN}✓${NC} API: Healthy"
        echo "   Response: $HEALTH_RESPONSE"
    else
        echo -e "${RED}✗${NC} API: Not responding correctly"
    fi
else
    echo -e "${YELLOW}⚠${NC} curl not installed, skipping API check"
fi
echo ""

# Check Disk Space
echo "💾 Disk Space:"
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✓${NC} Disk usage: ${DISK_USAGE}% (healthy)"
elif [ "$DISK_USAGE" -lt 90 ]; then
    echo -e "${YELLOW}⚠${NC} Disk usage: ${DISK_USAGE}% (warning)"
else
    echo -e "${RED}✗${NC} Disk usage: ${DISK_USAGE}% (critical)"
fi
echo ""

# Check Memory
echo "🧠 Memory:"
FREE_MEM=$(free -m | awk 'NR==2 {print $7}')
TOTAL_MEM=$(free -m | awk 'NR==2 {print $2}')
MEM_USAGE=$((100 - (FREE_MEM * 100 / TOTAL_MEM)))
if [ "$MEM_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✓${NC} Memory usage: ${MEM_USAGE}% (healthy)"
elif [ "$MEM_USAGE" -lt 90 ]; then
    echo -e "${YELLOW}⚠${NC} Memory usage: ${MEM_USAGE}% (warning)"
else
    echo -e "${RED}✗${NC} Memory usage: ${MEM_USAGE}% (critical)"
fi
echo ""

# Check SSL Certificates
echo "🔒 SSL Certificates:"
if command -v certbot &> /dev/null; then
    CERT_INFO=$(certbot certificates 2>/dev/null | grep -A 2 "Certificate Name" | head -3)
    if [ -n "$CERT_INFO" ]; then
        echo -e "${GREEN}✓${NC} SSL certificates installed"
        EXPIRY=$(echo "$CERT_INFO" | grep "Expiry Date" | awk '{print $3, $4, $5}')
        echo "   Expiry: $EXPIRY"
    else
        echo -e "${YELLOW}⚠${NC} No SSL certificates found"
    fi
else
    echo -e "${YELLOW}⚠${NC} Certbot not installed"
fi
echo ""

# Database connection test
echo "🗄️  Database:"
DB_TEST=$(docker exec mpanel-postgres psql -U mpanel -d mpanel_production -c "SELECT 1;" 2>&1)
if echo "$DB_TEST" | grep -q "1 row"; then
    echo -e "${GREEN}✓${NC} PostgreSQL: Connected"
else
    echo -e "${RED}✗${NC} PostgreSQL: Connection failed"
fi
echo ""

# Redis connection test
echo "📮 Cache:"
REDIS_TEST=$(docker exec mpanel-redis redis-cli ping 2>&1)
if echo "$REDIS_TEST" | grep -q "PONG"; then
    echo -e "${GREEN}✓${NC} Redis: Connected"
else
    echo -e "${RED}✗${NC} Redis: Connection failed"
fi
echo ""

# Recent errors in backend logs
echo "📋 Recent Errors (last 50 lines):"
ERROR_COUNT=$(pm2 logs mpanel-backend --lines 50 --nostream 2>/dev/null | grep -i "error" | wc -l)
if [ "$ERROR_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓${NC} No errors in recent logs"
else
    echo -e "${YELLOW}⚠${NC} Found $ERROR_COUNT error(s) in recent logs"
    echo "   Run: pm2 logs mpanel-backend --lines 50 | grep -i error"
fi
echo ""

# Summary
echo "=================================="
echo "📊 Health Check Summary"
echo "=================================="
TOTAL_CHECKS=9
PASSED=0

# Count passed checks
docker compose ps | grep -q "Up" && ((PASSED++))
pm2 list | grep -q "mpanel-backend.*online" && ((PASSED++))
systemctl is-active --quiet nginx && ((PASSED++))
curl -s http://localhost:3000/api/health 2>/dev/null | grep -q "healthy" && ((PASSED++))
[ "$DISK_USAGE" -lt 80 ] && ((PASSED++))
[ "$MEM_USAGE" -lt 80 ] && ((PASSED++))
certbot certificates 2>/dev/null | grep -q "Certificate Name" && ((PASSED++))
echo "$DB_TEST" | grep -q "1 row" && ((PASSED++))
echo "$REDIS_TEST" | grep -q "PONG" && ((PASSED++))

if [ "$PASSED" -eq "$TOTAL_CHECKS" ]; then
    echo -e "${GREEN}✓ All checks passed ($PASSED/$TOTAL_CHECKS)${NC}"
    echo "🎉 mPanel is healthy and running smoothly!"
elif [ "$PASSED" -ge 7 ]; then
    echo -e "${YELLOW}⚠ Most checks passed ($PASSED/$TOTAL_CHECKS)${NC}"
    echo "⚠️  Some issues detected, review output above"
else
    echo -e "${RED}✗ Multiple checks failed ($PASSED/$TOTAL_CHECKS)${NC}"
    echo "❌ Critical issues detected, immediate attention required"
fi
echo ""
