#!/bin/bash

# ============================================
# mPanel Production Pre-Flight Validation
# ============================================
# This script validates all system requirements before deployment
# Run: bash pre-flight-check.sh
# ============================================

# Don't exit on errors - we want to collect all issues
set +e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Functions
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

# ============================================
# 1. System Requirements
# ============================================
print_header "1. System Requirements"

# Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    REQUIRED_NODE="20.0.0"
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -ge 20 ]; then
        check_pass "Node.js version: v$NODE_VERSION (>= v20.0.0)"
    else
        check_fail "Node.js version: v$NODE_VERSION (requires >= v20.0.0)"
    fi
else
    check_fail "Node.js not installed"
fi

# npm/yarn
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    check_pass "npm version: $NPM_VERSION"
else
    check_fail "npm not installed"
fi

# Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | awk '{print $3}' | sed 's/,//')
    check_pass "Docker version: $DOCKER_VERSION"
    
    # Check if Docker daemon is running
    if docker info &> /dev/null; then
        check_pass "Docker daemon is running"
    else
        check_fail "Docker daemon is not running (enable WSL2 integration in Docker Desktop)"
    fi
else
    check_fail "Docker not installed"
fi

# Docker Compose
if docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version | awk '{print $4}')
    check_pass "Docker Compose version: $COMPOSE_VERSION"
else
    check_fail "Docker Compose not available"
fi

# Disk space
DISK_AVAILABLE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
if [ "$DISK_AVAILABLE" -ge 10 ]; then
    check_pass "Disk space: ${DISK_AVAILABLE}GB available (>= 10GB)"
else
    check_warn "Disk space: ${DISK_AVAILABLE}GB available (recommended: >= 10GB)"
fi

# Memory
if command -v free &> /dev/null; then
    MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$MEMORY_GB" -ge 4 ]; then
        check_pass "Memory: ${MEMORY_GB}GB (>= 4GB)"
    else
        check_warn "Memory: ${MEMORY_GB}GB (recommended: >= 4GB)"
    fi
fi

# ============================================
# 2. Environment Configuration
# ============================================
print_header "2. Environment Configuration"

