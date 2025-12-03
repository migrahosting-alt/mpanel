/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * TypeScript Routes Loader - Dynamically loads TypeScript route modules using tsx/register
 */
import { Router } from 'express';

/**
 * Load TypeScript routes asynchronously
 * Returns a router with TypeScript routes mounted
 */
export default async function loadTypescriptRoutes() {
  const router = Router();
  
  try {
    // Register tsx for TypeScript runtime support
    const tsx = await import('tsx/esm/api');
    const { tsImport } = tsx;
    
    // Import TypeScript API routes
    const apiRoutes = await tsImport('../routes/api.ts', import.meta.url);
    
    // Mount directly (versioning handled by parent)
    router.use('/', apiRoutes.default);
    
    console.log('✓ TypeScript routes loaded successfully');
  } catch (error) {
    console.warn('TypeScript routes not available:', error.message);
    console.log('Using legacy JavaScript routes only');
  }
  
  return router;
}
