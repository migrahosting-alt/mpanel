/**
 * Knowledge Base Service
 * Manage help articles and documentation
 */

import pool from '../db/index.js';
import logger from '../utils/logger.js';

/**
 * Create article
 */
export async function createArticle(articleData) {
  const {
    tenantId,
    authorId,
    title,
    content,
    excerpt,
    categoryId,
    tags = [],
    status = 'draft',
    metaTitle,
    metaDescription,
  } = articleData;
  
  try {
    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    
    const result = await pool.query(
      `INSERT INTO kb_articles 
       (tenant_id, author_id, title, slug, content, excerpt, category_id, tags, status, meta_title, meta_description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [tenantId, authorId, title, slug, content, excerpt, categoryId, tags, status, metaTitle, metaDescription]
    );
    
    logger.info(`Created KB article: ${title}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Error creating KB article:', error);
    throw error;
  }
}

/**
 * Update article
 */
export async function updateArticle(articleId, updates) {
  const {
    title,
    content,
    excerpt,
    categoryId,
    tags,
    status,
    metaTitle,
    metaDescription,
  } = updates;
  
  try {
    const setClauses = [];
    const params = [];
    let paramIndex = 1;
    
    if (title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      params.push(title);
      
      // Update slug if title changes
      const slug = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      setClauses.push(`slug = $${paramIndex++}`);
      params.push(slug);
    }
    
    if (content !== undefined) {
      setClauses.push(`content = $${paramIndex++}`);
      params.push(content);
    }
    
    if (excerpt !== undefined) {
      setClauses.push(`excerpt = $${paramIndex++}`);
      params.push(excerpt);
    }
    
    if (categoryId !== undefined) {
      setClauses.push(`category_id = $${paramIndex++}`);
      params.push(categoryId);
    }
    
    if (tags !== undefined) {
      setClauses.push(`tags = $${paramIndex++}`);
      params.push(tags);
    }
    
    if (status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(status);
      
      if (status === 'published') {
        setClauses.push(`published_at = COALESCE(published_at, NOW())`);
      }
    }
    
    if (metaTitle !== undefined) {
      setClauses.push(`meta_title = $${paramIndex++}`);
      params.push(metaTitle);
    }
    
    if (metaDescription !== undefined) {
      setClauses.push(`meta_description = $${paramIndex++}`);
      params.push(metaDescription);
    }
    
    params.push(articleId);
    
    const result = await pool.query(
      `UPDATE kb_articles 
       SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );
    
    logger.info(`Updated KB article: ${articleId}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Error updating KB article:', error);
    throw error;
  }
}

/**
 * Get article by ID or slug
 */
export async function getArticle(identifier) {
  try {
    // Check if UUID or slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    
    const result = await pool.query(
      `SELECT * FROM kb_articles WHERE ${isUUID ? 'id' : 'slug'} = $1`,
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    // Increment view count
    await pool.query(
      'UPDATE kb_articles SET views = views + 1 WHERE id = $1',
      [result.rows[0].id]
    );
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error getting KB article:', error);
    throw error;
  }
}

/**
 * Search articles
 */
export async function searchArticles(query, filters = {}) {
  const { tenantId, status = 'published', limit = 20, offset = 0 } = filters;
  
  try {
    const conditions = ['status = $1'];
    const params = [status];
    let paramIndex = 2;
    
    if (tenantId) {
      conditions.push(`tenant_id = $${paramIndex++}`);
      params.push(tenantId);
    }
    
    if (query) {
      conditions.push(`search_vector @@ plainto_tsquery('english', $${paramIndex++})`);
      params.push(query);
    }
    
    const result = await pool.query(
      `SELECT *, ts_rank(search_vector, plainto_tsquery('english', $${query ? paramIndex - 1 : 'NULL'})) as rank
       FROM kb_articles
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${query ? 'rank DESC,' : ''} published_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );
    
    return result.rows;
  } catch (error) {
    logger.error('Error searching KB articles:', error);
    throw error;
  }
}

/**
 * Vote on article helpfulness
 */
export async function voteArticle(articleId, helpful) {
  try {
    const field = helpful ? 'helpful_votes' : 'unhelpful_votes';
    
    await pool.query(
      `UPDATE kb_articles SET ${field} = ${field} + 1 WHERE id = $1`,
      [articleId]
    );
    
    logger.debug(`Recorded ${helpful ? 'helpful' : 'unhelpful'} vote for article ${articleId}`);
    return { success: true };
  } catch (error) {
    logger.error('Error voting on article:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get popular articles
 */
export async function getPopularArticles(tenantId, limit = 10) {
  try {
    const result = await pool.query(
      `SELECT * FROM kb_articles
       WHERE status = 'published' AND tenant_id = $1
       ORDER BY views DESC, helpful_votes DESC
       LIMIT $2`,
      [tenantId, limit]
    );
    
    return result.rows;
  } catch (error) {
    logger.error('Error getting popular articles:', error);
    throw error;
  }
}

/**
 * Get articles by tag
 */
export async function getArticlesByTag(tag, tenantId) {
  try {
    const result = await pool.query(
      `SELECT * FROM kb_articles
       WHERE status = 'published' 
         AND tenant_id = $1
         AND $2 = ANY(tags)
       ORDER BY published_at DESC`,
      [tenantId, tag]
    );
    
    return result.rows;
  } catch (error) {
    logger.error('Error getting articles by tag:', error);
    throw error;
  }
}

/**
 * Get KB statistics
 */
export async function getKBStats(tenantId) {
  try {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_articles,
        COUNT(*) FILTER (WHERE status = 'published') as published_articles,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_articles,
        SUM(views) as total_views,
        SUM(helpful_votes) as total_helpful_votes,
        SUM(unhelpful_votes) as total_unhelpful_votes,
        AVG(CAST(helpful_votes AS FLOAT) / NULLIF(helpful_votes + unhelpful_votes, 0)) as avg_helpfulness
       FROM kb_articles
       WHERE tenant_id = $1`,
      [tenantId]
    );
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error getting KB stats:', error);
    throw error;
  }
}

export default {
  createArticle,
  updateArticle,
  getArticle,
  searchArticles,
  voteArticle,
  getPopularArticles,
  getArticlesByTag,
  getKBStats,
};
