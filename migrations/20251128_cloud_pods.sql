-- Migration: Cloud Pods System
-- Date: 2025-11-28
-- Description: Create Cloud Pod tables and seed products
-- ============================================================================

-- ============================================================================
-- Cloud Pod Subscriptions - tracks each customer's Cloud Pod
-- ============================================================================
CREATE TABLE IF NOT EXISTS cloud_pod_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  
  -- Plan details (snapshot at time of purchase)
  plan_code VARCHAR(50) NOT NULL, -- CLOUD_POD_MINI, CLOUD_POD_PRO, etc.
  plan_name VARCHAR(100) NOT NULL,
  
  -- Domain
  primary_domain VARCHAR(255),
  
  -- Proxmox identifiers (populated after provisioning)
  pod_vm_id INT, -- VMID or CTID in Proxmox
  pod_node_name VARCHAR(100),
  pod_internal_ip INET,
  pod_public_ip INET,
  pod_internal_hostname VARCHAR(255),
  
  -- Resource snapshot
  vcpu INT NOT NULL DEFAULT 1,
  ram_gb INT NOT NULL DEFAULT 1,
  disk_gb INT NOT NULL DEFAULT 20,
  bandwidth_tb INT NOT NULL DEFAULT 2,
  
  -- Stack configuration
  stack JSONB NOT NULL DEFAULT '{}',
  
  -- Backup and email configuration
  backup_tier_code VARCHAR(50) NOT NULL DEFAULT 'BACKUP_BASIC_7D',
  email_plan_code VARCHAR(50) NOT NULL DEFAULT 'EMAIL_INCLUDED',
  
  -- Status: PROVISIONING, ACTIVE, SUSPENDED, TERMINATED, FAILED
  status VARCHAR(50) NOT NULL DEFAULT 'PROVISIONING',
  status_message TEXT,
  
  -- Stripe integration
  stripe_subscription_id VARCHAR(255),
  
  -- Timestamps
  provisioned_at TIMESTAMP WITH TIME ZONE,
  suspended_at TIMESTAMP WITH TIME ZONE,
  terminated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cloud_pod_subs_customer ON cloud_pod_subscriptions(customer_id);
CREATE INDEX idx_cloud_pod_subs_status ON cloud_pod_subscriptions(status);
CREATE INDEX idx_cloud_pod_subs_plan ON cloud_pod_subscriptions(plan_code);
CREATE INDEX idx_cloud_pod_subs_domain ON cloud_pod_subscriptions(primary_domain) WHERE primary_domain IS NOT NULL;
CREATE INDEX idx_cloud_pod_subs_vm_id ON cloud_pod_subscriptions(pod_vm_id) WHERE pod_vm_id IS NOT NULL;

-- ============================================================================
-- Cloud Pod Events - audit trail for pod lifecycle
-- ============================================================================
CREATE TABLE IF NOT EXISTS cloud_pod_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cloud_pod_id UUID NOT NULL REFERENCES cloud_pod_subscriptions(id) ON DELETE CASCADE,
  
  -- Event type: CREATED, PROVISION_STARTED, PROVISION_DONE, BACKUP_STARTED, BACKUP_DONE,
  -- BACKUP_FAILED, SUSPENDED, RESUMED, TERMINATED, RESOURCE_UPGRADED, etc.
  event_type VARCHAR(100) NOT NULL,
  
  -- Optional payload with extra details
  payload JSONB,
  
  -- Who triggered this event (user_id, system, worker)
  triggered_by VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cloud_pod_events_pod ON cloud_pod_events(cloud_pod_id);
CREATE INDEX idx_cloud_pod_events_type ON cloud_pod_events(event_type);
CREATE INDEX idx_cloud_pod_events_created ON cloud_pod_events(created_at DESC);

