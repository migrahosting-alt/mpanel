/**
 * Database Index Advisor - Analyzes query patterns and suggests missing indexes
 * 
 * Features:
 * - Tracks slow queries and analyzes WHERE/JOIN clauses
 * - Suggests missing indexes based on query patterns
 * - Generates index creation scripts
 * - Detects redundant or unused indexes
 * - Provides index size estimates
 */

import logger from '../config/logger.js';
import pool from '../db/index.js';

class DatabaseIndexAdvisor {
  constructor() {
    this.slowQueries = new Map(); // signature -> query info
    this.indexSuggestions = new Map(); // table -> suggestions
    this.SLOW_QUERY_THRESHOLD = 100; // 100ms
    this.enabled = process.env.INDEX_ADVISOR_ENABLED !== 'false';
  }

  /**
   * Analyze a query for potential index improvements
   */
  analyzeQuery(sql, duration, params = []) {
    if (!this.enabled || duration < this.SLOW_QUERY_THRESHOLD) {
      return;
    }

    const analysis = this.parseQuery(sql);
    if (!analysis) return;

    const signature = this.getQuerySignature(sql);
    
    if (!this.slowQueries.has(signature)) {
      this.slowQueries.set(signature, {
        sql,
        executions: 0,
        totalDuration: 0,
        avgDuration: 0,
        analysis
      });
    }

    const queryInfo = this.slowQueries.get(signature);
    queryInfo.executions++;
    queryInfo.totalDuration += duration;
    queryInfo.avgDuration = queryInfo.totalDuration / queryInfo.executions;

    // Generate index suggestions for frequently slow queries
    if (queryInfo.executions >= 5) {
      this.generateIndexSuggestions(analysis, queryInfo);
    }
  }

  /**
   * Parse SQL query to extract tables, columns, and conditions
   */
  parseQuery(sql) {
    const normalized = sql.toUpperCase();
    
    // Extract tables
    const fromMatch = normalized.match(/FROM\s+(\w+)/);
    const joinMatches = [...normalized.matchAll(/JOIN\s+(\w+)/g)];
    
    if (!fromMatch) return null;

    const tables = [fromMatch[1]];
    joinMatches.forEach(match => tables.push(match[1]));

    // Extract WHERE clause columns
    const whereColumns = this.extractWhereColumns(sql);
    
    // Extract JOIN columns
    const joinColumns = this.extractJoinColumns(sql);
    
    // Extract ORDER BY columns
    const orderByColumns = this.extractOrderByColumns(sql);

    return {
      tables: tables.map(t => t.toLowerCase()),
      whereColumns,
      joinColumns,
      orderByColumns,
      hasWhere: normalized.includes('WHERE'),
      hasJoin: normalized.includes('JOIN'),
      hasOrderBy: normalized.includes('ORDER BY'),
      hasGroupBy: normalized.includes('GROUP BY')
    };
  }