if [ -f .env ]; then
    check_pass ".env file exists"
    
    # Check critical variables
    source .env
    
    # Node environment
    if [ "$NODE_ENV" = "production" ]; then
        check_pass "NODE_ENV=production"
    elif [ "$NODE_ENV" = "development" ]; then
        check_warn "NODE_ENV=development (should be 'production' for live server)"
    else
        check_fail "NODE_ENV not set or invalid"
    fi
    
    # Database URL
    if [ -n "$DATABASE_URL" ]; then
        check_pass "DATABASE_URL is set"
        if [[ "$DATABASE_URL" == *"localhost"* ]] && [ "$NODE_ENV" = "production" ]; then
            check_warn "DATABASE_URL uses localhost (use production database for live server)"
        fi
    else
        check_fail "DATABASE_URL not set"
    fi
    
    # Redis URL
    if [ -n "$REDIS_URL" ]; then
        check_pass "REDIS_URL is set"
    else
        check_fail "REDIS_URL not set"
    fi
    
    # JWT Secret
    if [ -n "$JWT_SECRET" ]; then
        JWT_LENGTH=${#JWT_SECRET}
        if [ $JWT_LENGTH -ge 64 ]; then
            check_pass "JWT_SECRET is set (${JWT_LENGTH} characters)"
        else
            check_warn "JWT_SECRET length: ${JWT_LENGTH} characters (recommended: >= 64)"
        fi
    else
        check_fail "JWT_SECRET not set"
    fi
    
    # Stripe keys
    if [ -n "$STRIPE_SECRET_KEY" ]; then
        if [[ "$STRIPE_SECRET_KEY" == sk_live_* ]]; then
            check_pass "STRIPE_SECRET_KEY uses LIVE key"
        elif [[ "$STRIPE_SECRET_KEY" == sk_test_* ]]; then
            check_warn "STRIPE_SECRET_KEY uses TEST key (use LIVE key for production)"
        else
            check_fail "STRIPE_SECRET_KEY format invalid"
        fi
    else
        check_fail "STRIPE_SECRET_KEY not set"
    fi
    
    # SMTP configuration
    if [ -n "$SMTP_HOST" ] && [ -n "$SMTP_USER" ] && [ -n "$SMTP_PASS" ]; then
        check_pass "SMTP configuration is complete"
    else
        check_fail "SMTP configuration incomplete (emails won't work)"
    fi
    
    # CORS Origin
    if [ -n "$CORS_ORIGIN" ]; then
        if [[ "$CORS_ORIGIN" == *"localhost"* ]] && [ "$NODE_ENV" = "production" ]; then
            check_warn "CORS_ORIGIN uses localhost (set to production domain)"
        else
            check_pass "CORS_ORIGIN is set"
        fi
    else
        check_fail "CORS_ORIGIN not set"
    fi
    
else
    check_fail ".env file not found (copy from .env.example)"
fi

# ============================================
# 3. Dependencies
# ============================================
print_header "3. Dependencies"

if [ -d node_modules ]; then
    check_pass "node_modules directory exists"
    
    # Check package.json
    if [ -f package.json ]; then
        PACKAGE_COUNT=$(node -e "console.log(Object.keys(require('./package.json').dependencies || {}).length)")
        check_pass "package.json found with $PACKAGE_COUNT dependencies"
    else
        check_fail "package.json not found"
    fi
else
    check_fail "node_modules not found (run: npm install)"
fi

# Check frontend dependencies
if [ -d frontend/node_modules ]; then
    check_pass "Frontend dependencies installed"
else
    check_warn "Frontend dependencies not installed (run: cd frontend && npm install)"
fi

# ============================================
# 4. Database
# ============================================
print_header "4. Database"

# Check if PostgreSQL container is running
if docker ps | grep -q mpanel-postgres; then
    check_pass "PostgreSQL container is running"
    
    # Test database connection
    if docker exec mpanel-postgres pg_isready -U mpanel &> /dev/null; then
        check_pass "Database is accepting connections"
    else
        check_fail "Database is not accepting connections"
    fi
    
    # Check if database exists
    DB_EXISTS=$(docker exec mpanel-postgres psql -U mpanel -lqt | cut -d \| -f 1 | grep -w mpanel | wc -l)
    if [ "$DB_EXISTS" -eq 1 ]; then
        check_pass "Database 'mpanel' exists"
        
        # Count tables
        TABLE_COUNT=$(docker exec mpanel-postgres psql -U mpanel -d mpanel -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
        if [ "$TABLE_COUNT" -gt 50 ]; then
            check_pass "Database has $TABLE_COUNT tables (migrations applied)"
        elif [ "$TABLE_COUNT" -gt 0 ]; then
            check_warn "Database has only $TABLE_COUNT tables (run migrations)"
        else
            check_fail "Database has no tables (run migrations)"
        fi
    else
        check_fail "Database 'mpanel' does not exist"
    fi
else
    check_fail "PostgreSQL container not running (run: docker compose up -d)"
fi

# ============================================
# 5. Redis
# ============================================
print_header "5. Redis"

if docker ps | grep -q mpanel-redis; then
    check_pass "Redis container is running"
    
    # Test Redis connection
    if docker exec mpanel-redis redis-cli ping | grep -q PONG; then
        check_pass "Redis is responding to PING"
    else
        check_fail "Redis not responding"
    fi
else
    check_fail "Redis container not running (run: docker compose up -d)"
fi

# ============================================
# 6. MinIO/S3
# ============================================
print_header "6. MinIO/S3"

if docker ps | grep -q mpanel-minio; then
    check_pass "MinIO container is running"
else
    check_warn "MinIO container not running (optional, but recommended)"
fi

# ============================================
# 7. Security
# ============================================
print_header "7. Security"

# Check for exposed secrets
if [ -f .env ]; then
    if git ls-files --error-unmatch .env &> /dev/null; then
        check_fail ".env file is tracked by git (SECURITY RISK - add to .gitignore)"
    else
        check_pass ".env file is not tracked by git"
    fi
fi

# Check file permissions
if [ -f .env ]; then
    PERMISSIONS=$(stat -c %a .env 2>/dev/null || stat -f %A .env 2>/dev/null)
    if [[ "$PERMISSIONS" =~ ^[0-7]00$ ]]; then
        check_pass ".env file permissions: $PERMISSIONS (owner-only)"
    else
        check_warn ".env file permissions: $PERMISSIONS (recommended: 600)"
    fi
fi

# ============================================
# 8. File Structure
# ============================================
print_header "8. File Structure"

REQUIRED_DIRS=(
    "src"
    "src/controllers"
    "src/services"
    "src/routes"
    "src/middleware"
    "src/db"
    "frontend"
    "frontend/src"
    "prisma/migrations"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        check_pass "Directory exists: $dir"
    else
        check_fail "Missing directory: $dir"
    fi
done

REQUIRED_FILES=(
    "src/server.js"
    "package.json"
    "docker-compose.yml"
    "frontend/package.json"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        check_pass "File exists: $file"
    else
        check_fail "Missing file: $file"
    fi
done

# ============================================
# 9. Build Tests
# ============================================
print_header "9. Build Tests"

# Backend syntax check
if node -c src/server.js &> /dev/null; then
    check_pass "Backend syntax is valid (src/server.js)"
else
    check_fail "Backend has syntax errors"
fi

# Frontend build check (if node_modules exists)
if [ -d frontend/node_modules ]; then
    cd frontend
    if npm run build &> /dev/null; then
        check_pass "Frontend builds successfully"
        BUILD_SIZE=$(du -sh dist 2>/dev/null | cut -f1)
        echo -e "  ${GREEN}→${NC} Build size: $BUILD_SIZE"
    else
        check_fail "Frontend build failed"
    fi
    cd ..
else
    check_warn "Frontend build not tested (dependencies not installed)"
fi

# ============================================
# 10. Port Availability
# ============================================
print_header "10. Port Availability"

check_port() {
    local PORT=$1
    local SERVICE=$2
    if command -v netstat &> /dev/null; then
        if netstat -tuln 2>/dev/null | grep -q ":$PORT "; then
            check_warn "Port $PORT is in use (needed for $SERVICE)"
        else
            check_pass "Port $PORT is available ($SERVICE)"
        fi
    elif command -v ss &> /dev/null; then
        if ss -tuln 2>/dev/null | grep -q ":$PORT "; then
            check_warn "Port $PORT is in use (needed for $SERVICE)"
        else
            check_pass "Port $PORT is available ($SERVICE)"
        fi
    else
        check_warn "Cannot check port $PORT (netstat/ss not available)"
    fi
}

check_port 2271 "Backend API"
check_port 2272 "Frontend"
check_port 5433 "PostgreSQL"
check_port 6380 "Redis"
check_port 9000 "MinIO"

# ============================================
# Final Report
# ============================================
print_header "Pre-Flight Check Summary"

TOTAL=$((PASSED + FAILED + WARNINGS))

echo ""
echo -e "${GREEN}Passed:${NC}   $PASSED/$TOTAL"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS/$TOTAL"
echo -e "${RED}Failed:${NC}   $FAILED/$TOTAL"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ ALL CRITICAL CHECKS PASSED${NC}"
    echo -e "${GREEN}========================================${NC}"
    
    if [ $WARNINGS -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}⚠ There are $WARNINGS warnings to review${NC}"
        echo -e "${YELLOW}  Review warnings before production deployment${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "1. Review any warnings above"
    echo "2. For local development: npm run dev"
    echo "3. For production: Update .env with production values"
    echo "4. Run migrations: bash run-migrations.sh"
    echo "5. Start services: docker compose up -d"
    echo "6. Deploy: bash deploy-production.sh"
    
    exit 0
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}✗ PRE-FLIGHT CHECK FAILED${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo -e "${RED}Fix $FAILED critical issues before proceeding${NC}"
    echo ""
    echo "Common fixes:"
    echo "• Missing .env: cp .env.example .env"
    echo "• Missing dependencies: npm install && cd frontend && npm install"
    echo "• Docker not running: Start Docker Desktop and enable WSL2 integration"
    echo "• Database not ready: docker compose up -d"
    
    exit 1
fi
