#!/bin/bash

# MPanel Setup Script
# This script sets up the entire MPanel development environment

set -e

echo "🚀 MPanel Setup Script"
echo "======================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 20+ first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites are installed${NC}"
echo ""

# Step 1: Environment variables
echo "📝 Step 1: Setting up environment variables"
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}⚠️  Please edit .env file with your configuration${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi
echo ""

# Step 2: Start infrastructure services
echo "🐳 Step 2: Starting infrastructure services with Docker Compose"
echo -e "${YELLOW}Starting PostgreSQL, Redis, MinIO, Prometheus, Grafana, Loki, and Vault...${NC}"
docker-compose up -d
echo -e "${GREEN}✓ Infrastructure services started${NC}"
echo ""

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10
echo -e "${GREEN}✓ Services are ready${NC}"
echo ""

# Step 3: Install backend dependencies
echo "📦 Step 3: Installing backend dependencies"
npm install
echo -e "${GREEN}✓ Backend dependencies installed${NC}"
echo ""

# Step 4: Run database migrations
echo "🗄️  Step 4: Running database migrations"
npm run migrate
echo -e "${GREEN}✓ Database migrations completed${NC}"
echo ""

# Step 5: Install frontend dependencies
echo "📦 Step 5: Installing frontend dependencies"
cd frontend
npm install
cd ..
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
echo ""

# Step 6: Create logs directory
echo "📁 Step 6: Creating logs directory"
mkdir -p logs
echo -e "${GREEN}✓ Logs directory created${NC}"
echo ""

echo ""
echo -e "${GREEN}✅ Setup completed successfully!${NC}"
echo ""
echo "📊 Services are running at:"
echo "  - PostgreSQL:   http://localhost:5432"
echo "  - Redis:        http://localhost:6379"
echo "  - MinIO:        http://localhost:9000 (Console: http://localhost:9001)"
echo "  - Prometheus:   http://localhost:9090"
echo "  - Grafana:      http://localhost:3002 (admin/admin)"
echo "  - Loki:         http://localhost:3100"
echo "  - Vault:        http://localhost:8200"
echo ""
echo "🚀 To start the application:"
echo "  Backend:  npm run dev"
echo "  Frontend: cd frontend && npm run dev"
echo ""
echo "📚 Access points:"
echo "  - API:      http://localhost:3000"
echo "  - Frontend: http://localhost:3001"
echo "  - Health:   http://localhost:3000/api/health"
echo "  - Metrics:  http://localhost:3000/api/metrics"
echo ""
echo -e "${YELLOW}⚠️  Don't forget to configure your .env file!${NC}"
echo ""
