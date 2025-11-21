import path from 'node:path';
import { env } from '../config/env.js';

export function resolveUserPath(userId, relativePath = '/') {
  const safeRel = relativePath || '/';

  // base dir: FILE_ROOT/<userId>/public_html
  const base = path.join(env.FILE_ROOT, userId, 'public_html');
  const joined = path.join(base, safeRel);
  const normalized = path.normalize(joined);

  if (!normalized.startsWith(base)) {
    throw new Error('Invalid path');
  }

  return { base, abs: normalized };
}
