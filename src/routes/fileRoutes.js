import express from 'express';
import pool from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import multer from 'multer';
import archiver from 'archiver';
import { extract } from 'tar';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = req.body.path || '/tmp';
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// Helper function to get user's home directory
const getUserHomeDir = async (userId, tenantId) => {
  const result = await pool.query(
    'SELECT username FROM users WHERE id = $1',
    [userId]
  );
  
  if (!result.rows[0]) {
    throw new Error('User not found');
  }
  
  // In production, this would be /home/username or tenant-specific paths
  return `/var/www/${tenantId}/${result.rows[0].username}`;
};

// Helper function to validate path is within user's directory
const validatePath = (basePath, requestedPath) => {
  const resolvedBase = path.resolve(basePath);
  const resolvedPath = path.resolve(basePath, requestedPath);
  
  if (!resolvedPath.startsWith(resolvedBase)) {
    throw new Error('Access denied: Path outside allowed directory');
  }
  
  return resolvedPath;
};

// Helper function to get file stats
const getFileStats = async (filePath) => {
  try {
    const stats = await fs.stat(filePath);
    const parsed = path.parse(filePath);
    
    return {
      name: parsed.base,
      path: filePath,
      size: stats.size,
      type: stats.isDirectory() ? 'directory' : 'file',
      permissions: (stats.mode & parseInt('777', 8)).toString(8),
      owner: stats.uid,
      group: stats.gid,
      modified: stats.mtime,
      created: stats.birthtime,
      isSymlink: stats.isSymbolicLink()
    };
  } catch (error) {
    return null;
  }
};

