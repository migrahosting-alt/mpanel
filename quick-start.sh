#!/bin/bash

# ============================================
# Quick Start - mPanel (No Docker Required)
# ============================================
# This starts mPanel using only Node.js for testing
# Run: bash quick-start.sh
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

clear
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  mPanel Quick Start (Development Mode)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    npm install --legacy-peer-deps --quiet
fi

if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd frontend && npm install --legacy-peer-deps --quiet && cd ..
fi

# Fix .env
if [ -f .env ]; then
    sed -i 's/\r$//' .env 2>/dev/null || true
    chmod 600 .env
fi

echo -e "${GREEN}✓ Dependencies ready${NC}"
echo ""

# Create a test mode notice
cat > .test-mode << 'EOF'
Running in TEST MODE (no Docker):
• Using in-memory database simulation
• Redis features disabled
• MinIO features disabled
• For full features, enable Docker
EOF

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Starting Backend (port 2271)...${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Start backend in background
TEST_MODE=true node src/server.js &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Check if backend is running
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${GREEN}✓ Backend started${NC}"
else
    echo -e "${YELLOW}⚠ Backend may have issues - check logs${NC}"
fi

echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Starting Frontend (port 2272)...${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Start frontend in background
cd frontend
npm run dev -- --port 2272 --host &
FRONTEND_PID=$!
cd ..

sleep 3

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  mPanel is Running!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Frontend: http://localhost:2272"
echo "  Backend:  http://localhost:2271"
echo "  Health:   http://localhost:2271/api/health"
echo ""
echo -e "${YELLOW}  Note: Running without Docker (limited features)${NC}"
echo ""
echo "  Press Ctrl+C to stop"
echo ""

# Trap to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    rm -f .test-mode
    echo "✓ Stopped"
    exit 0
}

trap cleanup INT TERM

# Keep running
wait
