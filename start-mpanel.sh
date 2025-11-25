#!/bin/bash

# mPanel Quick Start Script
# Starts all services in the correct order

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Starting mPanel System"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Start Docker Services
echo "🐳 Starting Docker services..."
sudo docker compose up -d postgres redis minio

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check health
POSTGRES_STATUS=$(sudo docker inspect --format='{{.State.Health.Status}}' mpanel-postgres 2>/dev/null || echo "not running")
REDIS_STATUS=$(sudo docker inspect --format='{{.State.Health.Status}}' mpanel-redis 2>/dev/null || echo "not running")
MINIO_STATUS=$(sudo docker inspect --format='{{.State.Health.Status}}' mpanel-minio 2>/dev/null || echo "not running")

if [ "$POSTGRES_STATUS" != "healthy" ] || [ "$REDIS_STATUS" != "healthy" ] || [ "$MINIO_STATUS" != "healthy" ]; then
    echo "⚠️  Warning: Some services are not healthy yet. Continuing anyway..."
fi

echo "✓ Docker services started"
echo ""

# Step 2: Start Backend
echo "🚀 Starting Backend (port 2271)..."
cd "$(dirname "$0")"

# Stop any existing backend
pkill -f "node src/server.js" 2>/dev/null || true

# Start backend in background
TEST_MODE=true PORT=2271 node src/server.js > /tmp/mpanel-backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Check if backend is running
if curl -s -f http://localhost:2271/api/health > /dev/null 2>&1; then
    echo "✓ Backend started successfully (PID: $BACKEND_PID)"
else
    echo "❌ Backend failed to start. Check /tmp/mpanel-backend.log"
    exit 1
fi

echo ""

# Step 3: Start Frontend
echo "🎨 Starting Frontend (port 2272)..."

# Stop any existing frontend
pkill -f "vite.*2272" 2>/dev/null || true

# Start frontend in background
cd frontend
npm run dev -- --port 2272 --host > /tmp/mpanel-frontend.log 2>&1 &
FRONTEND_PID=$!

sleep 3

echo "✓ Frontend started (PID: $FRONTEND_PID)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  mPanel is Running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  📍 Access URLs:"
echo "     Backend:  http://localhost:2271"
echo "     Frontend: http://localhost:2272"
echo "     Health:   http://localhost:2271/api/health"
echo "     GraphQL:  http://localhost:2271/graphql"
echo ""
echo "  📊 Docker Services:"
sudo docker ps --filter "name=mpanel" --format "     {{.Names}}: {{.Status}}"
echo ""
echo "  📝 Logs:"
echo "     Backend:  tail -f /tmp/mpanel-backend.log"
echo "     Frontend: tail -f /tmp/mpanel-frontend.log"
echo ""
echo "  🛑 Stop Services:"
echo "     pkill -f 'node src/server.js'"
echo "     pkill -f 'vite'"
echo "     sudo docker compose down"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