// Browse directory
router.get('/browse', authenticateToken, async (req, res) => {
  try {
    const { path: requestedPath = '' } = req.query;
    const homeDir = await getUserHomeDir(req.user.id, req.user.tenant_id);
    const fullPath = validatePath(homeDir, requestedPath);
    
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(fullPath, entry.name);
        return await getFileStats(entryPath);
      })
    );
    
    res.json({
      currentPath: requestedPath,
      homePath: homeDir,
      files: files.filter(f => f !== null)
    });
    
  } catch (error) {
    console.error('Browse error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get file content (for text files)
router.get('/content', authenticateToken, async (req, res) => {
  try {
    const { path: requestedPath } = req.query;
    
    if (!requestedPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const homeDir = await getUserHomeDir(req.user.id, req.user.tenant_id);
    const fullPath = validatePath(homeDir, requestedPath);
    
    const content = await fs.readFile(fullPath, 'utf-8');
    const stats = await getFileStats(fullPath);
    
    res.json({
      content,
      stats
    });
    
  } catch (error) {
    console.error('Read file error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save file content
router.post('/content', authenticateToken, async (req, res) => {
  try {
    const { path: requestedPath, content } = req.body;
    
    if (!requestedPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const homeDir = await getUserHomeDir(req.user.id, req.user.tenant_id);
    const fullPath = validatePath(homeDir, requestedPath);
    
    await fs.writeFile(fullPath, content, 'utf-8');
    
    // Log activity
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'file_edited', JSON.stringify({ path: requestedPath })]
    );
    
    res.json({ message: 'File saved successfully' });
    
  } catch (error) {
    console.error('Save file error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload file(s)
router.post('/upload', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const { path: requestedPath = '' } = req.body;
    const homeDir = await getUserHomeDir(req.user.id, req.user.tenant_id);
    const targetDir = validatePath(homeDir, requestedPath);
    
    const uploadedFiles = [];
    
    for (const file of req.files) {
      const targetPath = path.join(targetDir, file.originalname);
      await fs.rename(file.path, targetPath);
      uploadedFiles.push(file.originalname);
    }
    
    // Log activity
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'files_uploaded', JSON.stringify({ path: requestedPath, files: uploadedFiles })]
    );
    
    res.json({ 
      message: 'Files uploaded successfully',
      files: uploadedFiles
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download file
router.get('/download', authenticateToken, async (req, res) => {
  try {
    const { path: requestedPath } = req.query;
    
    if (!requestedPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const homeDir = await getUserHomeDir(req.user.id, req.user.tenant_id);
    const fullPath = validatePath(homeDir, requestedPath);
    
    const stats = await fs.stat(fullPath);
    
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Cannot download directory. Use compress first.' });
    }
    
    const fileName = path.basename(fullPath);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    const fileStream = createReadStream(fullPath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create directory
router.post('/mkdir', authenticateToken, async (req, res) => {
  try {
    const { path: requestedPath, name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Directory name is required' });
    }
    
    const homeDir = await getUserHomeDir(req.user.id, req.user.tenant_id);
    const parentDir = validatePath(homeDir, requestedPath || '');
    const newDir = path.join(parentDir, name);
    
    await fs.mkdir(newDir, { recursive: false });
    
    // Log activity
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'directory_created', JSON.stringify({ path: path.join(requestedPath || '', name) })]
    );
    
    res.json({ message: 'Directory created successfully' });
    
  } catch (error) {
    console.error('Create directory error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete file or directory
router.delete('/delete', authenticateToken, async (req, res) => {
  try {
    const { path: requestedPath } = req.body;
    
    if (!requestedPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const homeDir = await getUserHomeDir(req.user.id, req.user.tenant_id);
    const fullPath = validatePath(homeDir, requestedPath);
    
    const stats = await fs.stat(fullPath);
    
    if (stats.isDirectory()) {
      await fs.rm(fullPath, { recursive: true, force: true });
    } else {
      await fs.unlink(fullPath);
    }
    
    // Log activity
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'file_deleted', JSON.stringify({ path: requestedPath })]
    );
    
    res.json({ message: 'Deleted successfully' });
    
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rename/move file or directory
router.post('/rename', authenticateToken, async (req, res) => {
  try {
    const { path: requestedPath, newName } = req.body;
    
    if (!requestedPath || !newName) {
      return res.status(400).json({ error: 'Path and new name are required' });
    }
    
    const homeDir = await getUserHomeDir(req.user.id, req.user.tenant_id);
    const oldPath = validatePath(homeDir, requestedPath);
    const parentDir = path.dirname(oldPath);
    const newPath = path.join(parentDir, newName);
    
    await fs.rename(oldPath, newPath);
    
    // Log activity
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'file_renamed', JSON.stringify({ from: requestedPath, to: newName })]
    );
    
    res.json({ message: 'Renamed successfully' });
    
  } catch (error) {
    console.error('Rename error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Change permissions
router.post('/chmod', authenticateToken, async (req, res) => {
  try {
    const { path: requestedPath, permissions } = req.body;
    
    if (!requestedPath || !permissions) {
      return res.status(400).json({ error: 'Path and permissions are required' });
    }
    
    const homeDir = await getUserHomeDir(req.user.id, req.user.tenant_id);
    const fullPath = validatePath(homeDir, requestedPath);
    
    const mode = parseInt(permissions, 8);
    await fs.chmod(fullPath, mode);
    
    // Log activity
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'permissions_changed', JSON.stringify({ path: requestedPath, permissions })]
    );
    
    res.json({ message: 'Permissions updated successfully' });
    
  } catch (error) {
    console.error('Chmod error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Compress files/directories
router.post('/compress', authenticateToken, async (req, res) => {
  try {
    const { paths, archiveName, format = 'zip' } = req.body;
    
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: 'Paths array is required' });
    }
    
    const homeDir = await getUserHomeDir(req.user.id, req.user.tenant_id);
    const archivePath = path.join(homeDir, archiveName || `archive_${Date.now()}.${format}`);
    
    const output = createWriteStream(archivePath);
    const archive = archiver(format === 'tar' ? 'tar' : 'zip', {
      gzip: format === 'tar.gz',
      zlib: { level: 9 }
    });
    
    archive.pipe(output);
    
    for (const requestedPath of paths) {
      const fullPath = validatePath(homeDir, requestedPath);
      const stats = await fs.stat(fullPath);
      const name = path.basename(fullPath);
      
      if (stats.isDirectory()) {
        archive.directory(fullPath, name);
      } else {
        archive.file(fullPath, { name });
      }
    }
    
    await archive.finalize();
    
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });
    
    // Log activity
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'files_compressed', JSON.stringify({ paths, archive: archiveName })]
    );
    
    res.json({ 
      message: 'Archive created successfully',
      path: path.basename(archivePath)
    });
    
  } catch (error) {
    console.error('Compress error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Extract archive
router.post('/extract', authenticateToken, async (req, res) => {
  try {
    const { path: requestedPath, destination } = req.body;
    
    if (!requestedPath) {
      return res.status(400).json({ error: 'Archive path is required' });
    }
    
    const homeDir = await getUserHomeDir(req.user.id, req.user.tenant_id);
    const archivePath = validatePath(homeDir, requestedPath);
    const extractPath = validatePath(homeDir, destination || path.dirname(requestedPath));
    
    const ext = path.extname(archivePath).toLowerCase();
    
    if (ext === '.zip') {
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(archivePath);
      zip.extractAllTo(extractPath, true);
    } else if (ext === '.tar' || ext === '.gz') {
      await pipeline(
        createReadStream(archivePath),
        ext === '.gz' ? createGunzip() : createReadStream(archivePath),
        extract({ cwd: extractPath })
      );
    } else {
      return res.status(400).json({ error: 'Unsupported archive format' });
    }
    
    // Log activity
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'archive_extracted', JSON.stringify({ archive: requestedPath, destination })]
    );
    
    res.json({ message: 'Archive extracted successfully' });
    
  } catch (error) {
    console.error('Extract error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search files
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { query, path: searchPath = '' } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const homeDir = await getUserHomeDir(req.user.id, req.user.tenant_id);
    const startPath = validatePath(homeDir, searchPath);
    
    const results = [];
    
    const searchDir = async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.name.toLowerCase().includes(query.toLowerCase())) {
          const stats = await getFileStats(fullPath);
          if (stats) {
            results.push(stats);
          }
        }
        
        if (entry.isDirectory() && results.length < 100) {
          try {
            await searchDir(fullPath);
          } catch (err) {
            // Skip directories we can't read
          }
        }
      }
    };
    
    await searchDir(startPath);
    
    res.json({ results: results.slice(0, 100) });
    
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
