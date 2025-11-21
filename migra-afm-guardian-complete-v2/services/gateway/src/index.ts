import express from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { randomUUID } from "crypto";

dotenv.config();

const app = express();

// ============================================================================
// CORS Configuration
// ============================================================================

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS;

if (ALLOWED_ORIGINS) {
  const origins = ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (origins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }));
  console.log(`[gateway] CORS restricted to: ${origins.join(", ")}`);
} else {
  // Default to allow all for development
  app.use(cors());
  console.warn("[gateway] CORS set to allow all origins (set ALLOWED_ORIGINS in production)");
}

app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

const ORCH_URL = process.env.ORCH_URL || "http://orchestrator:8090";

// ============================================================================
// Structured Logger
// ============================================================================

type LogLevel = "info" | "warn" | "error" | "debug";

function log(level: LogLevel, message: string, meta?: Record<string, any>) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: "gateway",
    level,
    msg: message,
    ...meta,
  };
  console.log(JSON.stringify(entry));
}

// ============================================================================
// Authentication Middleware
// ============================================================================

/**
/**
 * mPanel JWT Authentication Entry Point (RS256 only)
 *
 * This middleware verifies JWTs issued by the mPanel auth system using RS256 and JWT_PUBLIC_KEY.
 * On success, attaches { userId, roles, scopes } to req.actor.
 * On failure, returns 401 with standard JSON error shape.
 *
 * Only RS256 is supported for now.
 */
import { jwtVerify } from "jose";

async function requireAuth(req: any, res: any, next: any) {
  const requestId = req.requestId;
  const auth = String(req.headers.authorization || "");
  const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;

  if (!auth.startsWith("Bearer ")) {
    log("warn", "Missing or invalid Authorization header", { requestId });
    return res.status(401).json({ 
      ok: false, 
      error: "unauthorized",
      detail: "Missing or invalid Authorization header. Expected: 'Bearer <token>'",
      requestId
    });
  }

  const token = auth.substring(7);

  // DEMO MODE: Allow "demo.token" for testing when JWT_PUBLIC_KEY not configured
  if (!JWT_PUBLIC_KEY && token === "demo.token") {
    log("warn", "DEMO MODE: Accepting demo.token (configure JWT_PUBLIC_KEY for production)", { requestId });
    req.actor = { userId: "demo", roles: ["support"], scopes: ["support.read"] };
    return next();
  }

  if (!JWT_PUBLIC_KEY) {
    log("error", "JWT_PUBLIC_KEY not configured", { requestId });
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: "JWT_PUBLIC_KEY not configured",
      requestId
    });
  }

  try {
    // Import public key (PEM format)
    const publicKey = await importPublicKey(JWT_PUBLIC_KEY);
    const { payload } = await jwtVerify(token, publicKey, { algorithms: ["RS256"] });

    // Extract claims
    const userId = payload.sub || "unknown";
    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    const scopes = Array.isArray(payload.scopes) ? payload.scopes : [];

    req.actor = { userId, roles, scopes };
    next();
  } catch (e: any) {
    log("warn", "JWT verification failed", { requestId, error: e?.message });
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      detail: "Invalid or expired token",
      requestId
    });
  }
}

// Helper to import PEM public key for jose
import { importSPKI } from "jose";
async function importPublicKey(pem: string) {
  return await importSPKI(pem, "RS256");
}

// ============================================================================
// Request ID Middleware
// ============================================================================

app.use((req: any, res, next) => {
  // Use x-request-id from client if provided, otherwise generate new one
  const requestId = req.headers["x-request-id"] || randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

// ============================================================================
// Routes
// ============================================================================

app.get("/", (_req, res) => {
  res.json({
    service: "Migra AFM Guardian - Gateway",
    version: "1.0.0",
    endpoints: {
      "GET /health": "Health check",
      "POST /chat": "Chat endpoint (requires Bearer token)"
    },
    docs: "https://github.com/migrahosting/afm-guardian"
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "gateway", env: process.env.NODE_ENV || "dev" });
});

app.post("/chat", requireAuth, async (req, res) => {
  const requestId = (req as any).requestId;
  
  try {
    log("info", "Chat request received", { requestId });
    
    const actor = (req as any).actor;
    const body = {
      ...req.body,
      actor,
    };

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(ORCH_URL + "/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": String(req.headers.authorization || ""),
        "x-request-id": requestId, // Forward request ID to orchestrator
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await response.json();
    
    // Forward orchestrator's status code
    res.status(response.status).json(data);
    
    log("info", "Chat request completed", { 
      requestId, 
      status: response.status,
      mode: data.mode 
    });

  } catch (e: any) {
    if (e.name === "AbortError") {
      log("error", "Orchestrator timeout", { requestId });
      return res.status(504).json({ 
        ok: false, 
        error: "gateway_timeout",
        detail: "Orchestrator did not respond in time",
        requestId 
      });
    }

    log("error", "Gateway error", { 
      requestId, 
      error: e.message,
      stack: e.stack 
    });

    res.status(502).json({ 
      ok: false, 
      error: "bad_gateway",
      detail: "Failed to reach orchestrator",
      requestId 
    });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  log("info", `Gateway listening on :${port}`, { port });
});
