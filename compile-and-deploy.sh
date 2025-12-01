#!/bin/bash
#
# Quick TypeScript Integration Script
# Compiles TS modules and integrates them into existing server
#

set -e

echo "🔧 Compiling TypeScript modules..."
cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel

# Install tsx if not already installed
npm list tsx || npm install -D tsx

# Compile TypeScript files to JavaScript
npx tsx --emit src/config/auth.ts
npx tsx --emit src/config/database.ts  
npx tsx --emit src/config/redis.ts
npx tsx --emit src/config/env.ts

# Compile module files
for dir in auth products orders; do
  for file in src/modules/$dir/*.ts; do
    if [ -f "$file" ]; then
      npx tsx --emit "$file"
    fi
  done
done

# Compile job files
npx tsx --emit src/jobs/queue.ts
npx tsx --emit src/jobs/workers/provisioning.worker.ts

# Compile service files
npx tsx --emit src/modules/dns/dns.service.ts
npx tsx --emit src/modules/hosting/hosting.service.ts
npx tsx --emit src/modules/mail/mail.service.ts

# Compile routes
npx tsx --emit src/routes/api.ts

echo "✓ TypeScript compiled to JavaScript"
echo ""
echo "📦 Deploying compiled files..."

# Deploy to production
./deploy-simple.sh

echo ""
echo "✅ Deployment complete!"
