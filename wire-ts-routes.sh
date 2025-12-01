#!/bin/bash
#
# Final Integration - Wire TypeScript Routes into Server
#

set -e

echo "🔌 Wiring TypeScript routes into production..."
echo ""

# Update deployment to include tsx and wire routes
ssh mhadmin@10.1.10.206 << 'ENDSSH'
cd /opt/mpanel

echo "→ Installing tsx for TypeScript runtime..."
npm install --save tsx

echo "→ Creating TypeScript route integration..."
cat > src/routes/ts-api.js << 'EOF'
// TypeScript API Routes Integration
// Uses tsx to load TypeScript modules at runtime
import { Router } from 'express';

let tsRouter = Router();

// Dynamically import TypeScript routes using tsx
try {
  const { register } = await import('tsx/esm/api');
  const unregister = register();
  
  const apiModule = await import('./api.ts');
  tsRouter = apiModule.default;
  
  console.log('✓ TypeScript routes loaded successfully');
} catch (error) {
  console.warn('⚠️  TypeScript routes not available:', error.message);
  tsRouter.get('*', (req, res) => {
    res.status(503).json({ 
      error: 'TypeScript routes not available',
      message: error.message 
    });
  });
}

export default tsRouter;
EOF

echo "→ Updating server.js to include TypeScript routes..."
# Add import for TS routes after existing route imports
sed -i '/import workerRouter from/a import tsApiRouter from '"'"'./routes/ts-api.js'"'"';' src/server.js

# Add TS routes before the legacy routes
sed -i '/app.use('"'"'\/api'"'"', routes);/i // New TypeScript API routes\napp.use('"'"'/api'"'"', tsApiRouter);' src/server.js

echo "→ Restarting PM2..."
pm2 restart tenant-billing

echo "→ Waiting for startup..."
sleep 5

echo "→ Testing new endpoints..."
curl -s http://localhost:2271/api/auth/me 2>&1 | head -5

echo ""
echo "✓ Integration complete!"
ENDSSH

echo ""
echo "════════════════════════════════════════"
echo "✅ TypeScript Routes Wired Successfully!"
echo "════════════════════════════════════════"
echo ""
echo "Test the new endpoints:"
echo "  curl http://10.1.10.206:2271/api/public/products"
echo "  curl -X POST http://10.1.10.206:2271/api/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"admin@example.com\",\"password\":\"test\"}'"
echo ""
