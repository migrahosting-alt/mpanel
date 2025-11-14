/**
 * GraphQL Schema Definition
 * Complete type definitions for mPanel GraphQL API
 */

export const typeDefs = `#graphql
  scalar DateTime
  scalar JSON

  # ============================================
  # User & Authentication Types
  # ============================================
  
  type User {
    id: ID!
    email: String!
    name: String
    role: String!
    tenant: Tenant
    status: String!
    createdAt: DateTime!
    subscriptions: [Subscription!]
    invoices: [Invoice!]
    services: [Service!]
    totalSpent: Float!
    lifetimeValue: Float!
  }

  type Tenant {
    id: ID!
    name: String!
    domain: String
    settings: JSON
    users: [User!]
    subscriptions: [Subscription!]
    revenue: RevenueMetrics
  }

  type AuthPayload {
    token: String!
    refreshToken: String!
    user: User!
    expiresIn: Int!
  }

  # ============================================
  # Billing & Revenue Types
  # ============================================

  type Product {
    id: ID!
    name: String!
    description: String
    price: Float!
    billingCycle: String!
    category: String
    features: [String!]
    active: Boolean!
    subscriptions: [Subscription!]
    metrics: ProductMetrics
  }

  type ProductMetrics {
    activeSubscriptions: Int!
    totalRevenue: Float!
    averageRevenue: Float!
    churnRate: Float!
  }

  type Subscription {
    id: ID!
    user: User!
    product: Product!
    status: String!
    price: Float!
    billingCycle: String!
    nextBillingDate: DateTime
    cancelledAt: DateTime
    createdAt: DateTime!
    invoices: [Invoice!]
  }

  type Invoice {
    id: ID!
    user: User!
    number: String!
    total: Float!
    subtotal: Float!
    tax: Float!
    status: String!
    dueDate: DateTime
    paidAt: DateTime
    items: [InvoiceItem!]
    createdAt: DateTime!
  }

  type InvoiceItem {
    id: ID!
    description: String!
    quantity: Int!
    unitPrice: Float!
    total: Float!
  }

  type RevenueMetrics {
    totalRevenue: Float!
    mrr: Float!
    arr: Float!
    avgInvoiceValue: Float!
    growth: Float!
  }

  # ============================================
  # Hosting & Infrastructure Types
  # ============================================

  type Server {
    id: ID!
    hostname: String!
    ipAddress: String!
    status: String!
    location: String
    resources: ServerResources
    websites: [Website!]
    databases: [Database!]
    metrics: ServerMetrics
  }

  type ServerResources {
    cpu: Float!
    memory: Float!
    disk: Float!
    bandwidth: Float!
  }

  type ServerMetrics {
    cpuUsage: Float!
    memoryUsage: Float!
    diskUsage: Float!
    uptime: Float!
    load: [Float!]
  }

  type Website {
    id: ID!
    domain: String!
    server: Server
    status: String!
    phpVersion: String
    sslEnabled: Boolean!
    metrics: WebsiteMetrics
    backups: [Backup!]
  }

  type WebsiteMetrics {
    diskUsage: Float!
    bandwidth: Float!
    requests: Int!
    uptime: Float!
  }

  type Database {
    id: ID!
    name: String!
    type: String!
    size: Float!
    server: Server
    connections: Int!
    status: String!
  }

  type Domain {
    id: ID!
    name: String!
    registrar: String
    expiresAt: DateTime
    autoRenew: Boolean!
    nameservers: [String!]
    dnsRecords: [DNSRecord!]
  }

  type DNSRecord {
    id: ID!
    type: String!
    name: String!
    value: String!
    ttl: Int!
    priority: Int
  }

  # ============================================
  # Serverless Functions Types
  # ============================================

  type Function {
    id: ID!
    name: String!
    runtime: String!
    handler: String!
    code: String!
    environment: JSON
    status: String!
    invocations: Int!
    lastInvocation: DateTime
    metrics: FunctionMetrics
  }

  type FunctionMetrics {
    invocations: Int!
    errors: Int!
    avgDuration: Float!
    coldStarts: Int!
  }

  type FunctionInvocation {
    id: ID!
    function: Function!
    status: String!
    duration: Float!
    memoryUsed: Float!
    logs: String
    error: String
    createdAt: DateTime!
  }

  # ============================================
  # Analytics & Insights Types
  # ============================================

  type Analytics {
    revenue: RevenueAnalytics!
    customers: CustomerAnalytics!
    products: [ProductAnalytics!]!
    cohorts: [Cohort!]!
  }

  type RevenueAnalytics {
    total: Float!
    mrr: Float!
    arr: Float!
    growth: Float!
    forecast: [RevenueForecast!]!
  }

  type RevenueForecast {
    month: String!
    low: Float!
    mid: Float!
    high: Float!
    confidence: Float!
  }

  type CustomerAnalytics {
    total: Int!
    active: Int!
    churnRate: Float!
    avgLTV: Float!
    segments: CustomerSegments!
  }

  type CustomerSegments {
    champions: Int!
    loyal: Int!
    atRisk: Int!
    lost: Int!
    new: Int!
  }

  type ProductAnalytics {
    product: Product!
    revenue: Float!
    subscriptions: Int!
    churnRate: Float!
    growth: Float!
  }

  type Cohort {
    month: String!
    size: Int!
    active: Int!
    retentionRate: Float!
    revenue: Float!
  }

  # ============================================
  # Support & Notifications Types
  # ============================================

  type Ticket {
    id: ID!
    subject: String!
    status: String!
    priority: String!
    user: User!
    messages: [TicketMessage!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type TicketMessage {
    id: ID!
    content: String!
    author: User!
    createdAt: DateTime!
  }

  type Notification {
    id: ID!
    title: String!
    message: String!
    type: String!
    read: Boolean!
    action: JSON
    createdAt: DateTime!
  }

  # ============================================
  # Backup & Recovery Types
  # ============================================

  type Backup {
    id: ID!
    name: String!
    type: String!
    size: Float!
    status: String!
    website: Website
    database: Database
    createdAt: DateTime!
    expiresAt: DateTime
  }

  # ============================================
  # Query Root
  # ============================================

  type Query {
    # User & Auth
    me: User!
    user(id: ID!): User
    users(limit: Int, offset: Int): [User!]!
    
    # Billing
    products(active: Boolean): [Product!]!
    product(id: ID!): Product
    subscription(id: ID!): Subscription
    subscriptions(userId: ID, status: String): [Subscription!]!
    invoice(id: ID!): Invoice
    invoices(userId: ID, status: String, limit: Int): [Invoice!]!
    
    # Hosting
    servers: [Server!]!
    server(id: ID!): Server
    websites(serverId: ID): [Website!]!
    website(id: ID!): Website
    databases(serverId: ID): [Database!]!
    database(id: ID!): Database
    domains: [Domain!]!
    domain(id: ID!): Domain
    
    # Serverless
    functions: [Function!]!
    function(id: ID!): Function
    functionInvocations(functionId: ID!, limit: Int): [FunctionInvocation!]!
    
    # Analytics
    analytics(period: String): Analytics!
    revenueMetrics(period: String): RevenueMetrics!
    customerSegments: CustomerSegments!
    
    # Support
    tickets(status: String): [Ticket!]!
    ticket(id: ID!): Ticket
    notifications(read: Boolean): [Notification!]!
    
    # Backups
    backups(websiteId: ID, databaseId: ID): [Backup!]!
    backup(id: ID!): Backup
  }

  # ============================================
  # Mutation Root
  # ============================================

  type Mutation {
    # Auth
    login(email: String!, password: String!): AuthPayload!
    register(email: String!, password: String!, name: String): AuthPayload!
    refreshToken(token: String!): AuthPayload!
    
    # Subscriptions
    createSubscription(productId: ID!, userId: ID): Subscription!
    cancelSubscription(id: ID!): Subscription!
    updateSubscription(id: ID!, status: String): Subscription!
    
    # Invoices
    payInvoice(id: ID!, paymentMethod: String!): Invoice!
    
    # Hosting
    createWebsite(domain: String!, serverId: ID!): Website!
    deleteWebsite(id: ID!): Boolean!
    createDatabase(name: String!, type: String!, serverId: ID!): Database!
    deleteDatabase(id: ID!): Boolean!
    
    # Serverless Functions
    createFunction(name: String!, runtime: String!, code: String!): Function!
    updateFunction(id: ID!, code: String, environment: JSON): Function!
    deleteFunction(id: ID!): Boolean!
    invokeFunction(id: ID!, payload: JSON): FunctionInvocation!
    
    # Support
    createTicket(subject: String!, message: String!): Ticket!
    addTicketMessage(ticketId: ID!, message: String!): TicketMessage!
    closeTicket(id: ID!): Ticket!
    
    # Notifications
    markNotificationRead(id: ID!): Notification!
    markAllNotificationsRead: Boolean!
    
    # Backups
    createBackup(websiteId: ID, databaseId: ID): Backup!
    restoreBackup(id: ID!): Boolean!
    deleteBackup(id: ID!): Boolean!
  }

  # ============================================
  # Subscription Root (Real-time)
  # ============================================

  type Subscription {
    # Real-time updates
    invoiceCreated(userId: ID): Invoice!
    subscriptionUpdated(userId: ID): Subscription!
    notificationReceived: Notification!
    serverMetricsUpdated(serverId: ID!): ServerMetrics!
    functionInvoked(functionId: ID!): FunctionInvocation!
    ticketMessageAdded(ticketId: ID!): TicketMessage!
  }
`;
