#!/bin/bash

################################################################################
# mPanel Manual Testing Script
# Tests all major features and endpoints
################################################################################

BASE_URL="http://localhost:2271"
TENANT_ID="00000000-0000-0000-0000-000000000001"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counter
PASS=0
FAIL=0
TOTAL=0

test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local expected_code="${4:-200}"
    local data="$5"
    
    TOTAL=$((TOTAL + 1))
    echo -e "\n${BLUE}[Test $TOTAL]${NC} $name"
    echo -e "${YELLOW}→${NC} $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint" 2>/dev/null)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_code" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        PASS=$((PASS + 1))
        # Show response preview
        echo "$body" | jq -C '.' 2>/dev/null | head -5 || echo "$body" | head -3
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_code, got $http_code)"
        FAIL=$((FAIL + 1))
        echo "$body" | head -3
    fi
}

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

print_summary() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Test Summary${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "\nTotal Tests: $TOTAL"
    echo -e "${GREEN}Passed: $PASS${NC}"
    echo -e "${RED}Failed: $FAIL${NC}"
    
    if [ $FAIL -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All tests passed!${NC}"
    else
        echo -e "\n${YELLOW}⚠ Some tests failed. Review output above.${NC}"
    fi
}

################################################################################
# Section 1: Health & Status Checks
################################################################################

print_header "Section 1: Health & Status Checks"

test_endpoint "Health Check" "GET" "/api/health" 200
test_endpoint "Ready Check" "GET" "/api/ready" 200
test_endpoint "Live Check" "GET" "/api/live" 200
test_endpoint "Prometheus Metrics" "GET" "/metrics" 200

################################################################################
# Section 2: Service Plans & Pricing
################################################################################

print_header "Section 2: Service Plans & Pricing"

test_endpoint "Get All Plans" "GET" "/api/plans/pricing" 200
test_endpoint "Get Bundles" "GET" "/api/plans/bundles" 200
test_endpoint "Get Security Templates" "GET" "/api/plans/security-templates" 200
test_endpoint "Get Backup Policies" "GET" "/api/plans/backup-policies" 200

################################################################################
# Section 3: Enhanced Features - Public Endpoints
################################################################################

print_header "Section 3: Enhanced Features (Public)"

# Note: These require authentication, expect 401 or 403
test_endpoint "Get Active Promos" "GET" "/api/enhanced-plans/promos/active" 200
test_endpoint "Get Referral Stats (no auth)" "GET" "/api/enhanced-plans/referrals/stats" 401

################################################################################
# Section 4: Marketing API Integration
################################################################################

print_header "Section 4: Marketing API Integration"

test_endpoint "System Status (Public)" "GET" "/api/marketing-api/status/system" 200
test_endpoint "Product Catalog" "GET" "/api/marketing-api/products/catalog" 200

################################################################################
# Section 5: GraphQL Introspection
################################################################################

print_header "Section 5: GraphQL API"

test_endpoint "GraphQL Playground" "GET" "/graphql" 200

# Test GraphQL introspection query
INTROSPECTION_QUERY='{"query":"{ __schema { types { name } } }"}'
test_endpoint "GraphQL Introspection" "POST" "/graphql" 200 "$INTROSPECTION_QUERY"

################################################################################
# Section 6: WebSocket Connection
################################################################################

print_header "Section 6: WebSocket"

# Test WebSocket endpoint is accessible (will get upgrade required)
test_endpoint "WebSocket Endpoint" "GET" "/ws" 426

################################################################################
# Section 7: Static Files & Frontend
################################################################################

print_header "Section 7: Frontend & Static Files"

# These will 404 if frontend not built, which is ok
test_endpoint "Frontend Root" "GET" "/" 200

################################################################################
# Section 8: Database-Dependent Features
################################################################################

print_header "Section 8: Database Features (Read-Only)"

# These should work if migrations ran
test_endpoint "Service Plans Query" "GET" "/api/plans/pricing" 200

################################################################################
# Print Summary
################################################################################

print_summary

exit $([ $FAIL -eq 0 ] && echo 0 || echo 1)
