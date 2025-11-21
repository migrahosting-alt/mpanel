#!/bin/bash
# Test Enterprise Infrastructure Endpoints

echo "========================================"
echo "Testing Enterprise Infrastructure"
echo "========================================"
echo ""

BASE_URL="http://127.0.0.1:2271"

# Test 1: Health Check
echo "1. Testing /api/health endpoint..."
echo "-----------------------------------"
curl -s "$BASE_URL/api/health" | python3 -m json.tool | head -50
echo ""
echo ""

# Test 2: Readiness Probe
echo "2. Testing /api/ready (K8s readiness probe)..."
echo "-----------------------------------------------"
curl -s "$BASE_URL/api/ready" | python3 -m json.tool
echo ""
echo ""

# Test 3: Liveness Probe
echo "3. Testing /api/live (K8s liveness probe)..."
echo "----------------------------------------------"
curl -s "$BASE_URL/api/live" | python3 -m json.tool
echo ""
echo ""

# Test 4: Prometheus Metrics
echo "4. Testing /metrics (Prometheus endpoint)..."
echo "---------------------------------------------"
echo "First 50 lines of metrics:"
curl -s "$BASE_URL/metrics" | head -50
echo ""
echo "..."
echo ""
echo "Metrics summary:"
curl -s "$BASE_URL/metrics" | grep -E "^(http_|db_|queue_|user_|revenue|email|sms|rate_limit|auth_|webhook_)" | head -20
echo ""
echo ""

# Test 5: Request ID tracking
echo "5. Testing Request ID tracking..."
echo "---------------------------------"
RESPONSE=$(curl -s -i "$BASE_URL/")
echo "Response headers:"
echo "$RESPONSE" | grep -i "x-request-id"
echo ""
echo ""

# Test 6: Root endpoint
echo "6. Testing root endpoint..."
echo "---------------------------"
curl -s "$BASE_URL/" | python3 -m json.tool
echo ""
echo ""

echo "========================================"
echo "Infrastructure Tests Complete!"
echo "========================================"
