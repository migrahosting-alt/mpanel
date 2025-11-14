/**
 * Mock Utilities for Testing
 * Mocks for external services (Stripe, OpenAI) and API responses
 */

// Stripe Mock
export const mockStripe = {
  webhooks: {
    constructEvent: vi.fn((payload, signature, secret) => ({
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_test_123',
          customer: 'cus_test_123',
          amount_paid: 1999,
          status: 'paid',
        },
      },
    })),
  },
  
  customers: {
    create: vi.fn(async (data) => ({
      id: 'cus_' + Date.now(),
      email: data.email,
      name: data.name,
    })),
    
    retrieve: vi.fn(async (id) => ({
      id,
      email: 'test@example.com',
      name: 'Test Customer',
    })),
  },
  
  paymentIntents: {
    create: vi.fn(async (data) => ({
      id: 'pi_' + Date.now(),
      amount: data.amount,
      currency: data.currency,
      status: 'succeeded',
      client_secret: 'pi_secret_' + Date.now(),
    })),
  },
  
  subscriptions: {
    create: vi.fn(async (data) => ({
      id: 'sub_' + Date.now(),
      customer: data.customer,
      status: 'active',
      current_period_end: Date.now() + 30 * 24 * 60 * 60 * 1000,
    })),
    
    cancel: vi.fn(async (id) => ({
      id,
      status: 'canceled',
      canceled_at: Date.now(),
    })),
  },
};

// OpenAI Mock
export const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn(async (params) => ({
        id: 'chatcmpl_' + Date.now(),
        object: 'chat.completion',
        created: Date.now(),
        model: params.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'This is a mocked AI response for testing.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 25,
          total_tokens: 75,
        },
      })),
    },
  },
};

// PostgreSQL Mock
export const mockPg = {
  Client: class MockClient {
    constructor() {
      this.connected = false;
    }
    
    async connect() {
      this.connected = true;
    }
    
    async query(sql, params) {
      if (sql.includes('CREATE DATABASE')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('CREATE USER')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('GRANT')) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    }
    
    async end() {
      this.connected = false;
    }
  },
  
  Pool: class MockPool {
    constructor() {
      this.clients = [];
    }
    
    async query(sql, params) {
      return { rows: [], rowCount: 0 };
    }
    
    async end() {
      this.clients = [];
    }
  },
};

// Redis Mock
export const mockRedis = {
  createClient: () => ({
    connect: vi.fn(async () => {}),
    get: vi.fn(async (key) => null),
    set: vi.fn(async (key, value) => 'OK'),
    del: vi.fn(async (key) => 1),
    expire: vi.fn(async (key, seconds) => 1),
    disconnect: vi.fn(async () => {}),
  }),
};

// MinIO/S3 Mock
export const mockMinIO = {
  Client: class MockMinIOClient {
    constructor(config) {
      this.config = config;
    }
    
    async bucketExists(bucket) {
      return true;
    }
    
    async putObject(bucket, name, stream, size, metadata) {
      return {
        etag: 'mock-etag-' + Date.now(),
        versionId: null,
      };
    }
    
    async getObject(bucket, name) {
      return Buffer.from('mock file content');
    }
    
    async removeObject(bucket, name) {
      return {};
    }
  },
};

// Email Service Mock (Nodemailer)
export const mockNodemailer = {
  createTransport: () => ({
    sendMail: vi.fn(async (mailOptions) => ({
      messageId: 'mock-' + Date.now() + '@example.com',
      accepted: [mailOptions.to],
      rejected: [],
      response: '250 Message accepted',
    })),
  }),
};

// DNS Mock (PowerDNS)
export const mockPowerDNS = {
  zones: {
    create: vi.fn(async (zone) => ({
      id: 'zone-' + Date.now(),
      name: zone.name,
      kind: zone.kind || 'Native',
      serial: Date.now(),
    })),
    
    get: vi.fn(async (zoneName) => ({
      id: 'zone-123',
      name: zoneName,
      kind: 'Native',
      records: [],
    })),
    
    delete: vi.fn(async (zoneName) => ({})),
  },
  
  records: {
    create: vi.fn(async (zoneName, record) => ({
      id: 'record-' + Date.now(),
      name: record.name,
      type: record.type,
      content: record.content,
      ttl: record.ttl || 3600,
    })),
  },
};

// API Client Mock
export const mockApiClient = {
  get: vi.fn(async (url) => {
    if (url.includes('/auth/me')) {
      return { id: 1, email: 'test@example.com', name: 'Test User' };
    }
    if (url.includes('/customers')) {
      return [{ id: 1, email: 'customer@example.com', name: 'Customer 1' }];
    }
    return {};
  }),
  
  post: vi.fn(async (url, data) => {
    if (url.includes('/auth/login')) {
      return {
        token: 'mock-token-' + Date.now(),
        user: { id: 1, email: data.email, name: 'Test User' },
      };
    }
    if (url.includes('/customers')) {
      return { id: Date.now(), ...data };
    }
    if (url.includes('/invoices')) {
      return {
        id: Date.now(),
        ...data,
        subtotal: 100,
        tax: 10,
        total: 110,
      };
    }
    return {};
  }),
  
  put: vi.fn(async (url, data) => {
    return { id: 1, ...data };
  }),
  
  delete: vi.fn(async (url) => {
    return { message: 'Deleted successfully' };
  }),
};

// Test Data Generators
export const generateMockCustomer = (overrides = {}) => ({
  id: Date.now(),
  email: `customer-${Date.now()}@example.com`,
  name: 'Test Customer',
  company: 'Test Company',
  phone: '+1234567890',
  address: '123 Test St',
  city: 'Test City',
  state: 'TS',
  zip: '12345',
  country: 'US',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const generateMockInvoice = (overrides = {}) => ({
  id: Date.now(),
  invoice_number: 'INV-' + Date.now(),
  customer_id: 1,
  subtotal: 100.00,
  tax: 10.00,
  total: 110.00,
  status: 'unpaid',
  due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString(),
  items: [
    {
      description: 'Test Product',
      quantity: 1,
      unit_price: 100.00,
      total: 100.00,
    },
  ],
  ...overrides,
});

export const generateMockUser = (overrides = {}) => ({
  id: Date.now(),
  email: `user-${Date.now()}@example.com`,
  name: 'Test User',
  role: 'customer',
  status: 'active',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const generateMockSubscription = (overrides = {}) => ({
  id: Date.now(),
  customer_id: 1,
  product_id: 1,
  status: 'active',
  billing_cycle: 'monthly',
  price: 9.99,
  next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString(),
  ...overrides,
});

// Utility: Wait for async operations
export const waitFor = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Utility: Flush promises
export const flushPromises = () => new Promise(setImmediate);
