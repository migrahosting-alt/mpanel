#!/bin/bash

################################################################################
# mPanel Quick Deployment to 10.1.10.206 (mpanel-core)
# Usage: bash deploy-to-mpanel-core.sh
################################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SERVER_USER="mhadmin"
SERVER_IP="10.1.10.206"
SERVER_PATH="/srv/web/core/migrapanel.com"
REPO_URL="https://github.com/migrahosting-alt/mpanel.git"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   mPanel Deployment to mpanel-core (10.1.10.206)             ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}\n"

# Test SSH connection
echo -e "${YELLOW}Testing SSH connection...${NC}"
if ! ssh -o ConnectTimeout=5 ${SERVER_USER}@${SERVER_IP} "echo 'Connection successful'" > /dev/null 2>&1; then
    echo -e "${RED}✗ Cannot connect to server. Check SSH access.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ SSH connection successful${NC}\n"

# Deploy
echo -e "${BLUE}Deploying mPanel to ${SERVER_IP}...${NC}\n"

ssh ${SERVER_USER}@${SERVER_IP} bash <<'ENDSSH'
set -e

# Colors for remote execution
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
    echo -e "${YELLOW}Not running as root. Some commands may need sudo.${NC}"
    SUDO="sudo"
else
    SUDO=""
fi

# Install prerequisites if needed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Installing Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -
    $SUDO apt install -y nodejs
fi

if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}Installing Git...${NC}"
    $SUDO apt install -y git
fi

if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Installing PM2...${NC}"
    $SUDO npm install -g pm2
fi

echo -e "${GREEN}✓ Prerequisites checked${NC}\n"

# Create deployment directory
DEPLOY_DIR="/opt/mpanel"
echo -e "${BLUE}Step 2: Setting up deployment directory...${NC}"
$SUDO mkdir -p $DEPLOY_DIR
$SUDO chown -R $USER:$USER $DEPLOY_DIR 2>/dev/null || true

# Clone or update repository
echo -e "${BLUE}Step 3: Getting latest code...${NC}"
if [ -d "$DEPLOY_DIR/.git" ]; then
    echo "Repository exists, pulling latest changes..."
    cd $DEPLOY_DIR
    git pull origin master || git pull origin main
else
    echo "Cloning repository..."
    git clone https://github.com/migrahosting-alt/mpanel.git $DEPLOY_DIR
    cd $DEPLOY_DIR
fi
echo -e "${GREEN}✓ Code updated${NC}\n"

# Install backend dependencies
echo -e "${BLUE}Step 4: Installing backend dependencies...${NC}"
npm install --production
echo -e "${GREEN}✓ Backend dependencies installed${NC}\n"

# Install and build frontend
echo -e "${BLUE}Step 5: Building frontend...${NC}"
cd frontend
npm install
npm run build
cd ..
echo -e "${GREEN}✓ Frontend built${NC}\n"

# Check if .env exists
echo -e "${BLUE}Step 6: Checking environment configuration...${NC}"
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo -e "${YELLOW}Creating .env from .env.example${NC}"
        cp .env.example .env
        echo -e "${RED}⚠️  IMPORTANT: Edit .env file and configure:${NC}"
        echo -e "   - DATABASE_URL"
        echo -e "   - REDIS_URL"
        echo -e "   - JWT_SECRET"
        echo -e "   - STRIPE_SECRET_KEY"
        echo -e "   - SMTP credentials"
    else
        echo -e "${RED}⚠️  No .env file found. You need to create one!${NC}"
    fi
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi
echo ""

# Ask about database migrations
echo -e "${BLUE}Step 7: Database migrations${NC}"
read -p "Run database migrations now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm run migrate || echo -e "${YELLOW}⚠️  Migration failed. Check database connection in .env${NC}"
fi
echo ""

# Start/Restart with PM2
echo -e "${BLUE}Step 8: Starting application with PM2...${NC}"
pm2 delete mpanel-backend 2>/dev/null || true
pm2 start src/server.js --name mpanel-backend -i 2
pm2 save
echo -e "${GREEN}✓ Application started${NC}\n"

# Display status
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Deployment Complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

echo "Application Status:"
pm2 status

echo -e "\n${YELLOW}Next Steps:${NC}"
echo "1. Configure .env file: nano /opt/mpanel/.env"
echo "2. Run migrations: cd /opt/mpanel && npm run migrate"
echo "3. Setup Nginx reverse proxy"
echo "4. Configure SSL certificate"
echo ""
echo "${YELLOW}Useful Commands:${NC}"
echo "  pm2 logs mpanel-backend   # View logs"
echo "  pm2 restart mpanel-backend # Restart app"
echo "  pm2 stop mpanel-backend    # Stop app"
echo ""
echo "${BLUE}Application Details:${NC}"
echo "  Location: /opt/mpanel"
echo "  Backend: http://localhost:2271"
echo "  Logs: pm2 logs mpanel-backend"
echo ""

ENDSSH

echo -e "\n${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Deployment to 10.1.10.206 completed successfully!          ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${BLUE}Access your application:${NC}"
echo -e "  SSH: ssh ${SERVER_USER}@${SERVER_IP}"
echo -e "  Backend: http://10.1.10.206:2271/api/health"
echo -e "  Frontend: Set up Nginx to serve from /opt/mpanel/frontend/dist"
echo ""

echo -e "${YELLOW}To view logs remotely:${NC}"
echo -e "  ssh ${SERVER_USER}@${SERVER_IP} 'pm2 logs mpanel-backend'"
echo ""
