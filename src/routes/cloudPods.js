import { Router } from 'express';

const { tsImport } = await import('tsx/esm/api').catch(() => ({ tsImport: null }));

let router = Router();

if (tsImport) {
  const module = await tsImport('./cloudPods.ts', import.meta.url);
  router = module.default ?? router;
} else {
  console.warn('[cloudPods] Unable to load tsx runtime; mounting placeholder router');
  router.get('*', (_req, res) => {
    res.status(503).json({ success: false, error: 'CloudPods routes unavailable' });
  });
}

export default router;
