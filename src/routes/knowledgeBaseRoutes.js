/**
 * Knowledge Base Routes
 * Self-service help articles
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';
import kb from '../services/knowledgeBaseService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/kb/articles
 * Search articles (public endpoint)
 */
router.get('/articles', async (req, res) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query;
    const articles = await kb.searchArticles(q, { 
      status: 'published',
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({ data: articles });
  } catch (error) {
    logger.error('Error searching articles:', error);
    res.status(500).json({ error: 'Failed to search articles' });
  }
});

/**
 * GET /api/kb/articles/:slug
 * Get article by slug (public endpoint)
 */
router.get('/articles/:slug', async (req, res) => {
  try {
    const article = await kb.getArticle(req.params.slug);
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    if (article.status !== 'published') {
      return res.status(404).json({ error: 'Article not available' });
    }
    
    res.json({ data: article });
  } catch (error) {
    logger.error('Error getting article:', error);
    res.status(500).json({ error: 'Failed to get article' });
  }
});

/**
 * POST /api/kb/articles/:id/vote
 * Vote on article helpfulness (public endpoint)
 */
router.post('/articles/:id/vote', async (req, res) => {
  try {
    const { helpful } = req.body;
    
    if (helpful === undefined) {
      return res.status(400).json({ error: 'helpful field is required' });
    }
    
    const result = await kb.voteArticle(req.params.id, helpful);
    
    if (result.success) {
      res.json({ message: 'Thank you for your feedback!' });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Error voting on article:', error);
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});

/**
 * GET /api/kb/popular
 * Get popular articles (public endpoint)
 */
router.get('/popular', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const articles = await kb.getPopularArticles(null, parseInt(limit));
    
    res.json({ data: articles });
  } catch (error) {
    logger.error('Error getting popular articles:', error);
    res.status(500).json({ error: 'Failed to get popular articles' });
  }
});

/**
 * GET /api/kb/tags/:tag
 * Get articles by tag (public endpoint)
 */
router.get('/tags/:tag', async (req, res) => {
  try {
    const articles = await kb.getArticlesByTag(req.params.tag, null);
    res.json({ data: articles });
  } catch (error) {
    logger.error('Error getting articles by tag:', error);
    res.status(500).json({ error: 'Failed to get articles' });
  }
});

/**
 * GET /api/admin/kb/articles
 * Get all articles including drafts (admin)
 */
router.get('/admin/articles', authenticateToken, requirePermission('kb.read'), async (req, res) => {
  try {
    const { status, limit = 100, offset = 0 } = req.query;
    
    const articles = await kb.searchArticles('', {
      tenantId: req.user.tenantId,
      status: status || undefined,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({ data: articles });
  } catch (error) {
    logger.error('Error getting articles:', error);
    res.status(500).json({ error: 'Failed to get articles' });
  }
});

/**
 * POST /api/admin/kb/articles
 * Create article (admin)
 */
router.post('/admin/articles', authenticateToken, requirePermission('kb.create'), async (req, res) => {
  try {
    const article = await kb.createArticle({
      ...req.body,
      tenantId: req.user.tenantId,
      authorId: req.user.id,
    });
    
    res.status(201).json({ 
      data: article, 
      message: 'Article created successfully' 
    });
  } catch (error) {
    logger.error('Error creating article:', error);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

/**
 * PUT /api/admin/kb/articles/:id
 * Update article (admin)
 */
router.put('/admin/articles/:id', authenticateToken, requirePermission('kb.update'), async (req, res) => {
  try {
    const article = await kb.updateArticle(req.params.id, req.body);
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    res.json({ 
      data: article, 
      message: 'Article updated successfully' 
    });
  } catch (error) {
    logger.error('Error updating article:', error);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

/**
 * GET /api/admin/kb/stats
 * Get KB statistics (admin)
 */
router.get('/admin/stats', authenticateToken, requirePermission('kb.read'), async (req, res) => {
  try {
    const stats = await kb.getKBStats(req.user.tenantId);
    res.json({ data: stats });
  } catch (error) {
    logger.error('Error getting KB stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

export default router;
