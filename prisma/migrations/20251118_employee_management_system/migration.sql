-- Employee Management System Enhancement
-- Adds departments, employee profiles, and advanced HR features

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- DEPARTMENTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL, -- e.g., 'SALES', 'SUPPORT', 'ENGINEERING'
  description TEXT,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Department head
  parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL, -- For nested departments
  location VARCHAR(255), -- Office location
  budget_allocated DECIMAL(12, 2) DEFAULT 0,
  employee_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- EMPLOYEE PROFILES (Extended User Data)
-- ========================================
CREATE TABLE IF NOT EXISTS employee_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id VARCHAR(50) UNIQUE, -- Company employee ID (e.g., 'EMP-001')
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  job_title VARCHAR(100),
  employment_type VARCHAR(50) DEFAULT 'full_time', -- 'full_time', 'part_time', 'contractor', 'intern'
  work_location VARCHAR(100), -- 'remote', 'office', 'hybrid'
  hire_date DATE,
  termination_date DATE,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  salary DECIMAL(12, 2), -- Encrypted in production
  salary_currency VARCHAR(3) DEFAULT 'USD',
  hourly_rate DECIMAL(10, 2),
  commission_rate DECIMAL(5, 2), -- For sales staff
  phone_work VARCHAR(50),
  phone_mobile VARCHAR(50),
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(50),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  timezone VARCHAR(50) DEFAULT 'UTC',
  skills JSONB, -- ["JavaScript", "React", "Node.js"]
  certifications JSONB, -- [{"name": "AWS Certified", "date": "2024-01-01"}]
  performance_notes TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- EMPLOYEE ONBOARDING TASKS
-- ========================================
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  task_order INTEGER DEFAULT 0,
  assigned_to VARCHAR(50), -- 'employee', 'manager', 'hr', 'it'
  due_days_after_hire INTEGER DEFAULT 0, -- Days after hire date
  is_required BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- EMPLOYEE ONBOARDING PROGRESS
-- ========================================
CREATE TABLE IF NOT EXISTS employee_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  onboarding_task_id UUID REFERENCES onboarding_tasks(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'skipped'
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, onboarding_task_id)
);

-- ========================================
-- TIME OFF REQUESTS
-- ========================================
CREATE TABLE IF NOT EXISTS time_off_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  request_type VARCHAR(50) NOT NULL, -- 'vacation', 'sick', 'personal', 'unpaid'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days DECIMAL(3, 1),
  reason TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- EMPLOYEE DOCUMENTS
-- ========================================
CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  document_type VARCHAR(100), -- 'resume', 'contract', 'id', 'certificate', 'other'
  document_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500),
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_confidential BOOLEAN DEFAULT true,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- PERFORMANCE REVIEWS
-- ========================================
CREATE TABLE IF NOT EXISTS performance_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  review_period_start DATE,
  review_period_end DATE,
  review_type VARCHAR(50), -- 'annual', 'quarterly', 'probation', 'promotion'
  overall_rating DECIMAL(3, 2), -- 0.00 to 5.00
  technical_skills_rating DECIMAL(3, 2),
  communication_rating DECIMAL(3, 2),
  teamwork_rating DECIMAL(3, 2),
  leadership_rating DECIMAL(3, 2),
  strengths TEXT,
  areas_for_improvement TEXT,
  goals_next_period TEXT,
  employee_comments TEXT,
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'submitted', 'acknowledged'
  submitted_at TIMESTAMP,
  acknowledged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================
CREATE INDEX IF NOT EXISTS idx_departments_tenant ON departments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_departments_manager ON departments(manager_id);
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(is_active);

CREATE INDEX IF NOT EXISTS idx_employee_profiles_user ON employee_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_tenant ON employee_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_department ON employee_profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_manager ON employee_profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_active ON employee_profiles(is_active);

CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_tenant ON onboarding_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_department ON onboarding_tasks(department_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_progress_employee ON employee_onboarding_progress(employee_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_status ON employee_onboarding_progress(status);

CREATE INDEX IF NOT EXISTS idx_time_off_employee ON time_off_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_off_status ON time_off_requests(status);
CREATE INDEX IF NOT EXISTS idx_time_off_dates ON time_off_requests(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_type ON employee_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_performance_reviews_employee ON performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_reviewer ON performance_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_status ON performance_reviews(status);

-- ========================================
-- UPDATE TRIGGERS
-- ========================================
CREATE OR REPLACE FUNCTION update_department_employee_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update employee count when employee profile changes department
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.department_id IS DISTINCT FROM NEW.department_id) THEN
    -- Increment new department
    IF NEW.department_id IS NOT NULL THEN
      UPDATE departments SET employee_count = employee_count + 1 
      WHERE id = NEW.department_id;
    END IF;
    
    -- Decrement old department
    IF TG_OP = 'UPDATE' AND OLD.department_id IS NOT NULL THEN
      UPDATE departments SET employee_count = GREATEST(employee_count - 1, 0)
      WHERE id = OLD.department_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.department_id IS NOT NULL THEN
    UPDATE departments SET employee_count = GREATEST(employee_count - 1, 0)
    WHERE id = OLD.department_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_department_employee_count
AFTER INSERT OR UPDATE OF department_id OR DELETE ON employee_profiles
FOR EACH ROW EXECUTE FUNCTION update_department_employee_count();

-- Trigger for updated_at timestamps
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_profiles_updated_at BEFORE UPDATE ON employee_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_onboarding_tasks_updated_at BEFORE UPDATE ON onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_onboarding_progress_updated_at BEFORE UPDATE ON employee_onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_off_requests_updated_at BEFORE UPDATE ON time_off_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_documents_updated_at BEFORE UPDATE ON employee_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_performance_reviews_updated_at BEFORE UPDATE ON performance_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- INSERT DEFAULT DEPARTMENTS (Example)
-- ========================================
INSERT INTO departments (name, code, description, is_active) VALUES
  ('Engineering', 'ENG', 'Software development and technical infrastructure', true),
  ('Sales', 'SALES', 'Customer acquisition and revenue generation', true),
  ('Support', 'SUPPORT', 'Customer support and technical assistance', true),
  ('Marketing', 'MARKETING', 'Brand awareness and lead generation', true),
  ('Finance', 'FINANCE', 'Accounting, billing, and financial operations', true),
  ('Human Resources', 'HR', 'Employee management and recruitment', true),
  ('Operations', 'OPS', 'Business operations and process management', true),
  ('Product', 'PRODUCT', 'Product management and strategy', true),
  ('Legal', 'LEGAL', 'Legal compliance and contracts', true),
  ('Executive', 'EXEC', 'C-level and executive management', true)
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- INSERT DEFAULT ONBOARDING TASKS
-- ========================================
INSERT INTO onboarding_tasks (title, description, assigned_to, due_days_after_hire, task_order, is_required) VALUES
  -- Day 1
  ('Complete welcome orientation', 'Attend company welcome session and meet the team', 'employee', 0, 1, true),
  ('Set up workstation', 'Configure computer, email, and necessary software', 'it', 0, 2, true),
  ('Sign employment contract', 'Review and sign employment agreement', 'hr', 0, 3, true),
  ('Submit tax forms', 'Complete W-4 or equivalent tax documentation', 'employee', 1, 4, true),
  ('Enroll in benefits', 'Select health insurance and other benefits', 'employee', 7, 5, true),
  
  -- Week 1
  ('Complete security training', 'Complete mandatory security awareness training', 'employee', 3, 6, true),
  ('Set up access credentials', 'Create accounts for all necessary systems', 'it', 1, 7, true),
  ('Meet with manager', 'Initial 1-on-1 with direct manager to discuss role and expectations', 'manager', 1, 8, true),
  ('Department introduction', 'Meet department team members', 'manager', 3, 9, true),
  
  -- Month 1
  ('Complete product training', 'Learn about company products and services', 'employee', 14, 10, true),
  ('30-day check-in', 'Review progress and address any questions or concerns', 'manager', 30, 11, true),
  ('Submit emergency contact info', 'Provide emergency contact information', 'employee', 7, 12, true),
  
  -- Month 3
  ('90-day probation review', 'Formal performance review at end of probation period', 'manager', 90, 13, true)
ON CONFLICT DO NOTHING;

-- ========================================
-- GRANT PERMISSIONS (if using role-based access)
-- ========================================
-- Add new permissions for HR management
INSERT INTO permissions (name, resource, action, description) VALUES
  ('hr.view_employees', 'hr', 'view_employees', 'View employee profiles and information'),
  ('hr.manage_employees', 'hr', 'manage_employees', 'Create and edit employee profiles'),
  ('hr.manage_departments', 'hr', 'manage_departments', 'Create and manage departments'),
  ('hr.view_reviews', 'hr', 'view_reviews', 'View performance reviews'),
  ('hr.manage_reviews', 'hr', 'manage_reviews', 'Create and manage performance reviews'),
  ('hr.view_time_off', 'hr', 'view_time_off', 'View time off requests'),
  ('hr.manage_time_off', 'hr', 'manage_time_off', 'Approve/reject time off requests'),
  ('hr.view_documents', 'hr', 'view_documents', 'View employee documents'),
  ('hr.manage_documents', 'hr', 'manage_documents', 'Upload and manage employee documents'),
  ('hr.manage_onboarding', 'hr', 'manage_onboarding', 'Manage onboarding process and tasks')
ON CONFLICT (name) DO NOTHING;

-- Assign HR permissions to admin and HR roles
DO $$
DECLARE
  admin_role_id UUID;
  hr_role_id UUID;
  perm RECORD;
BEGIN
  SELECT id INTO admin_role_id FROM roles WHERE name = 'admin' LIMIT 1;
  SELECT id INTO hr_role_id FROM roles WHERE name = 'customer_service' LIMIT 1; -- Repurpose as HR
  
  -- Grant all HR permissions to admin
  FOR perm IN SELECT id FROM permissions WHERE resource = 'hr' LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (admin_role_id, perm.id)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Grant HR permissions to HR role (if exists)
  IF hr_role_id IS NOT NULL THEN
    FOR perm IN SELECT id FROM permissions WHERE resource = 'hr' LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (hr_role_id, perm.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- ========================================
-- COMMENTS FOR DOCUMENTATION
-- ========================================
COMMENT ON TABLE departments IS 'Company departments and organizational structure';
COMMENT ON TABLE employee_profiles IS 'Extended employee information beyond basic user accounts';
COMMENT ON TABLE onboarding_tasks IS 'Template tasks for employee onboarding process';
COMMENT ON TABLE employee_onboarding_progress IS 'Individual employee progress on onboarding tasks';
COMMENT ON TABLE time_off_requests IS 'Employee vacation and time off requests';
COMMENT ON TABLE employee_documents IS 'Employee-related documents (contracts, certificates, etc.)';
COMMENT ON TABLE performance_reviews IS 'Employee performance evaluations and reviews';
