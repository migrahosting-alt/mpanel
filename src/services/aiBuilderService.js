import db from '../db/index.js';
import logger from '../config/logger.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * AI Website Builder Service
 * Automated website creation using AI/templates
 */
class AIBuilderService {
  constructor() {
    this.templates = {
      business: {
        name: 'Business Website',
        pages: ['home', 'about', 'services', 'contact'],
        sections: ['hero', 'features', 'testimonials', 'cta', 'footer'],
        colorSchemes: ['professional', 'modern', 'vibrant']
      },
      ecommerce: {
        name: 'E-Commerce Store',
        pages: ['home', 'shop', 'product', 'cart', 'checkout', 'account'],
        sections: ['hero', 'featured-products', 'categories', 'newsletter'],
        colorSchemes: ['retail', 'luxury', 'minimalist']
      },
      portfolio: {
        name: 'Portfolio',
        pages: ['home', 'portfolio', 'about', 'contact'],
        sections: ['hero', 'gallery', 'skills', 'contact-form'],
        colorSchemes: ['creative', 'dark', 'bright']
      },
      blog: {
        name: 'Blog',
        pages: ['home', 'blog', 'post', 'about', 'contact'],
        sections: ['hero', 'recent-posts', 'categories', 'author-bio'],
        colorSchemes: ['minimal', 'magazine', 'elegant']
      },
      landing: {
        name: 'Landing Page',
        pages: ['index'],
        sections: ['hero', 'features', 'pricing', 'testimonials', 'cta', 'faq'],
        colorSchemes: ['conversion', 'startup', 'saas']
      },
      restaurant: {
        name: 'Restaurant',
        pages: ['home', 'menu', 'reservations', 'gallery', 'contact'],
        sections: ['hero', 'menu-showcase', 'location', 'hours'],
        colorSchemes: ['food', 'elegant', 'rustic']
      }
    };

    this.colorSchemes = {
      professional: {
        primary: '#1e40af',
        secondary: '#64748b',
        accent: '#f59e0b',
        background: '#ffffff',
        text: '#1f2937'
      },
      modern: {
        primary: '#6366f1',
        secondary: '#8b5cf6',
        accent: '#ec4899',
        background: '#f9fafb',
        text: '#111827'
      },
      creative: {
        primary: '#f59e0b',
        secondary: '#ef4444',
        accent: '#10b981',
        background: '#fef3c7',
        text: '#78350f'
      },
      minimal: {
        primary: '#000000',
        secondary: '#6b7280',
        accent: '#ffffff',
        background: '#ffffff',
        text: '#1f2937'
      }
    };

    // AI generation settings (would integrate with OpenAI/Claude in production)
    this.aiConfig = {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000
    };
  }

