-- Core subscription tables for mPanel billing

CREATE TABLE IF NOT EXISTS customers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL UNIQUE,
  name             TEXT,
  tenant_id        UUID,
  currency         TEXT DEFAULT 'USD',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL,
  description      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  billing_cycle    TEXT NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'USD',
  unit_amount      BIGINT NOT NULL,
  stripe_price_id  TEXT UNIQUE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id              UUID REFERENCES customers(id),
  tenant_id                UUID,
  status                   TEXT NOT NULL DEFAULT 'incomplete',
  stripe_customer_id       TEXT,
  stripe_subscription_id   TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  checkout_session_id      TEXT,
  next_billing_date        TIMESTAMPTZ,
  trial_end                TIMESTAMPTZ,
  metadata                 JSONB DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_checkout_session_id
  ON subscriptions (checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id
  ON subscriptions (stripe_subscription_id);

CREATE TABLE IF NOT EXISTS subscription_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  price_id        UUID NOT NULL REFERENCES prices(id),
  quantity        INTEGER NOT NULL DEFAULT 1,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  tenant_id        UUID,
  stripe_invoice_id TEXT UNIQUE,
  number            TEXT UNIQUE,
  currency          TEXT NOT NULL DEFAULT 'USD',
  amount_due        BIGINT NOT NULL,
  amount_paid       BIGINT NOT NULL DEFAULT 0,
  amount_remaining  BIGINT NOT NULL DEFAULT 0,
  status            TEXT NOT NULL,
  due_date          TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id
  ON invoices (subscription_id);
