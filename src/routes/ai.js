import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import { authenticateToken } from '../middleware/auth.js';
import { resolveUserPath } from '../utils/fsSafe.js';
import pool from '../config/database.js';
import { env } from '../config/env.js';

const router = express.Router();

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

// AI: summarize recent activity for a domain
router.get('/domains/:id/summary', authenticateToken, async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({ success: false, error: 'AI not configured - OPENAI_API_KEY missing' });
    }

    const { id } = req.params;
    const { tenant_id } = req.user;

    const { rows } = await pool.query(
      `SELECT action, resource_type, details, created_at
       FROM activity_logs
       WHERE tenant_id = $1 AND resource_id = $2
       ORDER BY created_at DESC
       LIMIT 50`,
      [tenant_id, id]
    );

    const logLines = rows
      .map(
        (r) =>
          `${r.created_at.toISOString()} - ${r.action} ${r.resource_type} ${JSON.stringify(
            r.details
          )}`
      )
      .join('\n');

    const prompt = `
You are an assistant for a hosting control panel.
Given these recent activity logs for a domain, summarize the current state, highlight any risks (SSL, DNS, email, resource usage), and recommend 3 concrete next actions for the admin.

Logs:
${logLines || 'No logs yet'}
    `.trim();

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || 'No summary generated';

    res.json({ success: true, summary: content });
  } catch (err) {
    console.error('AI domain summary error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// AI: explain a file
router.post('/files/explain', authenticateToken, async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({ success: false, error: 'AI not configured - OPENAI_API_KEY missing' });
    }

    const userId = req.user.id;
    const { path: relPath, question } = req.body;

    if (!relPath) {
      return res.status(400).json({ success: false, error: 'path is required' });
    }

    const abs = resolveUserPath(userId, relPath);
    const ext = path.extname(abs);
    const content = await fs.readFile(abs, 'utf8');

    const prompt = `
You are an expert Linux hosting engineer.
Explain the following file to a junior admin. Then answer the user's specific question if present.

File path: ${relPath}
File type: ${ext}
Question (optional): ${question || 'None'}

File contents:
"""
${content.slice(0, 8000)}
"""
    `.trim();

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
    });

    const text = response.choices[0]?.message?.content || 'No answer generated';

    res.json({ success: true, answer: text });
  } catch (err) {
    console.error('AI file explain error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