-- ============================================================================
-- Cloud Pod Provisioning Tasks - queue for provisioning workers
-- ============================================================================
CREATE TABLE IF NOT EXISTS cloud_pod_provisioning_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cloud_pod_id UUID NOT NULL REFERENCES cloud_pod_subscriptions(id) ON DELETE CASCADE,
  
  -- Task type: CREATE_CONTAINER, CONFIGURE_STACK, SETUP_DNS, SETUP_BACKUP, etc.
  task_type VARCHAR(100) NOT NULL,
  
  -- Status: PENDING, IN_PROGRESS, COMPLETED, FAILED, RETRYING
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  
  -- Priority (lower = higher priority)
  priority INT NOT NULL DEFAULT 100,
  
  -- Retry tracking
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_error TEXT,
  
  -- Full provisioning intent JSON
  intent JSONB NOT NULL,
  
  -- Result data (IP assigned, VMID, etc.)
  result JSONB,
  
  -- Worker tracking
  worker_id VARCHAR(100),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cloud_pod_tasks_status ON cloud_pod_provisioning_tasks(status);
CREATE INDEX idx_cloud_pod_tasks_priority ON cloud_pod_provisioning_tasks(priority, created_at) WHERE status = 'PENDING';
CREATE INDEX idx_cloud_pod_tasks_pod ON cloud_pod_provisioning_tasks(cloud_pod_id);

-- ============================================================================
-- Cloud Pod Backups - tracks backup history
-- ============================================================================
CREATE TABLE IF NOT EXISTS cloud_pod_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cloud_pod_id UUID NOT NULL REFERENCES cloud_pod_subscriptions(id) ON DELETE CASCADE,
  
  -- Backup details
  backup_path VARCHAR(500) NOT NULL,
  backup_size_bytes BIGINT,
  backup_type VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED, MANUAL, PRE_UPGRADE
  
  -- Status: PENDING, IN_PROGRESS, COMPLETED, FAILED
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  error_message TEXT,
  
  -- Retention tracking
  retention_days INT NOT NULL DEFAULT 7,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cloud_pod_backups_pod ON cloud_pod_backups(cloud_pod_id);
CREATE INDEX idx_cloud_pod_backups_expires ON cloud_pod_backups(expires_at) WHERE status = 'COMPLETED';

