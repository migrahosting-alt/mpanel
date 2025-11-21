import express from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { promises as fs } from "fs";
import path from "path";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

const PDNS_API_URL = process.env.PDNS_API_URL;
const PDNS_API_KEY = process.env.PDNS_API_KEY;
const PDNS_SERVER_ID = process.env.PDNS_SERVER_ID || "localhost";
const BACKUPS_BASE = process.env.BACKUPS_BASE;

// ─────────────────────────────────────────────────────────────────────────────
// Structured Logging
// ─────────────────────────────────────────────────────────────────────────────
function log(
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, any>
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    service: "adapters",
    level,
    msg: message,
    ...meta,
  };
  console.log(JSON.stringify(entry));
}

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    service: "Migra AFM Guardian - Adapters",
    version: "1.0.0",
    endpoints: {
      "GET /health": "Health check",
      "GET /dns/:zone/records": "List DNS records",
      "GET /user/summary?q=...": "Get user summary",
      "GET /backups/:domain": "List domain backups"
    },
    docs: "https://github.com/migrahosting/afm-guardian"
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "adapters", env: process.env.NODE_ENV || "dev" });
});

// ─────────────────────────────────────────────────────────────────────────────
// DNS Records Adapter
// ─────────────────────────────────────────────────────────────────────────────
app.get("/dns/:zone/records", async (req, res) => {
  const zone = req.params.zone;
  
  try {
    // Validate zone parameter
    if (!zone || typeof zone !== "string" || zone.trim().length === 0) {
      log("warn", "Invalid zone parameter", { zone });
      return res.status(400).json({
        ok: false,
        error: "invalid_zone",
        detail: "Zone parameter is required and must be a valid non-empty string",
      });
    }

    // Check if PowerDNS is configured
    if (!PDNS_API_URL || !PDNS_API_KEY) {
      log("warn", "PowerDNS not configured, returning stub data", { zone });
      return res.json({
        ok: true,
        zone,
        records: [
          { name: "cp", type: "A", value: "31.220.98.95", ttl: 300 },
          { name: "mail", type: "A", value: "154.38.180.61", ttl: 300 },
          { name: "@", type: "MX", value: "mail.migrahosting.com", ttl: 300 },
        ],
      });
    }

    // Ensure zone ends with a dot for PowerDNS API
    const pdnsZone = zone.endsWith(".") ? zone : `${zone}.`;
    const url = `${PDNS_API_URL}/servers/${PDNS_SERVER_ID}/zones/${encodeURIComponent(pdnsZone)}`;

    log("info", "Fetching DNS records", { zone, pdnsZone });

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-Key": PDNS_API_KEY,
        "Accept": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Handle non-200 responses
    if (!response.ok) {
      if (response.status === 404) {
        log("warn", "Zone not found in PowerDNS", { zone, pdnsZone, status: 404 });
        return res.status(404).json({
          ok: false,
          error: "zone_not_found",
          detail: `Zone '${zone}' does not exist in PowerDNS`,
        });
      }

      if (response.status === 401 || response.status === 403) {
        log("error", "PowerDNS authentication failed", { status: response.status, zone });
        return res.status(500).json({
          ok: false,
          error: "pdns_auth_error",
          detail: "PowerDNS authentication failed. Check PDNS_API_KEY.",
        });
      }

      const errorText = await response.text();
      log("error", "PowerDNS API error", { status: response.status, zone, errorText });
      return res.status(502).json({
        ok: false,
        error: "pdns_error",
        detail: `PowerDNS returned status ${response.status}`,
      });
    }

    const data: any = await response.json();

    // Map PowerDNS RRsets to orchestrator format
    const records = (data.rrsets || []).flatMap((rrset: any) => {
      const { name, type, ttl, records: pdnsRecords } = rrset;
      
      return (pdnsRecords || []).map((record: any) => {
        const mapped: any = {
          name: name.replace(`.${pdnsZone}`, "") || "@", // Strip zone suffix
          type: type,
          value: record.content,
          ttl: ttl || 300,
        };

        // Include priority for MX records
        if (type === "MX" && record.priority !== undefined) {
          mapped.priority = record.priority;
        }

        return mapped;
      });
    });

    log("info", "Successfully fetched DNS records", { zone, recordCount: records.length });

    res.json({
      ok: true,
      zone,
      records,
    });

  } catch (e: any) {
    if (e.name === "AbortError") {
      log("error", "PowerDNS request timeout", { zone, timeoutMs: 10000 });
      return res.status(504).json({
        ok: false,
        error: "pdns_timeout",
        detail: "PowerDNS API request timed out after 10 seconds",
      });
    }

    log("error", "Error fetching DNS records", { zone, error: e?.message, stack: e?.stack });
    res.status(500).json({
      ok: false,
      error: "adapter_error",
      detail: e?.message || "Failed to fetch DNS records",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// User Summary Adapter
// ─────────────────────────────────────────────────────────────────────────────
const MPANEL_API_URL = process.env.MPANEL_API_URL;

function getMPanelUserSummaryUrl(query: string): string {
  // Helper to build mPanel summary endpoint (easy to change later)
  return `${MPANEL_API_URL}/users/summary?q=${encodeURIComponent(query)}`;
}

app.get("/user/summary", async (req, res) => {
  try {
    const q = String(req.query.q || "");

    // Validate query parameter
    if (!q || q.trim().length === 0) {
      log("warn", "Missing or empty query parameter", { query: q });
      return res.status(400).json({
        ok: false,
        error: "invalid_query",
        detail: "Query parameter 'q' is required and must be a non-empty string",
      });
    }

    if (!MPANEL_API_URL) {
      log("warn", "MPANEL_API_URL not configured, returning stub data", { query: q });
      return res.json({
        ok: true,
        user: {
          email: q,
          plans: ["Web Hosting Premium"],
          invoices: 5,
          tickets: 1,
        },
      });
    }

    const url = getMPanelUserSummaryUrl(q);
    log("info", "Calling mPanel user summary", { url, query: q });

    // Timeout pattern (10s)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorText = await response.text();
      log("error", "mPanel API error", { status: response.status, url, errorText });
      return res.status(502).json({
        ok: false,
        error: "adapter_error",
        detail: `mPanel returned status ${response.status}`,
      });
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      log("error", "Failed to parse mPanel response JSON", { url, error: e?.message });
      return res.status(502).json({
        ok: false,
        error: "adapter_error",
        detail: "Failed to parse mPanel response JSON",
      });
    }

    // Map mPanel response to orchestrator shape
    const user = {
      email: data.email || q,
      plans: Array.isArray(data.plans) ? data.plans : [],
      invoices: typeof data.invoices === "number" ? data.invoices : 0,
      tickets: typeof data.tickets === "number" ? data.tickets : 0,
    };

    log("info", "mPanel user summary fetched", { email: user.email, plans: user.plans, invoices: user.invoices, tickets: user.tickets });
    res.json({ ok: true, user });

  } catch (e: any) {
    if (e.name === "AbortError") {
      log("error", "mPanel user summary request timeout", { query: req.query.q });
      return res.status(504).json({
        ok: false,
        error: "adapter_error",
        detail: "mPanel API request timed out after 10 seconds",
      });
    }
    log("error", "Error fetching user summary", { query: req.query.q, error: e?.message, stack: e?.stack });
    res.status(500).json({
      ok: false,
      error: "adapter_error",
      detail: e?.message || "Failed to fetch user summary",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Backups List Adapter
// ─────────────────────────────────────────────────────────────────────────────
app.get("/backups/:domain", async (req, res) => {
  const domain = req.params.domain;

  try {
    // Validate domain parameter
    if (!domain || typeof domain !== "string" || domain.trim().length === 0) {
      log("warn", "Invalid domain parameter", { domain });
      return res.status(400).json({
        ok: false,
        error: "invalid_domain",
        detail: "Domain parameter is required and must be a valid non-empty string",
      });
    }

    // Sanitize domain to prevent directory traversal
    const sanitizedDomain = domain.replace(/[^a-zA-Z0-9.-]/g, "");
    if (sanitizedDomain !== domain || domain.includes("..")) {
      log("warn", "Domain contains invalid characters", { domain, sanitized: sanitizedDomain });
      return res.status(400).json({
        ok: false,
        error: "invalid_domain",
        detail: "Domain contains invalid characters",
      });
    }

    // Check if backups are configured
    if (!BACKUPS_BASE) {
      log("warn", "BACKUPS_BASE not configured, returning stub data", { domain });
      return res.json({
        ok: true,
        domain,
        backups: [
          { file: `/srv1/clients/${domain}/2025-11-10.tar.gz`, size_mb: 512, created_at: "2025-11-10T00:00:00Z" },
          { file: `/srv1/clients/${domain}/2025-11-09.tar.gz`, size_mb: 490, created_at: "2025-11-09T00:00:00Z" },
        ],
      });
    }

    const backupDir = path.join(BACKUPS_BASE, sanitizedDomain);
    log("info", "Scanning backups directory", { domain, backupDir });

    // Check if directory exists
    try {
      await fs.access(backupDir);
    } catch (e) {
      log("warn", "Backup directory not found", { domain, backupDir });
      return res.json({
        ok: true,
        domain,
        backups: [],
        message: "No backup directory found for this domain",
      });
    }

    // Read directory contents
    const files = await fs.readdir(backupDir);

    // Filter for backup files (common extensions)
    const backupExtensions = [".tar.gz", ".tgz", ".zip", ".tar", ".sql.gz", ".sql"];
    const backupFiles = files.filter((file) =>
      backupExtensions.some((ext) => file.toLowerCase().endsWith(ext))
    );

    if (backupFiles.length === 0) {
      log("warn", "No backup files found in directory", { domain, backupDir, fileCount: files.length });
      return res.json({
        ok: true,
        domain,
        backups: [],
        message: "No backup files found in directory",
      });
    }

    // Get file stats for each backup
    const backups = await Promise.all(
      backupFiles.map(async (file) => {
        const filePath = path.join(backupDir, file);
        try {
          const stats = await fs.stat(filePath);
          return {
            file: filePath,
            size_mb: Math.round((stats.size / (1024 * 1024)) * 100) / 100, // Round to 2 decimals
            created_at: stats.birthtime.toISOString(),
          };
        } catch (e: any) {
          log("error", "Error reading file stats", { filePath, error: e?.message });
          return null;
        }
      })
    );

    // Filter out any failed stat reads and sort by creation date (newest first)
    const validBackups = backups
      .filter((b) => b !== null)
      .sort((a, b) => new Date(b!.created_at).getTime() - new Date(a!.created_at).getTime());

    log("info", "Successfully scanned backup files", { domain, backupCount: validBackups.length });

    res.json({
      ok: true,
      domain,
      backups: validBackups,
    });

  } catch (e: any) {
    // Check for permission errors
    if (e.code === "EACCES") {
      log("error", "Permission denied accessing backup directory", { domain, error: e?.message });
      return res.status(500).json({
        ok: false,
        error: "permission_denied",
        detail: "Permission denied accessing backup directory",
      });
    }

    log("error", "Error scanning backups", { domain, error: e?.message, stack: e?.stack });
    res.status(500).json({
      ok: false,
      error: "adapter_error",
      detail: e?.message || "Failed to scan backup files",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Billing Adapters (Phase 3 - Authenticated Tools)
// ─────────────────────────────────────────────────────────────────────────────

const MPANEL_API_BASE = process.env.MPANEL_API_BASE || "http://localhost:3002/api";
const MPANEL_API_TOKEN = process.env.MPANEL_API_TOKEN;

app.get("/billing/invoices", async (req, res) => {
  try {
    const { userId, status = "all", limit = "10" } = req.query;

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: "missing_user_id",
        detail: "userId parameter is required"
      });
    }

    log("info", "Fetching user invoices", { userId, status, limit });

    // TODO: Wire to real mPanel API when available
    // For now, return stub data
    const stubInvoices = [
      {
        id: "inv_001",
        userId,
        amount: 29.99,
        currency: "USD",
        status: "paid",
        description: "Web Hosting - November 2025",
        created_at: "2025-11-01T00:00:00Z",
        paid_at: "2025-11-01T10:30:00Z"
      },
      {
        id: "inv_002",
        userId,
        amount: 49.99,
        currency: "USD",
        status: "unpaid",
        description: "VPS Cloud - November 2025",
        created_at: "2025-11-15T00:00:00Z",
        due_date: "2025-11-30T00:00:00Z"
      }
    ];

    const filtered = status === "all" 
      ? stubInvoices 
      : stubInvoices.filter(inv => inv.status === status);

    res.json({
      ok: true,
      invoices: filtered.slice(0, parseInt(limit as string)),
      total: filtered.length
    });

  } catch (e: any) {
    log("error", "Error fetching invoices", { error: e?.message });
    res.status(500).json({
      ok: false,
      error: "adapter_error",
      detail: e?.message || "Failed to fetch invoices"
    });
  }
});

app.get("/billing/subscription", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: "missing_user_id",
        detail: "userId parameter is required"
      });
    }

    log("info", "Fetching user subscription", { userId });

    // TODO: Wire to real mPanel API when available
    const stubSubscription = {
      id: "sub_001",
      userId,
      plan: "Business Pro",
      status: "active",
      billing_cycle: "monthly",
      amount: 29.99,
      currency: "USD",
      next_billing_date: "2025-12-01T00:00:00Z",
      features: [
        "100 GB SSD Storage",
        "Unlimited Bandwidth",
        "10 Email Accounts",
        "Free SSL Certificate"
      ]
    };

    res.json({
      ok: true,
      subscription: stubSubscription
    });

  } catch (e: any) {
    log("error", "Error fetching subscription", { error: e?.message });
    res.status(500).json({
      ok: false,
      error: "adapter_error",
      detail: e?.message || "Failed to fetch subscription"
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Ticket Adapters (Phase 3)
// ─────────────────────────────────────────────────────────────────────────────

app.post("/tickets", async (req, res) => {
  try {
    const { userId, subject, message, priority, department } = req.body;

    if (!userId || !subject || !message) {
      return res.status(400).json({
        ok: false,
        error: "missing_fields",
        detail: "userId, subject, and message are required"
      });
    }

    log("info", "Creating support ticket", { userId, subject, priority, department });

    // TODO: Wire to real mPanel API when available
    const stubTicket = {
      id: `ticket_${Date.now()}`,
      userId,
      subject,
      message,
      priority: priority || "normal",
      department: department || "support",
      status: "open",
      created_at: new Date().toISOString()
    };

    res.json({
      ok: true,
      ticket: stubTicket,
      message: "Ticket created successfully. Our team will respond within 24 hours."
    });

  } catch (e: any) {
    log("error", "Error creating ticket", { error: e?.message });
    res.status(500).json({
      ok: false,
      error: "adapter_error",
      detail: e?.message || "Failed to create ticket"
    });
  }
});

app.get("/tickets", async (req, res) => {
  try {
    const { userId, status = "open", limit = "10" } = req.query;

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: "missing_user_id",
        detail: "userId parameter is required"
      });
    }

    log("info", "Fetching user tickets", { userId, status, limit });

    // TODO: Wire to real mPanel API when available
    const stubTickets = [
      {
        id: "ticket_001",
        userId,
        subject: "Email not working",
        status: "open",
        priority: "high",
        department: "technical",
        created_at: "2025-11-15T10:00:00Z",
        updated_at: "2025-11-15T10:00:00Z"
      },
      {
        id: "ticket_002",
        userId,
        subject: "Billing question",
        status: "closed",
        priority: "normal",
        department: "billing",
        created_at: "2025-11-10T14:30:00Z",
        updated_at: "2025-11-11T09:00:00Z"
      }
    ];

    const filtered = status === "all" 
      ? stubTickets 
      : stubTickets.filter(t => t.status === status);

    res.json({
      ok: true,
      tickets: filtered.slice(0, parseInt(limit as string)),
      total: filtered.length
    });

  } catch (e: any) {
    log("error", "Error fetching tickets", { error: e?.message });
    res.status(500).json({
      ok: false,
      error: "adapter_error",
      detail: e?.message || "Failed to fetch tickets"
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Account Adapters (Phase 3)
// ─────────────────────────────────────────────────────────────────────────────

app.get("/account/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    log("info", "Fetching account info", { userId });

    // TODO: Wire to real mPanel API when available
    const stubAccount = {
      id: userId,
      email: "customer@example.com",
      first_name: "John",
      last_name: "Doe",
      company: "Example Corp",
      phone: "+1-555-0123",
      address: {
        street: "123 Main St",
        city: "San Francisco",
        state: "CA",
        zip: "94105",
        country: "US"
      },
      account_status: "active",
      customer_since: "2023-01-15T00:00:00Z",
      total_spent: 1499.99,
      active_services: 5
    };

    res.json({
      ok: true,
      account: stubAccount
    });

  } catch (e: any) {
    log("error", "Error fetching account", { error: e?.message });
    res.status(500).json({
      ok: false,
      error: "adapter_error",
      detail: e?.message || "Failed to fetch account info"
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────────────────────
const port = process.env.PORT || 8095;
app.listen(port, () => {
  log("info", "Adapters service started", { port, env: process.env.NODE_ENV || "dev" });
});
