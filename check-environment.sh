#!/bin/bash
echo "=== Checking Environment Variables ==="
echo ""

# Required environment variables
REQUIRED_VARS=(
  "EMAIL_SALES"
  "EMAIL_SUPPORT"
  "EMAIL_INFO"
  "EMAIL_PARTNERSHIPS"
  "EMAIL_CAREERS"
  "EMAIL_BILLING"
  "REDIS_URL"
  "TWILIO_ACCOUNT_SID"
  "TWILIO_AUTH_TOKEN"
  "TWILIO_PHONE_NUMBER"
  "APP_URL"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing: $var"
    MISSING_VARS+=("$var")
  else
    echo "✅ Set: $var"
  fi
done

echo ""
if [ ${#MISSING_VARS[@]} -eq 0 ]; then
  echo "✅ All required environment variables are set!"
else
  echo "⚠️  Missing ${#MISSING_VARS[@]} environment variable(s)"
  echo ""
  echo "Add to your .env file:"
  for var in "${MISSING_VARS[@]}"; do
    echo "$var=your-value-here"
  done
fi