-- ============================================================================
-- Seed Cloud Pod Products
-- ============================================================================
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Get the MigraHosting tenant
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'migrahosting' OR name ILIKE '%migrahosting%' LIMIT 1;
  IF v_tenant_id IS NULL THEN
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
  END IF;

  RAISE NOTICE 'Using tenant_id: %', v_tenant_id;

  -- Cloud Pod Mini
  INSERT INTO products (tenant_id, code, name, description, type, billing_cycle, price, setup_fee, currency, taxable, metadata, status)
  VALUES (
    v_tenant_id,
    'CLOUD_POD_MINI',
    'Cloud Pod Mini',
    'Your own isolated container for a single small website or app. 1 vCPU, 1GB RAM, 20GB NVMe SSD.',
    'cloud_pod',
    'monthly',
    9.99,
    0,
    'USD',
    true,
    '{
      "vcpu": 1,
      "ramGb": 1,
      "diskGb": 20,
      "bandwidthTb": 2,
      "stack": {"webServer": "NGINX", "phpEnabled": true, "databaseEnabled": true, "nodeJsEnabled": false, "sshAccess": true, "sftpAccess": true},
      "defaultBackupTier": "BACKUP_BASIC_7D",
      "emailPlan": "EMAIL_INCLUDED",
      "tags": ["starter", "single-site", "cloud-pod"],
      "serviceKind": "CLOUD_POD"
    }'::jsonb,
    'active'
  )
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

  -- Cloud Pod Pro
  INSERT INTO products (tenant_id, code, name, description, type, billing_cycle, price, setup_fee, currency, taxable, metadata, status)
  VALUES (
    v_tenant_id,
    'CLOUD_POD_PRO',
    'Cloud Pod Pro',
    'More power and memory for multiple sites, stores, or apps. 2 vCPU, 2GB RAM, 40GB NVMe SSD.',
    'cloud_pod',
    'monthly',
    19.99,
    0,
    'USD',
    true,
    '{
      "vcpu": 2,
      "ramGb": 2,
      "diskGb": 40,
      "bandwidthTb": 3,
      "stack": {"webServer": "NGINX", "phpEnabled": true, "databaseEnabled": true, "nodeJsEnabled": true, "sshAccess": true, "sftpAccess": true},
      "defaultBackupTier": "BACKUP_BASIC_7D",
      "emailPlan": "EMAIL_INCLUDED",
      "tags": ["pro", "multi-site", "business", "cloud-pod"],
      "serviceKind": "CLOUD_POD"
    }'::jsonb,
    'active'
  )
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

  -- Cloud Pod Business
  INSERT INTO products (tenant_id, code, name, description, type, billing_cycle, price, setup_fee, currency, taxable, metadata, status)
  VALUES (
    v_tenant_id,
    'CLOUD_POD_BUSINESS',
    'Cloud Pod Business',
    'For serious businesses, agencies, and high-traffic workloads. 4 vCPU, 6GB RAM, 80GB NVMe SSD.',
    'cloud_pod',
    'monthly',
    39.99,
    0,
    'USD',
    true,
    '{
      "vcpu": 4,
      "ramGb": 6,
      "diskGb": 80,
      "bandwidthTb": 5,
      "stack": {"webServer": "NGINX", "phpEnabled": true, "databaseEnabled": true, "nodeJsEnabled": true, "sshAccess": true, "sftpAccess": true},
      "defaultBackupTier": "BACKUP_PREMIUM_30D",
      "emailPlan": "EMAIL_INCLUDED",
      "tags": ["business", "agency", "high-traffic", "cloud-pod"],
      "serviceKind": "CLOUD_POD"
    }'::jsonb,
    'active'
  )
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

  -- Cloud Pod Enterprise
  INSERT INTO products (tenant_id, code, name, description, type, billing_cycle, price, setup_fee, currency, taxable, metadata, status)
  VALUES (
    v_tenant_id,
    'CLOUD_POD_ENTERPRISE',
    'Cloud Pod Enterprise',
    'High-performance isolated environment for demanding projects. 8 vCPU, 16GB RAM, 160GB NVMe SSD.',
    'cloud_pod',
    'monthly',
    79.99,
    0,
    'USD',
    true,
    '{
      "vcpu": 8,
      "ramGb": 16,
      "diskGb": 160,
      "bandwidthTb": 8,
      "stack": {"webServer": "NGINX", "phpEnabled": true, "databaseEnabled": true, "nodeJsEnabled": true, "sshAccess": true, "sftpAccess": true},
      "defaultBackupTier": "BACKUP_PREMIUM_30D",
      "emailPlan": "EMAIL_INCLUDED",
      "tags": ["enterprise", "heavy", "cloud-pod"],
      "serviceKind": "CLOUD_POD"
    }'::jsonb,
    'active'
  )
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

  RAISE NOTICE 'Cloud Pod products seeded successfully!';
END $$;

-- ============================================================================
-- Helper function to get next pending provisioning task
-- ============================================================================
CREATE OR REPLACE FUNCTION get_next_cloud_pod_task(p_worker_id VARCHAR(100))
RETURNS TABLE (
  task_id UUID,
  cloud_pod_id UUID,
  task_type VARCHAR(100),
  intent JSONB
) AS $$
DECLARE
  v_task_id UUID;
BEGIN
  -- Lock and claim the next pending task
  UPDATE cloud_pod_provisioning_tasks
  SET 
    status = 'IN_PROGRESS',
    worker_id = p_worker_id,
    started_at = NOW(),
    attempts = attempts + 1,
    updated_at = NOW()
  WHERE id = (
    SELECT id FROM cloud_pod_provisioning_tasks
    WHERE status = 'PENDING' AND attempts < max_attempts
    ORDER BY priority ASC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING id INTO v_task_id;
  
  IF v_task_id IS NOT NULL THEN
    RETURN QUERY
    SELECT t.id, t.cloud_pod_id, t.task_type, t.intent
    FROM cloud_pod_provisioning_tasks t
    WHERE t.id = v_task_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger to update updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_cloud_pod_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cloud_pod_subs_updated_at
  BEFORE UPDATE ON cloud_pod_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_cloud_pod_updated_at();

CREATE TRIGGER update_cloud_pod_tasks_updated_at
  BEFORE UPDATE ON cloud_pod_provisioning_tasks
  FOR EACH ROW EXECUTE FUNCTION update_cloud_pod_updated_at();

-- Verify products were created
SELECT code, name, type, billing_cycle, price, status FROM products WHERE type = 'cloud_pod' ORDER BY price;
