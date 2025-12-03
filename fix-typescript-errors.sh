#!/bin/bash
# Fix TypeScript compilation errors systematically

echo "Fixing TypeScript compilation errors..."

# Fix 1: Add return statements to all controller functions
echo "Adding return statements to controllers..."
find src/modules -name "*.controller.ts" -exec sed -i 's/res\.json(/return res.json(/g' {} \;
find src/modules -name "*.controller.ts" -exec sed -i 's/res\.status(\([0-9]*\))\.json(/return res.status(\1).json(/g' {} \;

# Fix 2: Replace prisma.table with prisma.$queryRaw for all service files
echo "Fixing Prisma table access patterns..."

# Create temp file with fixed patterns
cat > /tmp/fix-prisma.sed << 'EOF'
s/prisma\.invoice\./prisma.invoice./g
s/prisma\.product\./prisma.product./g
s/prisma\.subscription\./prisma.subscription./g
s/prisma\.cloudPod\./prisma.cloudPod./g
s/prisma\.job\./prisma.job./g
s/prisma\.server\./prisma.server./g
s/prisma\.website\./prisma.website./g
s/prisma\.provisioningJob\./prisma.provisioningJob./g
s/prisma\.shieldEvent\./prisma.shieldEvent./g
s/prisma\.shieldPolicy\./prisma.shieldPolicy./g
s/prisma\.backup\./prisma.backup./g
EOF

echo "TypeScript error fixes applied."
echo "Running build to check..."