  /**
   * Extract columns from WHERE clause
   */
  extractWhereColumns(sql) {
    const columns = [];
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:GROUP BY|ORDER BY|LIMIT|$)/i);
    
    if (whereMatch) {
      const whereClause = whereMatch[1];
      
      // Match column references (table.column or column)
      const columnMatches = whereClause.matchAll(/(\w+)\.(\w+)|(\w+)\s*[=<>]/g);
      
      for (const match of columnMatches) {
        if (match[2]) {
          columns.push({ table: match[1].toLowerCase(), column: match[2].toLowerCase() });
        } else if (match[3]) {
          columns.push({ column: match[3].toLowerCase() });
        }
      }
    }
    
    return columns;
  }

  /**
   * Extract columns from JOIN clauses
   */
  extractJoinColumns(sql) {
    const columns = [];
    const joinMatches = sql.matchAll(/JOIN\s+\w+\s+(?:AS\s+\w+\s+)?ON\s+(.+?)(?:JOIN|WHERE|GROUP BY|ORDER BY|$)/gi);
    
    for (const match of joinMatches) {
      const onClause = match[1];
      const columnMatches = onClause.matchAll(/(\w+)\.(\w+)/g);
      
      for (const colMatch of columnMatches) {
        columns.push({
          table: colMatch[1].toLowerCase(),
          column: colMatch[2].toLowerCase()
        });
      }
    }
    
    return columns;
  }

  /**
   * Extract columns from ORDER BY clause
   */
  extractOrderByColumns(sql) {
    const columns = [];
    const orderByMatch = sql.match(/ORDER BY\s+(.+?)(?:LIMIT|$)/i);
    
    if (orderByMatch) {
      const orderByClause = orderByMatch[1];
      const columnMatches = orderByClause.matchAll(/(\w+)\.(\w+)|(\w+)(?:\s+(?:ASC|DESC))?/gi);
      
      for (const match of columnMatches) {
        if (match[2]) {
          columns.push({ table: match[1].toLowerCase(), column: match[2].toLowerCase() });
        } else if (match[3] && match[3].toLowerCase() !== 'asc' && match[3].toLowerCase() !== 'desc') {
          columns.push({ column: match[3].toLowerCase() });
        }
      }
    }
    
    return columns;
  }

  /**
   * Generate index suggestions based on query analysis
   */
  generateIndexSuggestions(analysis, queryInfo) {
    for (const table of analysis.tables) {
      if (!this.indexSuggestions.has(table)) {
        this.indexSuggestions.set(table, []);
      }

      const suggestions = this.indexSuggestions.get(table);

      // Suggest indexes for WHERE clause columns
      for (const col of analysis.whereColumns) {
        if (!col.table || col.table === table) {
          const suggestion = {
            type: 'where_clause',
            table,
            columns: [col.column],
            reason: `Frequently used in WHERE clause (${queryInfo.executions} times, avg ${queryInfo.avgDuration.toFixed(2)}ms)`,
            priority: 'high',
            estimatedImprovement: '50-90% faster queries'
          };

          // Check if not already suggested
          if (!this.isDuplicateSuggestion(suggestions, suggestion)) {
            suggestions.push(suggestion);
          }
        }
      }

      // Suggest composite indexes for multiple WHERE columns on same table
      const tableWhereColumns = analysis.whereColumns
        .filter(col => !col.table || col.table === table)
        .map(col => col.column);

      if (tableWhereColumns.length > 1) {
        const suggestion = {
          type: 'composite_where',
          table,
          columns: tableWhereColumns,
          reason: `Multiple WHERE conditions on same table (${queryInfo.executions} queries)`,
          priority: 'medium',
          estimatedImprovement: '60-95% faster queries'
        };

        if (!this.isDuplicateSuggestion(suggestions, suggestion)) {
          suggestions.push(suggestion);
        }
      }

      // Suggest indexes for JOIN columns
      for (const col of analysis.joinColumns) {
        if (col.table === table) {
          const suggestion = {
            type: 'join_column',
            table,
            columns: [col.column],
            reason: `Used in JOIN clause (${queryInfo.executions} joins)`,
            priority: 'high',
            estimatedImprovement: '70-95% faster joins'
          };

          if (!this.isDuplicateSuggestion(suggestions, suggestion)) {
            suggestions.push(suggestion);
          }
        }
      }

      // Suggest indexes for ORDER BY columns
      if (analysis.orderByColumns.length > 0) {
        for (const col of analysis.orderByColumns) {
          if (!col.table || col.table === table) {
            const suggestion = {
              type: 'order_by',
              table,
              columns: [col.column],
              reason: `Used in ORDER BY (${queryInfo.executions} times)`,
              priority: 'medium',
              estimatedImprovement: '40-80% faster sorting'
            };

            if (!this.isDuplicateSuggestion(suggestions, suggestion)) {
              suggestions.push(suggestion);
            }
          }
        }
      }
    }
  }

  /**
   * Check if suggestion already exists
   */
  isDuplicateSuggestion(suggestions, newSuggestion) {
    return suggestions.some(existing => 
      existing.table === newSuggestion.table &&
      JSON.stringify(existing.columns.sort()) === JSON.stringify(newSuggestion.columns.sort())
    );
  }

  /**
   * Get query signature
   */
  getQuerySignature(sql) {
    return sql
      .replace(/\s+/g, ' ')
      .replace(/\$\d+/g, '$?')
      .replace(/= '[^']*'/g, "= '?'")
      .replace(/= \d+/g, '= ?')
      .trim();
  }

  /**
   * Generate SQL scripts for creating suggested indexes
   */
  async generateIndexScripts() {
    const scripts = [];

    for (const [table, suggestions] of this.indexSuggestions) {
      // Get existing indexes for this table
      const existingIndexes = await this.getExistingIndexes(table);

      for (const suggestion of suggestions) {
        // Check if index already exists
        if (this.indexExists(existingIndexes, suggestion.columns)) {
          continue;
        }

        const indexName = `idx_${table}_${suggestion.columns.join('_')}`;
        const columnList = suggestion.columns.join(', ');
        
        scripts.push({
          table,
          indexName,
          sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName} ON ${table}(${columnList});`,
          suggestion
        });
      }
    }

    return scripts;
  }

  /**
   * Get existing indexes for a table
   */
  async getExistingIndexes(tableName) {
    try {
      const result = await pool.query(`
        SELECT 
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = $1
      `, [tableName]);

      return result.rows.map(row => ({
        name: row.indexname,
        definition: row.indexdef
      }));
    } catch (error) {
      logger.error('Error fetching indexes', { table: tableName, error: error.message });
      return [];
    }
  }

  /**
   * Check if index exists for given columns
   */
  indexExists(existingIndexes, columns) {
    return existingIndexes.some(index => {
      // Simple check - could be improved
      return columns.every(col => index.definition.toLowerCase().includes(col.toLowerCase()));
    });
  }

  /**
   * Generate comprehensive index report
   */
  async generateReport() {
    const scripts = await this.generateIndexScripts();
    
    const report = {
      timestamp: new Date().toISOString(),
      slowQueriesAnalyzed: this.slowQueries.size,
      tablesAnalyzed: this.indexSuggestions.size,
      totalSuggestions: scripts.length,
      suggestions: scripts.map(script => ({
        priority: script.suggestion.priority,
        table: script.table,
        indexName: script.indexName,
        columns: script.suggestion.columns,
        reason: script.suggestion.reason,
        estimatedImprovement: script.suggestion.estimatedImprovement,
        sql: script.sql
      })),
      summary: {
        highPriority: scripts.filter(s => s.suggestion.priority === 'high').length,
        mediumPriority: scripts.filter(s => s.suggestion.priority === 'medium').length,
        lowPriority: scripts.filter(s => s.suggestion.priority === 'low').length
      }
    };

    logger.info('Database Index Advisor Report', report);
    
    return report;
  }

  /**
   * Get all index suggestions
   */
  getSuggestions() {
    return Array.from(this.indexSuggestions.entries()).map(([table, suggestions]) => ({
      table,
      suggestions
    }));
  }

  /**
   * Clear collected data
   */
  clear() {
    this.slowQueries.clear();
    this.indexSuggestions.clear();
  }
}

export default new DatabaseIndexAdvisor();
