#!/bin/bash

# Marketing API Endpoint Testing Script
# Tests all marketing website integration endpoints

API_URL="http://localhost:2271/api/marketing"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  mPanel Marketing API Test Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Pricing API
echo -e "${YELLOW}[TEST 1] GET /api/marketing/pricing${NC}"
echo "Fetching pricing plans..."
RESPONSE=$(curl -s -w "\n%{http_code}" $API_URL/pricing)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ SUCCESS${NC} - HTTP $HTTP_CODE"
    echo "$BODY" | jq -r '.plans[] | "  • \(.name): $\(.price)/\(.billing_cycle)"' 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ FAILED${NC} - HTTP $HTTP_CODE"
    echo "$BODY"
fi
echo ""

# Test 2: Features API
echo -e "${YELLOW}[TEST 2] GET /api/marketing/features${NC}"
echo "Fetching feature list..."
RESPONSE=$(curl -s -w "\n%{http_code}" $API_URL/features)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ SUCCESS${NC} - HTTP $HTTP_CODE"
    FEATURE_COUNT=$(echo "$BODY" | jq -r '.features | length' 2>/dev/null)
    echo "  Features returned: $FEATURE_COUNT"
else
    echo -e "${RED}✗ FAILED${NC} - HTTP $HTTP_CODE"
    echo "$BODY"
fi
echo ""

# Test 3: System Status
echo -e "${YELLOW}[TEST 3] GET /api/marketing/status${NC}"
echo "Checking system status..."
RESPONSE=$(curl -s -w "\n%{http_code}" $API_URL/status)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ SUCCESS${NC} - HTTP $HTTP_CODE"
    echo "$BODY" | jq -r '"  Status: \(.status)\n  Uptime: \(.uptime)%\n  Database: \(.services.database)"' 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ FAILED${NC} - HTTP $HTTP_CODE"
    echo "$BODY"
fi
echo ""

# Test 4: Contact Form (Sales Department)
echo -e "${YELLOW}[TEST 4] POST /api/marketing/contact${NC}"
echo "Submitting contact form (sales department)..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST $API_URL/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "department": "sales",
    "subject": "API Test - Interested in Enterprise Plan",
    "message": "This is an automated test message from the API test suite."
  }')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}✓ SUCCESS${NC} - HTTP $HTTP_CODE"
    echo "$BODY" | jq -r '"  Inquiry ID: \(.inquiryId)\n  Message: \(.message)"' 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ FAILED${NC} - HTTP $HTTP_CODE"
    echo "$BODY"
fi
echo ""

# Test 5: Newsletter Signup
echo -e "${YELLOW}[TEST 5] POST /api/marketing/newsletter${NC}"
echo "Testing newsletter signup..."
RANDOM_EMAIL="newsletter-test-$(date +%s)@example.com"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST $API_URL/newsletter \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$RANDOM_EMAIL\",
    \"name\": \"Newsletter Test User\",
    \"source\": \"api-test\"
  }")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ SUCCESS${NC} - HTTP $HTTP_CODE"
    echo "$BODY" | jq -r '.message' 2>/dev/null || echo "$BODY"
    echo "  Email used: $RANDOM_EMAIL"
else
    echo -e "${RED}✗ FAILED${NC} - HTTP $HTTP_CODE"
    echo "$BODY"
fi
echo ""

# Test 6: Demo Request
echo -e "${YELLOW}[TEST 6] POST /api/marketing/demo-request${NC}"
echo "Submitting demo request..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST $API_URL/demo-request \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demo Test User",
    "email": "demo-test@example.com",
    "phone": "+1234567890",
    "company": "Test Corporation",
    "employeeCount": "10-50",
    "message": "Automated test demo request"
  }')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}✓ SUCCESS${NC} - HTTP $HTTP_CODE"
    echo "$BODY" | jq -r '"  Request ID: \(.requestId)\n  Message: \(.message)"' 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ FAILED${NC} - HTTP $HTTP_CODE"
    echo "$BODY"
fi
echo ""

# Test 7: Early Access Signup
echo -e "${YELLOW}[TEST 7] POST /api/marketing/early-access${NC}"
echo "Testing early access signup..."
RANDOM_EMAIL="early-access-$(date +%s)@example.com"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST $API_URL/early-access \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$RANDOM_EMAIL\",
    \"name\": \"Early Access User\",
    \"useCase\": \"API testing and validation\",
    \"company\": \"Test Labs\"
  }")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ SUCCESS${NC} - HTTP $HTTP_CODE"
    echo "$BODY" | jq -r '"  Access Code: \(.accessCode)\n  Message: \(.message)"' 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ FAILED${NC} - HTTP $HTTP_CODE"
    echo "$BODY"
fi
echo ""

# Test 8: Newsletter Unsubscribe
echo -e "${YELLOW}[TEST 8] POST /api/marketing/unsubscribe${NC}"
echo "Testing newsletter unsubscribe..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST $API_URL/unsubscribe \
  -H "Content-Type: application/json" \
  -d '{
    "email": "unsubscribe-test@example.com"
  }')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ SUCCESS${NC} - HTTP $HTTP_CODE"
    echo "$BODY" | jq -r '.message' 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ FAILED${NC} - HTTP $HTTP_CODE"
    echo "$BODY"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Test Suite Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Note: Check email queue and database for actual email delivery."
echo "Email queue jobs can be monitored via Bull dashboard or Redis."
echo ""
