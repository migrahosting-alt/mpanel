#!/bin/bash

# mPanel Stop Script
# Gracefully stops all services

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Stopping mPanel System"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Stop Backend
echo "🛑 Stopping Backend..."
pkill -f "node src/server.js" 2>/dev/null && echo "✓ Backend stopped" || echo "⚠️  Backend was not running"

# Stop Frontend  
echo "🛑 Stopping Frontend..."
pkill -f "vite" 2>/dev/null && echo "✓ Frontend stopped" || echo "⚠️  Frontend was not running"

# Stop Docker Services (optional - keep data)
read -p "Stop Docker services? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🐳 Stopping Docker services..."
    cd "$(dirname "$0")"
    sudo docker compose stop postgres redis minio
    echo "✓ Docker services stopped (data preserved)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  mPanel Stopped"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To start again: bash start-mpanel.sh"
echo ""
