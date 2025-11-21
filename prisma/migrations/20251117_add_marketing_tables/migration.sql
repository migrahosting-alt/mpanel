-- Marketing website integration tables
-- Migration: 20251117_add_marketing_tables

-- Contact Inquiries Table
CREATE TABLE IF NOT EXISTS contact_inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  company VARCHAR(255),
  subject VARCHAR(500),
  message TEXT NOT NULL,
  department VARCHAR(50) DEFAULT 'info',
  source VARCHAR(50) DEFAULT 'website',
  status VARCHAR(20) DEFAULT 'new', -- new, in_progress, resolved, closed
  assigned_to UUID REFERENCES users(id),
  ip_address INET,
  responded_at TIMESTAMP,
  resolved_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Newsletter Subscribers Table
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  source VARCHAR(50) DEFAULT 'website',
  subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unsubscribed_at TIMESTAMP,
  confirmed BOOLEAN DEFAULT false,
  confirmation_token VARCHAR(255),
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Demo Requests Table
CREATE TABLE IF NOT EXISTS demo_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  company VARCHAR(255),
  employee_count VARCHAR(50),
  message TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, scheduled, completed, cancelled
  scheduled_at TIMESTAMP,
  completed_at TIMESTAMP,
  demo_url TEXT,
  notes TEXT,
  ip_address INET,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Early Access Signups Table
CREATE TABLE IF NOT EXISTS early_access_signups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  use_case TEXT,
  company VARCHAR(255),
  access_code VARCHAR(50) NOT NULL UNIQUE,
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMP,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hosting Plans Table (for public pricing API)
CREATE TABLE IF NOT EXISTS hosting_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  billing_cycle VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly
  features JSONB NOT NULL,
  storage_gb INTEGER,
  bandwidth_gb INTEGER,
  websites INTEGER,
  email_accounts INTEGER,
  databases INTEGER,
  active BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blog Posts Table (for marketing website content)
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image TEXT,
  author_id UUID REFERENCES users(id),
  category VARCHAR(100),
  tags TEXT[],
  status VARCHAR(20) DEFAULT 'draft', -- draft, published, scheduled
  published_at TIMESTAMP,
  scheduled_for TIMESTAMP,
  views INTEGER DEFAULT 0,
  meta_title VARCHAR(255),
  meta_description VARCHAR(500),
  search_vector tsvector,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Testimonials Table
CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_name VARCHAR(255) NOT NULL,
  customer_title VARCHAR(255),
  customer_company VARCHAR(255),
  customer_photo TEXT,
  testimonial TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  featured BOOLEAN DEFAULT false,
  approved BOOLEAN DEFAULT false,
  display_on_website BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_contact_inquiries_email ON contact_inquiries(email);
CREATE INDEX idx_contact_inquiries_status ON contact_inquiries(status);
CREATE INDEX idx_contact_inquiries_department ON contact_inquiries(department);
CREATE INDEX idx_contact_inquiries_created ON contact_inquiries(created_at DESC);

CREATE INDEX idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX idx_newsletter_subscribed ON newsletter_subscribers(subscribed_at);

CREATE INDEX idx_demo_requests_email ON demo_requests(email);
CREATE INDEX idx_demo_requests_status ON demo_requests(status);

CREATE INDEX idx_early_access_code ON early_access_signups(access_code);
CREATE INDEX idx_early_access_email ON early_access_signups(email);

CREATE INDEX idx_hosting_plans_active ON hosting_plans(active, sort_order);

CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status_published ON blog_posts(status, published_at);
CREATE INDEX idx_blog_posts_search ON blog_posts USING gin(search_vector);

CREATE INDEX idx_testimonials_approved ON testimonials(approved, featured);

-- Create triggers
CREATE TRIGGER update_contact_inquiries_updated_at BEFORE UPDATE ON contact_inquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_newsletter_subscribers_updated_at BEFORE UPDATE ON newsletter_subscribers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_demo_requests_updated_at BEFORE UPDATE ON demo_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hosting_plans_updated_at BEFORE UPDATE ON hosting_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_testimonials_updated_at BEFORE UPDATE ON testimonials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Blog post search trigger
CREATE OR REPLACE FUNCTION blog_posts_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '') || ' ' || COALESCE(array_to_string(NEW.tags, ' '), ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_posts_search_update BEFORE INSERT OR UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION blog_posts_search_trigger();

-- Insert sample hosting plans
INSERT INTO hosting_plans (name, description, price, billing_cycle, features, storage_gb, bandwidth_gb, websites, email_accounts, databases, featured, sort_order) VALUES
('Starter', 'Perfect for personal websites and blogs', 4.99, 'monthly', 
 '{"features": ["1 Website", "10 GB SSD Storage", "Unlimited Bandwidth", "5 Email Accounts", "Free SSL", "Daily Backups"]}'::jsonb,
 10, -1, 1, 5, 1, false, 1),
('Business', 'Ideal for small businesses and e-commerce', 9.99, 'monthly',
 '{"features": ["5 Websites", "50 GB SSD Storage", "Unlimited Bandwidth", "25 Email Accounts", "Free SSL", "Daily Backups", "Priority Support"]}'::jsonb,
 50, -1, 5, 25, 5, true, 2),
('Professional', 'For growing businesses and agencies', 19.99, 'monthly',
 '{"features": ["Unlimited Websites", "100 GB SSD Storage", "Unlimited Bandwidth", "Unlimited Email Accounts", "Free SSL", "Hourly Backups", "Priority Support", "White Label"]}'::jsonb,
 100, -1, -1, -1, -1, false, 3),
('Enterprise', 'Custom solutions for large organizations', 49.99, 'monthly',
 '{"features": ["Unlimited Everything", "500 GB SSD Storage", "Dedicated Resources", "Unlimited Email Accounts", "Free SSL", "Real-time Backups", "24/7 Priority Support", "White Label", "SLA Guarantee"]}'::jsonb,
 500, -1, -1, -1, -1, false, 4)
ON CONFLICT DO NOTHING;
