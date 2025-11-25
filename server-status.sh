#!/bin/bash
# mPanel Server Status Monitor

echo "🔍 mPanel Server Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check backend
if lsof -i :2271 | grep -q LISTEN; then
  echo "✅ Backend (2271): RUNNING"
  UPTIME=$(curl -s http://localhost:2271/api/health | jq -r '.uptimeHuman // "unknown"')
  echo "   Uptime: $UPTIME"
else
  echo "❌ Backend (2271): DOWN"
  echo "   Start: npm run dev"
fi

echo ""

# Check frontend
if lsof -i :2272 | grep -q LISTEN; then
  echo "✅ Frontend (2272): RUNNING"
  echo "   URL: http://localhost:2272"
else
  echo "❌ Frontend (2272): DOWN"
  echo "   Start: cd frontend && npm run dev"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test login if both running
if lsof -i :2271 | grep -q LISTEN && lsof -i :2272 | grep -q LISTEN; then
  TOKEN=$(curl -s -X POST http://localhost:2271/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@migrahosting.com","password":"admin123"}' | jq -r '.token')
  
  if [ "$TOKEN" != "null" ] && [ ! -z "$TOKEN" ]; then
    echo "✅ Authentication: WORKING"
  else
    echo "❌ Authentication: FAILED"
  fi
fi

echo ""
