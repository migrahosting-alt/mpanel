#!/bin/bash

#############################################
# mPanel Auto-Fix & Recovery System
# Monitors, diagnoses, and auto-repairs frontend/backend issues
#############################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log file
LOG_FILE="/tmp/mpanel-autofix.log"
BACKEND_LOG="/tmp/mpanel-backend.log"
FRONTEND_LOG="/tmp/mpanel-frontend.log"

# Backup directory
BACKUP_DIR="/tmp/mpanel-backups"
mkdir -p "$BACKUP_DIR"

# Timestamp for backups
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  mPanel Auto-Fix & Recovery System v1.0${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"

#############################################
# Health Check Functions
#############################################

check_backend() {
    echo -n "Checking backend (port 2271)... "
    if curl -s --max-time 5 http://localhost:2271/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Healthy${NC}"
        return 0
    else
        echo -e "${RED}✗ Down${NC}"
        return 1
    fi
}

check_frontend() {
    echo -n "Checking frontend (port 2272)... "
    if curl -s --max-time 5 http://localhost:2272 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Healthy${NC}"
        return 0
    else
        echo -e "${RED}✗ Down${NC}"
        return 1
    fi
}

check_database() {
    echo -n "Checking PostgreSQL database... "
    if docker exec mpanel-postgres pg_isready -U mpanel > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Healthy${NC}"
        return 0
    else
        echo -e "${RED}✗ Down${NC}"
        return 1
    fi
}

check_redis() {
    echo -n "Checking Redis... "
    if docker exec mpanel-redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Healthy${NC}"
        return 0
    else
        echo -e "${RED}✗ Down${NC}"
        return 1
    fi
}

#############################################
# Backup Functions
#############################################

create_backup() {
    echo -e "\n${YELLOW}Creating backup before recovery...${NC}"
    
    # Backup node_modules state
    if [ -d "node_modules" ]; then
        echo "Backing up backend node_modules list..."
        ls -la node_modules > "$BACKUP_DIR/backend_modules_$TIMESTAMP.txt"
    fi
    
    if [ -d "frontend/node_modules" ]; then
        echo "Backing up frontend node_modules list..."
        ls -la frontend/node_modules > "$BACKUP_DIR/frontend_modules_$TIMESTAMP.txt"
    fi
    
    # Backup logs
    [ -f "$BACKEND_LOG" ] && cp "$BACKEND_LOG" "$BACKUP_DIR/backend_$TIMESTAMP.log"
    [ -f "$FRONTEND_LOG" ] && cp "$FRONTEND_LOG" "$BACKUP_DIR/frontend_$TIMESTAMP.log"
    
    # Backup package-lock files
    [ -f "package-lock.json" ] && cp package-lock.json "$BACKUP_DIR/backend_package-lock_$TIMESTAMP.json"
    [ -f "frontend/package-lock.json" ] && cp frontend/package-lock.json "$BACKUP_DIR/frontend_package-lock_$TIMESTAMP.json"
    
    echo -e "${GREEN}✓ Backup created in $BACKUP_DIR${NC}"
}

#############################################
# Recovery Functions
#############################################

fix_backend() {
    echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  Fixing Backend (Node.js + Express)${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    # Kill existing backend processes
    echo "Stopping all Node.js backend processes..."
    pkill -f "node.*src/server.js" || true
    pkill -f "node --watch src/server.js" || true
    sleep 2
    
    # Check for port conflicts
    echo "Checking port 2271..."
    if lsof -Pi :2271 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}Port 2271 is in use. Killing process...${NC}"
        lsof -ti:2271 | xargs kill -9 || true
        sleep 1
    fi
    
    # Check node_modules
    if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
        echo -e "${YELLOW}node_modules missing or corrupted. Reinstalling...${NC}"
        rm -rf node_modules package-lock.json
        npm install
    fi
    
    # Start backend
    echo -e "\n${GREEN}Starting backend server...${NC}"
    nohup npm run dev > "$BACKEND_LOG" 2>&1 &
    BACKEND_PID=$!
    echo "Backend PID: $BACKEND_PID"
    
    # Wait and verify
    echo -n "Waiting for backend to start"
    for i in {1..15}; do
        sleep 1
        echo -n "."
        if curl -s http://localhost:2271/api/health > /dev/null 2>&1; then
            echo -e "\n${GREEN}✓ Backend is UP and healthy!${NC}"
            return 0
        fi
    done
    
    echo -e "\n${RED}✗ Backend failed to start. Check logs:${NC}"
    echo "  tail -50 $BACKEND_LOG"
    return 1
}

fix_frontend() {
    echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  Fixing Frontend (Vite + React)${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    cd frontend
    
    # Kill existing frontend processes
    echo "Stopping all Vite frontend processes..."
    pkill -f "vite" || true
    pkill -f "node.*vite" || true
    sleep 2
    
    # Check for port conflicts
    echo "Checking port 2272..."
    if lsof -Pi :2272 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}Port 2272 is in use. Killing process...${NC}"
        lsof -ti:2272 | xargs kill -9 || true
        sleep 1
    fi
    
    # Check node_modules
    if [ ! -d "node_modules" ] || [ ! -f "node_modules/.vite" ]; then
        echo -e "${YELLOW}node_modules missing or corrupted. Reinstalling...${NC}"
        rm -rf node_modules package-lock.json
        npm install
    fi
    
    # Clear Vite cache
    echo "Clearing Vite cache..."
    rm -rf node_modules/.vite dist .vite
    
    # Start frontend
    echo -e "\n${GREEN}Starting frontend server...${NC}"
    nohup npm run dev > "$FRONTEND_LOG" 2>&1 &
    FRONTEND_PID=$!
    echo "Frontend PID: $FRONTEND_PID"
    
    cd ..
    
    # Wait and verify
    echo -n "Waiting for frontend to start"
    for i in {1..20}; do
        sleep 1
        echo -n "."
        if curl -s http://localhost:2272 > /dev/null 2>&1; then
            echo -e "\n${GREEN}✓ Frontend is UP and serving!${NC}"
            return 0
        fi
    done
    
    echo -e "\n${RED}✗ Frontend failed to start. Check logs:${NC}"
    echo "  tail -50 $FRONTEND_LOG"
    return 1
}

fix_database() {
    echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  Fixing Database (PostgreSQL)${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    echo "Restarting PostgreSQL container..."
    docker restart mpanel-postgres
    
    echo -n "Waiting for database to be ready"
    for i in {1..30}; do
        sleep 1
        echo -n "."
        if docker exec mpanel-postgres pg_isready -U mpanel > /dev/null 2>&1; then
            echo -e "\n${GREEN}✓ Database is UP!${NC}"
            return 0
        fi
    done
    
    echo -e "\n${RED}✗ Database failed to start${NC}"
    return 1
}

fix_redis() {
    echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  Fixing Redis${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    echo "Restarting Redis container..."
    docker restart mpanel-redis
    
    sleep 3
    
    if docker exec mpanel-redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis is UP!${NC}"
        return 0
    else
        echo -e "${RED}✗ Redis failed to start${NC}"
        return 1
    fi
}

#############################################
# Nuclear Option - Full Rebuild
#############################################

nuclear_rebuild() {
    echo -e "\n${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}  ☢️  NUCLEAR REBUILD - Full System Reset${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    read -p "This will rebuild EVERYTHING. Continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "Aborted."
        return 1
    fi
    
    create_backup
    
    echo -e "\n${YELLOW}Step 1/6: Killing all processes...${NC}"
    pkill -f "node" || true
    pkill -f "vite" || true
    sleep 2
    
    echo -e "\n${YELLOW}Step 2/6: Removing node_modules...${NC}"
    rm -rf node_modules frontend/node_modules
    rm -f package-lock.json frontend/package-lock.json
    
    echo -e "\n${YELLOW}Step 3/6: Restarting Docker services...${NC}"
    docker compose down
    docker compose up -d
    sleep 5
    
    echo -e "\n${YELLOW}Step 4/6: Reinstalling backend dependencies...${NC}"
    npm install
    
    echo -e "\n${YELLOW}Step 5/6: Reinstalling frontend dependencies...${NC}"
    cd frontend
    npm install
    cd ..
    
    echo -e "\n${YELLOW}Step 6/6: Starting services...${NC}"
    fix_backend
    fix_frontend
    
    echo -e "\n${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✓ Nuclear rebuild complete!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
}

#############################################
# Smart Recovery - Auto-detect and fix
#############################################

smart_recovery() {
    echo -e "\n${BLUE}Running smart diagnostics...${NC}\n"
    
    ISSUES=()
    
    # Check all components
    check_database || ISSUES+=("database")
    check_redis || ISSUES+=("redis")
    check_backend || ISSUES+=("backend")
    check_frontend || ISSUES+=("frontend")
    
    if [ ${#ISSUES[@]} -eq 0 ]; then
        echo -e "\n${GREEN}═══════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}  ✓ All systems healthy! No fixes needed.${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
        return 0
    fi
    
    echo -e "\n${RED}Found ${#ISSUES[@]} issue(s): ${ISSUES[*]}${NC}"
    create_backup
    
    # Fix in order of dependency
    for issue in "${ISSUES[@]}"; do
        case $issue in
            database)
                fix_database || echo -e "${RED}Failed to fix database${NC}"
                ;;
            redis)
                fix_redis || echo -e "${RED}Failed to fix Redis${NC}"
                ;;
            backend)
                fix_backend || echo -e "${RED}Failed to fix backend${NC}"
                ;;
            frontend)
                fix_frontend || echo -e "${RED}Failed to fix frontend${NC}"
                ;;
        esac
    done
    
    # Final health check
    echo -e "\n${BLUE}Running final health check...${NC}\n"
    check_database
    check_redis
    check_backend
    check_frontend
    
    echo -e "\n${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✓ Recovery complete!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "\n${BLUE}Access your panel:${NC}"
    echo -e "  Frontend: ${GREEN}http://localhost:2272${NC}"
    echo -e "  Backend:  ${GREEN}http://localhost:2271${NC}"
    echo -e "  Login:    ${YELLOW}admin@migrahosting.com / admin123${NC}"
}

#############################################
# Main Menu
#############################################

show_menu() {
    echo -e "\n${BLUE}What would you like to do?${NC}\n"
    echo "  1) Smart Auto-Fix (Recommended - Auto-detects and fixes issues)"
    echo "  2) Fix Backend Only"
    echo "  3) Fix Frontend Only"
    echo "  4) Fix Database Only"
    echo "  5) Fix Redis Only"
    echo "  6) Full Health Check (No fixes)"
    echo "  7) Nuclear Rebuild (Complete reset)"
    echo "  8) View Logs"
    echo "  9) Restore from Backup"
    echo "  0) Exit"
    echo ""
    read -p "Enter choice [0-9]: " choice
    
    case $choice in
        1)
            smart_recovery
            ;;
        2)
            create_backup
            fix_backend
            ;;
        3)
            create_backup
            fix_frontend
            ;;
        4)
            create_backup
            fix_database
            ;;
        5)
            create_backup
            fix_redis
            ;;
        6)
            check_database
            check_redis
            check_backend
            check_frontend
            ;;
        7)
            nuclear_rebuild
            ;;
        8)
            echo -e "\n${BLUE}Recent Backend Logs:${NC}"
            tail -30 "$BACKEND_LOG" 2>/dev/null || echo "No backend logs"
            echo -e "\n${BLUE}Recent Frontend Logs:${NC}"
            tail -30 "$FRONTEND_LOG" 2>/dev/null || echo "No frontend logs"
            ;;
        9)
            echo -e "\n${BLUE}Available Backups:${NC}"
            ls -lht "$BACKUP_DIR" | head -20
            ;;
        0)
            echo "Exiting..."
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            ;;
    esac
}

#############################################
# Auto-mode (no interaction)
#############################################

if [ "$1" == "--auto" ]; then
    smart_recovery
    exit 0
fi

#############################################
# Interactive Mode
#############################################

while true; do
    show_menu
    echo ""
    read -p "Press Enter to continue..."
done
