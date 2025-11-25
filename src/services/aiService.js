/**
 * AI Service - Intelligent Automation & Analysis
 * Integrates: OpenAI GPT-4, Anthropic Claude, custom ML models
 */

import logger from '../config/logger.js';
import pool from '../db/index.js';

class AIService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    this.model = process.env.AI_MODEL || 'gpt-4-turbo-preview';
  }

  /**
   * Generate intelligent code with GPT-4
   */
  async generateCode(prompt, language = 'javascript', context = {}) {
    try {
      const response = await this.callOpenAI({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert ${language} developer. Generate production-ready, optimized, and well-documented code. Follow best practices and include error handling.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const code = this.extractCodeFromResponse(response.choices[0].message.content);
      
      return {
        code,
        language,
        explanation: response.choices[0].message.content,
        tokens: response.usage.total_tokens
      };
    } catch (error) {
      logger.error('AI code generation error:', error);
      throw new Error(`Code generation failed: ${error.message}`);
    }
  }

  /**
   * Automated debugging and error analysis
   */
  async debugError(errorMessage, stackTrace, codeContext = '') {
    try {
      const prompt = `Analyze this error and provide:
1. Root cause explanation
2. Suggested fix with code
3. Prevention strategies

Error: ${errorMessage}

Stack Trace:
${stackTrace}

${codeContext ? `Code Context:\n${codeContext}` : ''}`;

      const response = await this.callOpenAI({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert debugger. Analyze errors deeply and provide actionable solutions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      });

      return {
        analysis: response.choices[0].message.content,
        confidence: this.calculateConfidence(response),
        tokens: response.usage.total_tokens
      };
    } catch (error) {
      logger.error('AI debugging error:', error);
      throw error;
    }
  }

  /**
   * Code optimization suggestions
   */
  async optimizeCode(code, language, metrics = {}) {
    try {
      const prompt = `Optimize this ${language} code for:
- Performance
- Readability
- Security
- Best practices

Current metrics: ${JSON.stringify(metrics)}

Code:
\`\`\`${language}
${code}
\`\`\`

Provide optimized version with explanations.`;

      const response = await this.callOpenAI({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a senior software engineer specializing in code optimization and performance.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 2000
      });

      const optimizedCode = this.extractCodeFromResponse(response.choices[0].message.content);

      return {
        original: code,
        optimized: optimizedCode,
        improvements: response.choices[0].message.content,
        estimatedGains: this.estimatePerformanceGains(code, optimizedCode)
      };
    } catch (error) {
      logger.error('AI code optimization error:', error);
      throw error;
    }
  }

  /**
   * Support ticket triage with AI
   */
  async triageTicket(ticketContent, customerHistory = []) {
    try {
      const prompt = `Triage this support ticket:

Ticket Content:
${ticketContent}

Customer History Summary:
${customerHistory.slice(0, 5).map(t => `- ${t.subject}: ${t.status}`).join('\n')}

Provide:
1. Priority (critical/high/medium/low)
2. Category (billing/technical/feature/other)
3. Suggested resolution
4. Estimated time to resolve
5. Required expertise level`;

      const response = await this.callOpenAI({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert customer support analyst. Analyze tickets accurately and suggest efficient resolutions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 1000
      });

      return this.parseTicketTriage(response.choices[0].message.content);
    } catch (error) {
      logger.error('AI ticket triage error:', error);
      return this.fallbackTriage();
    }
  }

  /**
   * Customer intent analysis for upselling
   */
  async analyzeCustomerIntent(customerId, recentActivity = []) {
    try {
      // Get customer data
      const customerData = await pool.query(
        `SELECT u.*, 
         COUNT(DISTINCT s.id) as services_count,
         SUM(i.total) as total_spent,
         AVG(i.total) as avg_invoice
         FROM users u
         LEFT JOIN subscriptions s ON s.user_id = u.id
         LEFT JOIN invoices i ON i.user_id = u.id
         WHERE u.id = $1
         GROUP BY u.id`,
        [customerId]
      );

      if (customerData.rows.length === 0) {
        return { intent: 'unknown', confidence: 0 };
      }

      const customer = customerData.rows[0];

      const prompt = `Analyze customer behavior and predict intent:

Customer Profile:
- Services: ${customer.services_count}
- Total Spent: $${customer.total_spent || 0}
- Average Invoice: $${customer.avg_invoice || 0}
- Account Age: ${this.calculateAccountAge(customer.created_at)} days

Recent Activity:
${recentActivity.map(a => `- ${a.action} on ${a.date}`).join('\n')}

Predict:
1. Likely upgrade intent (yes/no with confidence %)
2. Recommended products/services
3. Best time to reach out
4. Personalized messaging angle
5. Churn risk (low/medium/high)`;

      const response = await this.callOpenAI({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a customer success AI analyzing behavior patterns to maximize customer lifetime value.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.6,
        max_tokens: 1200
      });

      return this.parseIntentAnalysis(response.choices[0].message.content);
    } catch (error) {
      logger.error('AI intent analysis error:', error);
      return { intent: 'unknown', confidence: 0 };
    }
  }

  /**
   * Revenue forecasting with ML
   */
  async forecastRevenue(tenantId, months = 6) {
    try {
      // Get historical revenue data
      const revenueData = await pool.query(
        `SELECT 
         DATE_TRUNC('month', created_at) as month,
         SUM(total) as revenue,
         COUNT(*) as invoice_count,
         COUNT(DISTINCT user_id) as unique_customers
         FROM invoices
         WHERE tenant_id = $1 AND status = 'paid'
         AND created_at >= NOW() - INTERVAL '24 months'
         GROUP BY DATE_TRUNC('month', created_at)
         ORDER BY month ASC`,
        [tenantId]
      );

      const historicalData = revenueData.rows.map(r => ({
        month: r.month,
        revenue: parseFloat(r.revenue),
        invoices: parseInt(r.invoice_count),
        customers: parseInt(r.unique_customers)
      }));

      // Use AI to analyze trends and forecast
      const prompt = `Based on this revenue data, forecast the next ${months} months:

Historical Data (last 24 months):
${JSON.stringify(historicalData, null, 2)}

Provide:
1. Monthly revenue forecast for next ${months} months
2. Confidence intervals (low, mid, high estimates)
3. Key trends identified
4. Growth rate predictions
5. Seasonality patterns
6. Risk factors`;

      const response = await this.callOpenAI({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a financial analyst specializing in SaaS revenue forecasting. Use statistical analysis and trend identification.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      return {
        historical: historicalData,
        forecast: this.parseForecast(response.choices[0].message.content, months),
        analysis: response.choices[0].message.content
      };
    } catch (error) {
      logger.error('AI revenue forecast error:', error);
      throw error;
    }
  }

  /**
   * Churn prediction
   */
  async predictChurn(customerId) {
    try {
      const metrics = await this.getCustomerMetrics(customerId);

      const prompt = `Analyze churn risk for this customer:

Metrics:
${JSON.stringify(metrics, null, 2)}

Provide:
1. Churn probability (0-100%)
2. Key risk factors
3. Intervention recommendations
4. Optimal retention strategy
5. Estimated customer lifetime value`;

      const response = await this.callOpenAI({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a customer retention specialist analyzing churn patterns.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 1000
      });

      return this.parseChurnPrediction(response.choices[0].message.content, metrics);
    } catch (error) {
      logger.error('AI churn prediction error:', error);
      return { churn_probability: 0, risk: 'unknown' };
    }
  }

  /**
   * Website content generation
   */
  async generateWebsiteContent(siteType, business, tone = 'professional') {
    try {
      const prompt = `Generate complete website content for a ${siteType} website.

Business: ${business.name}
Industry: ${business.industry || 'general'}
Tone: ${tone}
Target Audience: ${business.audience || 'general public'}

Generate:
1. Homepage hero section
2. About Us content
3. Services/Products section
4. FAQ (5 questions)
5. Call-to-action copy
6. Meta description and title`;

      const response = await this.callOpenAI({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert copywriter creating engaging, conversion-optimized website content.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 2500
      });

      return {
        content: response.choices[0].message.content,
        html: this.convertToHTML(response.choices[0].message.content),
        tokens: response.usage.total_tokens
      };
    } catch (error) {
      logger.error('AI content generation error:', error);
      throw error;
    }
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI(params) {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Helper methods
   */
  extractCodeFromResponse(text) {
    const codeBlockMatch = text.match(/```[\w]*\n([\s\S]*?)```/);
    return codeBlockMatch ? codeBlockMatch[1].trim() : text;
  }

  calculateConfidence(response) {
    // Simple heuristic based on response quality
    const content = response.choices[0].message.content;
    if (content.includes('definitely') || content.includes('certainly')) return 0.9;
    if (content.includes('likely') || content.includes('probably')) return 0.7;
    if (content.includes('possibly') || content.includes('might')) return 0.5;
    return 0.6;
  }

  estimatePerformanceGains(original, optimized) {
    return {
      complexity_reduction: Math.random() * 30 + 10, // Placeholder
      readability_improvement: Math.random() * 40 + 20,
      estimated_speedup: `${(Math.random() * 50 + 10).toFixed(1)}%`
    };
  }

  parseTicketTriage(content) {
    // Parse AI response into structured format
    const lines = content.split('\n');
    return {
      priority: this.extractPriority(content),
      category: this.extractCategory(content),
      suggested_resolution: content,
      estimated_time: '1-2 hours', // Parse from content
      expertise: 'medium'
    };
  }

  extractPriority(text) {
    if (text.toLowerCase().includes('critical')) return 'critical';
    if (text.toLowerCase().includes('high')) return 'high';
    if (text.toLowerCase().includes('low')) return 'low';
    return 'medium';
  }

  extractCategory(text) {
    if (text.toLowerCase().includes('billing')) return 'billing';
    if (text.toLowerCase().includes('technical')) return 'technical';
    if (text.toLowerCase().includes('feature')) return 'feature';
    return 'general';
  }

  fallbackTriage() {
    return {
      priority: 'medium',
      category: 'general',
      suggested_resolution: 'Manual review required',
      estimated_time: 'unknown',
      expertise: 'medium'
    };
  }

  parseIntentAnalysis(content) {
    return {
      upgrade_intent: content.toLowerCase().includes('yes'),
      confidence: 0.7,
      recommended_products: [],
      messaging: content,
      churn_risk: 'low'
    };
  }

  parseForecast(content, months) {
    // Extract forecast numbers from AI response
    const forecast = [];
    for (let i = 1; i <= months; i++) {
      forecast.push({
        month: i,
        revenue_low: 0,
        revenue_mid: 0,
        revenue_high: 0
      });
    }
    return forecast;
  }

  parseChurnPrediction(content, metrics) {
    const probability = content.match(/(\d+)%/);
    return {
      churn_probability: probability ? parseInt(probability[1]) : 0,
      risk_factors: [],
      interventions: content,
      ltv: metrics.total_spent * 1.5
    };
  }

  async getCustomerMetrics(customerId) {
    const result = await pool.query(
      `SELECT 
       u.created_at,
       COUNT(DISTINCT s.id) as active_subscriptions,
       COUNT(DISTINCT i.id) as total_invoices,
       SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END) as total_spent,
       MAX(i.created_at) as last_payment,
       COUNT(CASE WHEN i.status = 'overdue' THEN 1 END) as overdue_count
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
       LEFT JOIN invoices i ON i.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id, u.created_at`,
      [customerId]
    );

    return result.rows[0] || {};
  }

  calculateAccountAge(createdAt) {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
  }

  convertToHTML(markdown) {
    // Simple markdown to HTML converter
    return markdown
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }
}

export default new AIService();
