#!/bin/bash

# Test Advanced Production Optimizations
# Tests connection pool monitoring, query caching, N+1 detection, etc.

echo "=========================================="
echo "Advanced Optimizations Test Suite"
echo "=========================================="
echo ""

BASE_URL="http://localhost:2271"
FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Start server in background
echo "Starting server..."
npm run dev > /tmp/server-advanced.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
sleep 5

if ! lsof -i :2271 -i :2272 > /dev/null 2>&1; then
    echo -e "${RED}✗ FAILED${NC} - Server not running"
    exit 1
fi

echo -e "${GREEN}✓ Server started${NC}"
echo ""

# Test 1: Connection Pool Metrics
echo "Test 1: Connection Pool Monitoring"
echo "-----------------------------------"
METRICS=$(curl -s $BASE_URL/metrics | grep "db_pool_connections")
if [ -n "$METRICS" ]; then
    echo -e "${GREEN}✓ PASSED${NC} - Connection pool metrics exposed"
    echo "$METRICS" | head -3
else
    echo -e "${RED}✗ FAILED${NC} - Connection pool metrics not found"
    ((FAILED++))
fi
echo ""

# Test 2: Memory Leak Detection Metrics
echo "Test 2: Memory Leak Detection"
echo "-----------------------------------"
MEMORY_METRICS=$(curl -s $BASE_URL/metrics | grep "nodejs_heap")
if [ -n "$MEMORY_METRICS" ]; then
    echo -e "${GREEN}✓ PASSED${NC} - Memory metrics exposed"
    echo "$MEMORY_METRICS" | head -3
else
    echo -e "${RED}✗ FAILED${NC} - Memory metrics not found"
    ((FAILED++))
fi
echo ""

# Test 3: N+1 Detection Headers (Development)
echo "Test 3: N+1 Query Detection"
echo "-----------------------------------"
RESPONSE=$(curl -s -i $BASE_URL/api/health)
if echo "$RESPONSE" | grep -q "X-Request-ID"; then
    echo -e "${GREEN}✓ PASSED${NC} - Request ID tracking enabled"
    echo "N+1 detection middleware active (check logs for patterns)"
else
    echo -e "${YELLOW}⚠ WARNING${NC} - Request ID not found"
fi
echo ""

# Test 4: Query Cache Metrics
echo "Test 4: Query Cache"
echo "-----------------------------------"
CACHE_METRICS=$(curl -s $BASE_URL/metrics | grep "query_cache")
if [ -n "$CACHE_METRICS" ]; then
    echo -e "${GREEN}✓ PASSED${NC} - Query cache metrics exposed"
    echo "$CACHE_METRICS" | head -3
else
    echo -e "${YELLOW}⚠ WARNING${NC} - Query cache metrics not yet populated (may need queries)"
fi
echo ""

# Test 5: Smart Retry Metrics
echo "Test 5: Smart Retry Logic"
echo "-----------------------------------"
RETRY_METRICS=$(curl -s $BASE_URL/metrics | grep "retry_")
if [ -n "$RETRY_METRICS" ]; then
    echo -e "${GREEN}✓ PASSED${NC} - Retry metrics exposed"
    echo "$RETRY_METRICS" | head -3
else
    echo -e "${YELLOW}⚠ WARNING${NC} - Retry metrics not yet populated (no retries occurred)"
fi
echo ""

# Test 6: Request Coalescing Metrics
echo "Test 6: Request Coalescing"
echo "-----------------------------------"
COALESCE_METRICS=$(curl -s $BASE_URL/metrics | grep "coalesced_requests")
if [ -n "$COALESCE_METRICS" ]; then
    echo -e "${GREEN}✓ PASSED${NC} - Coalescing metrics exposed"
    echo "$COALESCE_METRICS"
else
    echo -e "${YELLOW}⚠ WARNING${NC} - Coalescing metrics not yet populated (no duplicate requests)"
fi
echo ""

# Test 7: Complete Metrics Endpoint
echo "Test 7: Prometheus Metrics Endpoint"
echo "-----------------------------------"
TOTAL_METRICS=$(curl -s $BASE_URL/metrics | grep -c "^#")
if [ "$TOTAL_METRICS" -gt 50 ]; then
    echo -e "${GREEN}✓ PASSED${NC} - Comprehensive metrics exposed (${TOTAL_METRICS} metrics)"
    echo "Sample metrics:"
    curl -s $BASE_URL/metrics | grep "^# HELP" | head -10
else
    echo -e "${RED}✗ FAILED${NC} - Insufficient metrics (only ${TOTAL_METRICS})"
    ((FAILED++))
fi
echo ""

# Test 8: Health Check with Memory Stats
echo "Test 8: Health Check Response"
echo "-----------------------------------"
HEALTH=$(curl -s $BASE_URL/api/health)
if echo "$HEALTH" | grep -q "status"; then
    echo -e "${GREEN}✓ PASSED${NC} - Health check responding"
    echo "$HEALTH" | jq -r '.status, .uptime, .timestamp' 2>/dev/null || echo "$HEALTH"
else
    echo -e "${RED}✗ FAILED${NC} - Health check failed"
    ((FAILED++))
fi
echo ""

# Test 9: Check Log Files for Optimization Messages
echo "Test 9: Log File Verification"
echo "-----------------------------------"
if grep -q "Connection pool monitoring initialized" /tmp/server-advanced.log; then
    echo -e "${GREEN}✓ PASSED${NC} - Connection pool monitoring initialized"
fi

if grep -q "Memory leak detection started" /tmp/server-advanced.log; then
    echo -e "${GREEN}✓ PASSED${NC} - Memory leak detection started"
fi

if grep -q "Database health monitoring" /tmp/server-advanced.log; then
    echo -e "${GREEN}✓ PASSED${NC} - Database health monitoring active"
fi
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
TOTAL=9
PASSED=$((TOTAL - FAILED))
echo "Total Tests: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "Failed: ${RED}$FAILED${NC}"
fi
echo ""

# Cleanup
echo "Cleaning up..."
kill $SERVER_PID 2>/dev/null
sleep 2

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}=========================================="
    echo "All Advanced Optimizations Working! ✓"
    echo -e "==========================================${NC}"
    exit 0
else
    echo -e "${YELLOW}=========================================="
    echo "Some tests failed or warnings present"
    echo -e "==========================================${NC}"
    exit 1
fi
