#!/bin/bash
# mpanel-core-check.sh - Quick health check for mpanel-core server
# Deploy to: /usr/local/sbin/mpanel-core-check.sh
# Usage: sudo mpanel-core-check.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "═══════════════════════════════════════════════════"
echo "       mPanel-Core Health Check"
echo "═══════════════════════════════════════════════════"
echo ""

FAIL=0

# 1. Check sshd
echo -n "🔐 SSHD service:        "
if systemctl is-active --quiet sshd 2>/dev/null || systemctl is-active --quiet ssh 2>/dev/null; then
    echo -e "${GREEN}RUNNING${NC}"
else
    echo -e "${RED}DOWN${NC}"
    FAIL=1
fi

# 2. Check PM2 status for tenant-billing
echo -n "📦 PM2 tenant-billing:  "
if sudo -u mhadmin pm2 describe tenant-billing &>/dev/null; then
    STATUS=$(sudo -u mhadmin pm2 jlist 2>/dev/null | grep -o '"name":"tenant-billing"[^}]*"status":"[^"]*"' | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    if [ "$STATUS" = "online" ]; then
        echo -e "${GREEN}ONLINE${NC}"
    else
        echo -e "${RED}$STATUS${NC}"
        FAIL=1
    fi
else
    echo -e "${RED}NOT FOUND${NC}"
    FAIL=1
fi

# 3. Check PM2 status for mpanel-frontend (optional)
echo -n "🖥️  PM2 mpanel-frontend: "
if sudo -u mhadmin pm2 describe mpanel-frontend &>/dev/null; then
    STATUS=$(sudo -u mhadmin pm2 jlist 2>/dev/null | grep -o '"name":"mpanel-frontend"[^}]*"status":"[^"]*"' | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    if [ "$STATUS" = "online" ]; then
        echo -e "${GREEN}ONLINE${NC}"
    else
        echo -e "${YELLOW}$STATUS${NC}"
    fi
else
    echo -e "${YELLOW}NOT CONFIGURED${NC}"
fi

# 4. Check port 2271 is listening
echo -n "🔌 Port 2271 listening: "
if ss -tlnp 2>/dev/null | grep -q ':2271 '; then
    echo -e "${GREEN}YES${NC}"
else
    echo -e "${RED}NO${NC}"
    FAIL=1
fi

# 5. Check /api/health endpoint
echo -n "💓 API /health:         "
HEALTH=$(curl -s --max-time 5 http://127.0.0.1:2271/api/health 2>/dev/null)
if [ -n "$HEALTH" ]; then
    # Try to extract status from JSON
    if echo "$HEALTH" | grep -qiE '"status"\s*:\s*"(ok|healthy|up)"'; then
        echo -e "${GREEN}OK${NC}"
    elif echo "$HEALTH" | grep -qi 'ok\|healthy\|up'; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${YELLOW}RESPONDED (check manually)${NC}"
        echo "    Response: $(echo "$HEALTH" | head -c 100)"
    fi
else
    echo -e "${RED}NO RESPONSE${NC}"
    FAIL=1
fi

# 6. Check Redis connectivity (bonus)
echo -n "🔴 Redis (6380):        "
if ss -tlnp 2>/dev/null | grep -q ':6380 '; then
    echo -e "${GREEN}LISTENING${NC}"
elif nc -z 127.0.0.1 6380 2>/dev/null; then
    echo -e "${GREEN}REACHABLE${NC}"
else
    echo -e "${YELLOW}NOT LOCAL (may be remote)${NC}"
fi

# 7. Check PostgreSQL connectivity (bonus)
echo -n "🐘 PostgreSQL (5432):   "
if ss -tlnp 2>/dev/null | grep -q ':5432 '; then
    echo -e "${GREEN}LISTENING${NC}"
elif nc -z 127.0.0.1 5432 2>/dev/null; then
    echo -e "${GREEN}REACHABLE${NC}"
else
    echo -e "${YELLOW}NOT LOCAL (may be remote)${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════════"
if [ $FAIL -eq 0 ]; then
    echo -e "        ${GREEN}✅ mPanel-Core is HEALTHY${NC}"
else
    echo -e "        ${RED}❌ mPanel-Core has ISSUES${NC}"
fi
echo "═══════════════════════════════════════════════════"

exit $FAIL
