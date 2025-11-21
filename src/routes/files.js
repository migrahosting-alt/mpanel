import express from 'express';
import fs from 'node:fs/promises';
import fscb from 'node:fs';
import path from 'node:path';
import mime from 'mime-types';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import { resolveUserPath } from '../utils/fsSafe.js';

const router = express.Router();

// Multer in-memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Normalize query param
function cleanPath(p) {
  if (!p || p === '/') return '/';
  return p;
}

// Ensure base directory exists for a user
async function ensureBaseDir(basePath) {
  await fs.mkdir(basePath, { recursive: true });
}

// List directory
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const relPath = cleanPath(req.query.path);
    const { base, abs } = resolveUserPath(userId, relPath);

    await ensureBaseDir(base);

    const entries = await fs.readdir(abs, { withFileTypes: true });

    const detailed = await Promise.all(
      entries.map(async (e) => {
        const full = path.join(abs, e.name);
        const stat = await fs.stat(full);
        return {
          name: e.name,
          type: e.isDirectory() ? 'dir' : 'file',
          size: stat.size,
          permissions: (stat.mode & 0o777).toString(8),
          modified: stat.mtime,
        };
      })
    );

    res.json({
      success: true,
      path: relPath,
      entries: detailed.sort((a, b) => {
        // dirs first
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    });
  } catch (err) {
    console.error('File list error:', err);
    res.status(500).json({ success: false, error: 'Failed to load files' });
  }
});

// Download file
router.get('/download', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const relPath = cleanPath(req.query.path);
    const { abs } = resolveUserPath(userId, relPath);

    if (!fscb.existsSync(abs)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const filename = path.basename(abs);
    const mimeType = mime.lookup(filename) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    fscb.createReadStream(abs).pipe(res);
  } catch (err) {
    console.error('File download error:', err);
    res.status(500).json({ success: false, error: 'Failed to download file' });
  }
});

// Upload files to a directory
router.post(
  '/upload',
  authenticateToken,
  upload.array('files'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const relPath = cleanPath(req.body.path || '/');
      const { base, abs: absDir } = resolveUserPath(userId, relPath);

      await ensureBaseDir(base);
      await fs.mkdir(absDir, { recursive: true });

      const saved = [];

      for (const file of req.files) {
        const dest = path.join(absDir, file.originalname);
        await fs.writeFile(dest, file.buffer, { mode: 0o644 });
        const stat = await fs.stat(dest);
        saved.push({
          name: file.originalname,
          type: 'file',
          size: stat.size,
          permissions: (stat.mode & 0o777).toString(8),
          modified: stat.mtime,
        });
      }

      res.status(201).json({ success: true, uploaded: saved });
    } catch (err) {
      console.error('File upload error:', err);
      res.status(500).json({ success: false, error: 'Failed to upload files' });
    }
  }
);

// Create folder
router.post('/mkdir', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { path: rel, name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Folder name required' });
    }

    const relPath = cleanPath(rel);
    const { base, abs } = resolveUserPath(userId, relPath);
    await ensureBaseDir(base);

    const dirPath = path.join(abs, name);
    await fs.mkdir(dirPath, { recursive: true });

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('mkdir error:', err);
    res.status(500).json({ success: false, error: 'Failed to create folder' });
  }
});

// Delete file or folder (recursive)
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { path: rel } = req.body;
    if (!rel) {
      return res.status(400).json({ success: false, error: 'Path required' });
    }

    const { abs } = resolveUserPath(userId, rel);
    await fs.rm(abs, { recursive: true, force: true });

    res.json({ success: true });
  } catch (err) {
    console.error('delete error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete' });
  }
});

// Rename / move
router.post('/move', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to } = req.body;

    if (!from || !to) {
      return res
        .status(400)
        .json({ success: false, error: 'from and to paths are required' });
    }

    const { abs: absFrom } = resolveUserPath(userId, from);
    const { abs: absTo } = resolveUserPath(userId, to);

    await fs.rename(absFrom, absTo);
    res.json({ success: true });
  } catch (err) {
    console.error('move error:', err);
    res.status(500).json({ success: false, error: 'Failed to move' });
  }
});

export default router;