  /**
   * Create website using AI
   * @param {Object} config - AI builder configuration
   * @returns {Promise<Object>} Generated website
   */
  async createWebsite(config) {
    try {
      const {
        websiteId,
        businessType,
        businessName,
        businessDescription,
        template,
        colorScheme,
        features = [],
        language = 'en'
      } = config;

      logger.info(`Creating AI website for ${businessName}`);

      // Validate template
      if (!this.templates[template]) {
        throw new Error(`Template ${template} not found`);
      }

      // Create AI builder project
      const projectQuery = `
        INSERT INTO ai_builder_projects (
          website_id,
          business_type,
          business_name,
          business_description,
          template,
          color_scheme,
          features,
          language,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *
      `;

      const projectResult = await db.query(projectQuery, [
        websiteId,
        businessType,
        businessName,
        businessDescription,
        template,
        colorScheme,
        JSON.stringify(features),
        language,
        'generating'
      ]);

      const projectId = projectResult.rows[0].id;
      const selectedTemplate = this.templates[template];

      // Generate content for each page
      const pages = [];
      for (const pageName of selectedTemplate.pages) {
        const pageContent = await this.generatePageContent({
          pageName,
          businessName,
          businessDescription,
          businessType,
          template,
          language
        });

        pages.push({
          name: pageName,
          title: pageContent.title,
          content: pageContent.html,
          meta: pageContent.meta
        });
      }

      // Generate CSS with selected color scheme
      const css = this.generateCSS(colorScheme || 'professional');

      // Save generated pages
      for (const page of pages) {
        await db.query(
          `INSERT INTO ai_generated_pages (project_id, page_name, title, content, meta, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [projectId, page.name, page.title, page.content, JSON.stringify(page.meta)]
        );
      }

      // Save CSS
      await db.query(
        `UPDATE ai_builder_projects SET generated_css = $1 WHERE id = $2`,
        [css, projectId]
      );

      // Update project status
      await db.query(
        `UPDATE ai_builder_projects SET status = $1, generated_at = NOW() WHERE id = $2`,
        ['completed', projectId]
      );

      logger.info(`AI website generated successfully for project ${projectId}`);

      return {
        success: true,
        projectId,
        pages: pages.map(p => ({ name: p.name, title: p.title })),
        colorScheme: this.colorSchemes[colorScheme || 'professional'],
        previewUrl: `/preview/${projectId}`
      };
    } catch (error) {
      logger.error('Error creating AI website:', error);
      throw new Error(`Failed to create AI website: ${error.message}`);
    }
  }

  /**
   * Generate content for a page using AI
   * @private
   */
  async generatePageContent(config) {
    const { pageName, businessName, businessDescription, businessType, template, language } = config;

    // In production, this would call OpenAI API
    // For now, return template-based content

    const content = {
      home: {
        title: `${businessName} - Home`,
        meta: {
          description: businessDescription || `Welcome to ${businessName}`,
          keywords: `${businessType}, ${businessName}, professional services`
        },
        html: this.generateHomePageHTML(businessName, businessDescription, template)
      },
      about: {
        title: `About ${businessName}`,
        meta: {
          description: `Learn more about ${businessName} and our mission`,
          keywords: `about, ${businessName}, company info`
        },
        html: this.generateAboutPageHTML(businessName, businessDescription)
      },
      services: {
        title: `Our Services - ${businessName}`,
        meta: {
          description: `Explore the services offered by ${businessName}`,
          keywords: `services, ${businessType}, ${businessName}`
        },
        html: this.generateServicesPageHTML(businessName, businessType)
      },
      contact: {
        title: `Contact ${businessName}`,
        meta: {
          description: `Get in touch with ${businessName}`,
          keywords: `contact, ${businessName}, reach us`
        },
        html: this.generateContactPageHTML(businessName)
      },
      portfolio: {
        title: `Portfolio - ${businessName}`,
        meta: {
          description: `View our portfolio of work at ${businessName}`,
          keywords: `portfolio, work, projects, ${businessName}`
        },
        html: this.generatePortfolioPageHTML(businessName)
      },
      blog: {
        title: `Blog - ${businessName}`,
        meta: {
          description: `Read our latest articles and insights`,
          keywords: `blog, articles, news, ${businessName}`
        },
        html: this.generateBlogPageHTML(businessName)
      }
    };

    return content[pageName] || content.home;
  }

  /**
   * Generate home page HTML
   * @private
   */
  generateHomePageHTML(businessName, businessDescription, template) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${businessName}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <!-- Header -->
  <header class="header">
    <div class="container">
      <div class="logo">${businessName}</div>
      <nav class="nav">
        <a href="index.html">Home</a>
        <a href="about.html">About</a>
        <a href="services.html">Services</a>
        <a href="contact.html">Contact</a>
      </nav>
    </div>
  </header>

  <!-- Hero Section -->
  <section class="hero">
    <div class="container">
      <h1>${businessName}</h1>
      <p class="hero-description">${businessDescription || 'Your trusted partner for professional services'}</p>
      <div class="hero-actions">
        <a href="contact.html" class="btn btn-primary">Get Started</a>
        <a href="about.html" class="btn btn-secondary">Learn More</a>
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section class="features">
    <div class="container">
      <h2>Why Choose Us</h2>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">🚀</div>
          <h3>Fast & Reliable</h3>
          <p>We deliver quality results quickly and efficiently</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">💎</div>
          <h3>Premium Quality</h3>
          <p>Excellence in everything we do</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🎯</div>
          <h3>Customer Focused</h3>
          <p>Your success is our priority</p>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA Section -->
  <section class="cta">
    <div class="container">
      <h2>Ready to Get Started?</h2>
      <p>Contact us today and let's discuss your project</p>
      <a href="contact.html" class="btn btn-primary">Contact Us</a>
    </div>
  </section>

  <!-- Footer -->
  <footer class="footer">
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>`;
  }

  /**
   * Generate about page HTML
   * @private
   */
  generateAboutPageHTML(businessName, businessDescription) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>About - ${businessName}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="header">
    <div class="container">
      <div class="logo">${businessName}</div>
      <nav class="nav">
        <a href="index.html">Home</a>
        <a href="about.html">About</a>
        <a href="services.html">Services</a>
        <a href="contact.html">Contact</a>
      </nav>
    </div>
  </header>

  <section class="page-content">
    <div class="container">
      <h1>About ${businessName}</h1>
      <p>${businessDescription || 'We are a professional company dedicated to excellence.'}</p>
      
      <h2>Our Mission</h2>
      <p>To provide exceptional service and value to our customers through innovation and dedication.</p>
      
      <h2>Our Values</h2>
      <ul>
        <li>Integrity in all we do</li>
        <li>Customer satisfaction</li>
        <li>Continuous improvement</li>
        <li>Teamwork and collaboration</li>
      </ul>
    </div>
  </section>

  <footer class="footer">
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>`;
  }

  /**
   * Generate services page HTML
   * @private
   */
  generateServicesPageHTML(businessName, businessType) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Services - ${businessName}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="header">
    <div class="container">
      <div class="logo">${businessName}</div>
      <nav class="nav">
        <a href="index.html">Home</a>
        <a href="about.html">About</a>
        <a href="services.html">Services</a>
        <a href="contact.html">Contact</a>
      </nav>
    </div>
  </header>

  <section class="page-content">
    <div class="container">
      <h1>Our Services</h1>
      <p>We offer a comprehensive range of ${businessType} services tailored to your needs.</p>
      
      <div class="services-grid">
        <div class="service-card">
          <h3>Service One</h3>
          <p>Professional and reliable solutions</p>
        </div>
        <div class="service-card">
          <h3>Service Two</h3>
          <p>Expert consultation and support</p>
        </div>
        <div class="service-card">
          <h3>Service Three</h3>
          <p>Custom solutions for your business</p>
        </div>
      </div>
    </div>
  </section>

  <footer class="footer">
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>`;
  }

  /**
   * Generate contact page HTML
   * @private
   */
  generateContactPageHTML(businessName) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contact - ${businessName}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="header">
    <div class="container">
      <div class="logo">${businessName}</div>
      <nav class="nav">
        <a href="index.html">Home</a>
        <a href="about.html">About</a>
        <a href="services.html">Services</a>
        <a href="contact.html">Contact</a>
      </nav>
    </div>
  </header>

  <section class="page-content">
    <div class="container">
      <h1>Contact Us</h1>
      <p>Get in touch with us - we'd love to hear from you!</p>
      
      <form class="contact-form">
        <div class="form-group">
          <label for="name">Name</label>
          <input type="text" id="name" name="name" required>
        </div>
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required>
        </div>
        <div class="form-group">
          <label for="message">Message</label>
          <textarea id="message" name="message" rows="5" required></textarea>
        </div>
        <button type="submit" class="btn btn-primary">Send Message</button>
      </form>
    </div>
  </section>

  <footer class="footer">
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>`;
  }

  /**
   * Generate portfolio page HTML
   * @private
   */
  generatePortfolioPageHTML(businessName) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portfolio - ${businessName}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="header">
    <div class="container">
      <div class="logo">${businessName}</div>
      <nav class="nav">
        <a href="index.html">Home</a>
        <a href="portfolio.html">Portfolio</a>
        <a href="about.html">About</a>
        <a href="contact.html">Contact</a>
      </nav>
    </div>
  </header>

  <section class="page-content">
    <div class="container">
      <h1>Our Portfolio</h1>
      <p>Check out some of our recent work</p>
      
      <div class="portfolio-grid">
        <div class="portfolio-item">
          <img src="https://via.placeholder.com/400x300" alt="Project 1">
          <h3>Project One</h3>
          <p>A successful project for a valued client</p>
        </div>
        <div class="portfolio-item">
          <img src="https://via.placeholder.com/400x300" alt="Project 2">
          <h3>Project Two</h3>
          <p>Innovative solutions delivered on time</p>
        </div>
        <div class="portfolio-item">
          <img src="https://via.placeholder.com/400x300" alt="Project 3">
          <h3>Project Three</h3>
          <p>Exceptional results for our customer</p>
        </div>
      </div>
    </div>
  </section>

  <footer class="footer">
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>`;
  }

  /**
   * Generate blog page HTML
   * @private
   */
  generateBlogPageHTML(businessName) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog - ${businessName}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="header">
    <div class="container">
      <div class="logo">${businessName}</div>
      <nav class="nav">
        <a href="index.html">Home</a>
        <a href="blog.html">Blog</a>
        <a href="about.html">About</a>
        <a href="contact.html">Contact</a>
      </nav>
    </div>
  </header>

  <section class="page-content">
    <div class="container">
      <h1>Our Blog</h1>
      <p>Read our latest articles and insights</p>
      
      <div class="blog-grid">
        <article class="blog-post">
          <h2>Welcome to Our Blog</h2>
          <p class="post-meta">Posted on ${new Date().toLocaleDateString()}</p>
          <p>We're excited to share insights and updates with you...</p>
          <a href="#" class="read-more">Read More →</a>
        </article>
      </div>
    </div>
  </section>

  <footer class="footer">
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>`;
  }

  /**
   * Generate CSS with color scheme
   * @private
   */
  generateCSS(schemeName) {
    const scheme = this.colorSchemes[schemeName] || this.colorSchemes.professional;

    return `
/* Reset & Base Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  color: ${scheme.text};
  background-color: ${scheme.background};
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Header */
.header {
  background: ${scheme.primary};
  color: white;
  padding: 1rem 0;
  position: sticky;
  top: 0;
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.header .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 1.5rem;
  font-weight: bold;
}

.nav a {
  color: white;
  text-decoration: none;
  margin-left: 2rem;
  transition: opacity 0.3s;
}

.nav a:hover {
  opacity: 0.8;
}

/* Hero Section */
.hero {
  background: linear-gradient(135deg, ${scheme.primary} 0%, ${scheme.secondary} 100%);
  color: white;
  padding: 6rem 0;
  text-align: center;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.hero-description {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

/* Buttons */
.btn {
  display: inline-block;
  padding: 0.75rem 2rem;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.3s;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background: ${scheme.accent};
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.btn-secondary {
  background: transparent;
  color: white;
  border: 2px solid white;
}

.btn-secondary:hover {
  background: white;
  color: ${scheme.primary};
}

/* Features Section */
.features {
  padding: 4rem 0;
}

.features h2 {
  text-align: center;
  font-size: 2.5rem;
  margin-bottom: 3rem;
  color: ${scheme.primary};
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.feature-card {
  text-align: center;
  padding: 2rem;
  border-radius: 8px;
  background: ${scheme.background};
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.3s;
}

.feature-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  color: ${scheme.primary};
  margin-bottom: 0.5rem;
}

/* CTA Section */
.cta {
  background: ${scheme.primary};
  color: white;
  padding: 4rem 0;
  text-align: center;
}

.cta h2 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.cta p {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

/* Page Content */
.page-content {
  padding: 4rem 0;
  min-height: 60vh;
}

.page-content h1 {
  color: ${scheme.primary};
  font-size: 2.5rem;
  margin-bottom: 1.5rem;
}

.page-content h2 {
  color: ${scheme.primary};
  margin-top: 2rem;
  margin-bottom: 1rem;
}

/* Contact Form */
.contact-form {
  max-width: 600px;
  margin: 2rem 0;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: ${scheme.text};
  font-weight: 500;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid ${scheme.secondary};
  border-radius: 6px;
  font-family: inherit;
  font-size: 1rem;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: ${scheme.primary};
}

/* Footer */
.footer {
  background: ${scheme.text};
  color: white;
  padding: 2rem 0;
  text-align: center;
  margin-top: 4rem;
}

/* Responsive */
@media (max-width: 768px) {
  .hero h1 {
    font-size: 2rem;
  }

  .nav {
    display: none;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }
}
`;
  }

  /**
   * Get AI builder project
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Project details
   */
  async getProject(projectId) {
    try {
      const query = `
        SELECT * FROM ai_builder_projects
        WHERE id = $1
      `;

      const result = await db.query(query, [projectId]);

      if (result.rows.length === 0) {
        throw new Error('Project not found');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting project:', error);
      throw new Error('Failed to retrieve project');
    }
  }

  /**
   * Get all projects for a website
   * @param {number} websiteId - Website ID
   * @returns {Promise<Array>} Projects
   */
  async getProjects(websiteId) {
    try {
      const query = `
        SELECT * FROM ai_builder_projects
        WHERE website_id = $1
        ORDER BY created_at DESC
      `;

      const result = await db.query(query, [websiteId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting projects:', error);
      throw new Error('Failed to retrieve projects');
    }
  }

  /**
   * Get available templates
   * @returns {Object} Available templates
   */
  getAvailableTemplates() {
    return Object.entries(this.templates).map(([key, value]) => ({
      id: key,
      ...value
    }));
  }

  /**
   * Get available color schemes
   * @returns {Object} Available color schemes
   */
  getAvailableColorSchemes() {
    return this.colorSchemes;
  }
}

export default new AIBuilderService();
