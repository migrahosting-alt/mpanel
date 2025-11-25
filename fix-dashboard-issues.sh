#!/bin/bash
# Quick Fix Script for mPanel Dashboard Issues
# Date: November 24, 2025

set -e

echo "=== mPanel Dashboard Quick Fix Script ==="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}This script will attempt to fix the following issues:${NC}"
echo "1. Domain Management - 'pool is not defined' error"
echo "2. Website fetch errors"
echo "3. SSL certificate fetch errors"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

echo ""
echo -e "${GREEN}Step 1: Finding files with 'pool is not defined' errors${NC}"

# Search for domain-related files
echo "Checking domain routes and controllers..."
grep -l "domains" src/routes/*.js 2>/dev/null || echo "No matches in routes"
grep -l "domains" src/controllers/*.js 2>/dev/null || echo "No matches in controllers"

echo ""
echo -e "${GREEN}Step 2: Checking if pool import exists in domain files${NC}"

# Check domainRoutes.js
if [ -f "src/routes/domainRoutes.js" ]; then
    echo "Checking src/routes/domainRoutes.js..."
    if grep -q "import pool from" src/routes/domainRoutes.js; then
        echo -e "${GREEN}✓ Pool import found${NC}"
    else
        echo -e "${RED}✗ Pool import NOT found - needs manual fix${NC}"
        echo "Add this line at the top:"
        echo "  import pool from '../db/index.js';"
    fi
fi

# Check domainController.js
if [ -f "src/controllers/domainController.js" ]; then
    echo "Checking src/controllers/domainController.js..."
    if grep -q "import pool from" src/controllers/domainController.js; then
        echo -e "${GREEN}✓ Pool import found${NC}"
    else
        echo -e "${RED}✗ Pool import NOT found - needs manual fix${NC}"
        echo "Add this line at the top:"
        echo "  import pool from '../db/index.js';"
    fi
fi

echo ""
echo -e "${GREEN}Step 3: Checking website controller${NC}"

if [ -f "src/controllers/websiteController.js" ]; then
    echo "Checking src/controllers/websiteController.js for errors..."
    if grep -q "import pool from" src/controllers/websiteController.js; then
        echo -e "${GREEN}✓ Pool import found${NC}"
    else
        echo -e "${YELLOW}⚠ Pool import NOT found${NC}"
    fi
    
    # Check for try-catch blocks
    if grep -q "try {" src/controllers/websiteController.js; then
        echo -e "${GREEN}✓ Error handling found${NC}"
    else
        echo -e "${YELLOW}⚠ No error handling found${NC}"
    fi
fi

echo ""
echo -e "${GREEN}Step 4: Checking SSL routes${NC}"

if [ -f "src/routes/sslRoutes.js" ]; then
    echo "Checking src/routes/sslRoutes.js..."
    if grep -q "import pool from" src/routes/sslRoutes.js; then
        echo -e "${GREEN}✓ Pool import found${NC}"
    else
        echo -e "${YELLOW}⚠ Pool import NOT found${NC}"
    fi
fi

if [ -f "src/controllers/sslController.js" ]; then
    echo "Checking src/controllers/sslController.js..."
    if grep -q "import pool from" src/controllers/sslController.js; then
        echo -e "${GREEN}✓ Pool import found${NC}"
    else
        echo -e "${YELLOW}⚠ Pool import NOT found${NC}"
    fi
fi

echo ""
echo -e "${GREEN}Step 5: Checking PM2 logs for recent errors${NC}"

if command -v pm2 &> /dev/null; then
    echo "Recent backend errors (last 20 lines):"
    pm2 logs mpanel-backend --lines 20 --nostream 2>/dev/null | grep -i "error\|failed\|pool" || echo "No errors found in recent logs"
else
    echo -e "${YELLOW}PM2 not installed locally - run on server:${NC}"
    echo "ssh root@10.1.10.206 'pm2 logs mpanel-backend --lines 50 | grep -i error'"
fi

echo ""
echo -e "${GREEN}Step 6: Database connectivity check${NC}"

# Test database connection
if command -v psql &> /dev/null; then
    echo "Testing PostgreSQL connection to 10.1.10.210:5432..."
    PGPASSWORD=mpanel psql -h 10.1.10.210 -U mpanel -d mpanel -c "SELECT 1;" 2>&1 | grep -q "1 row" && \
        echo -e "${GREEN}✓ Database connection OK${NC}" || \
        echo -e "${RED}✗ Database connection FAILED - check pg_hba.conf${NC}"
else
    echo -e "${YELLOW}psql not installed - skipping database check${NC}"
fi

echo ""
echo "=== MANUAL FIX REQUIRED FOR: ==="
echo ""
echo -e "${YELLOW}1. Domain Management 'pool is not defined'${NC}"
echo "   File: src/routes/domainRoutes.js or src/controllers/domainController.js"
echo "   Fix: Add 'import pool from \"../db/index.js\";' at the top"
echo ""
echo -e "${YELLOW}2. Website Fetch Error${NC}"
echo "   File: src/controllers/websiteController.js"
echo "   Fix: Check database query and error handling"
echo ""
echo -e "${YELLOW}3. SSL Certificate Error${NC}"
echo "   File: src/routes/sslRoutes.js or src/controllers/sslController.js"
echo "   Fix: Check database query and pool import"
echo ""
echo -e "${YELLOW}4. Database Connection (pg_hba.conf)${NC}"
echo "   Server: 10.1.10.210"
echo "   Fix: Add to /var/lib/postgresql/data/pg_hba.conf:"
echo "        host    mpanel    mpanel    10.1.10.206/32    md5"
echo "        host    mpanel    mpanel    10.1.10.70/32     md5"
echo "   Then: systemctl reload postgresql"
echo ""
echo -e "${GREEN}After making fixes, restart backend:${NC}"
echo "  ssh root@10.1.10.206 'pm2 restart mpanel-backend'"
echo ""
echo "=== Fix script complete ===" 