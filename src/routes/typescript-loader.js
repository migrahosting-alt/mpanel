/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * TypeScript Routes Loader - Dynamically loads TypeScript route modules using tsx/register
 */
import { Router } from 'express';

const router = Router();

// Try to load TypeScript routes if available
try {
  // Register tsx for TypeScript runtime support
  await import('tsx/esm/api').then(async (tsx) => {
    const { tsImport } = tsx;
    
    // Import TypeScript API routes
    const apiRoutes = await tsImport('../routes/api.ts', import.meta.url);
    
    // Mount directly (versioning handled by parent)
    router.use('/', apiRoutes.default);
    
    console.log('✓ TypeScript routes loaded successfully');
  });
} catch (error) {
  console.warn('TypeScript routes not available:', error.message);
  console.log('Using legacy JavaScript routes only');
}

export default router;
