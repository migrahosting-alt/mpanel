import express from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { z } from "zod";
import { decideToolWithLLM, DecidedTool } from "./llmRouter";
import { randomUUID } from "crypto";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

const ADAPTERS_URL = process.env.ADAPTERS_URL || "http://adapters:8095";

// ============================================================================
// Structured Logger
// ============================================================================

type LogLevel = "info" | "warn" | "error" | "debug";

function log(level: LogLevel, message: string, meta?: Record<string, any>) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: "orchestrator",
    level,
    msg: message,
    ...meta,
  };
  console.log(JSON.stringify(entry));
}

// ============================================================================
// Fetch with Timeout Helper
// ============================================================================

class ToolError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode: string,
    public detail?: string
  ) {
    super(message);
    this.name = "ToolError";
  }
}

async function fetchWithTimeout(
  url: string,
  options: any = {},
  timeoutMs: number = 10000
): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // Always parse JSON first to get error details
    const data = await response.json();

    // Check HTTP status
    if (!response.ok) {
      log("error", `HTTP ${response.status} from ${url}`, {
        status: response.status,
        error: data.error,
        detail: data.detail,
      });
      throw new ToolError(
        `Adapter returned ${response.status}`,
        response.status,
        data.error || "adapter_error",
        data.detail
      );
    }

    return data;
  } catch (e: any) {
    clearTimeout(timeout);
    
    if (e.name === "AbortError") {
      throw new ToolError(
        `Request to ${url} timed out after ${timeoutMs}ms`,
        504,
        "timeout",
        "Adapter request timed out"
      );
    }
    
    // Re-throw ToolError as-is
    if (e instanceof ToolError) {
      throw e;
    }
    
    // Network or JSON parse errors
    throw new ToolError(
      `Failed to fetch from ${url}: ${e.message}`,
      502,
      "network_error",
      e.message
    );
  }
}

// ============================================================================
// Schemas
// ============================================================================

const Actor = z.object({
  userId: z.string(),
  roles: z.array(z.string()).default([]),
  scopes: z.array(z.string()).default([]),
});

const ToolCallSchema = z.object({
  name: z.string(),
  input: z.record(z.any()).default({}),
  actor: Actor.optional(),
});

const ChatMessageSchema = z.object({
  from: z.enum(["user", "afm"]),
  text: z.string(),
});

const ChatRequestSchema = z.object({
  message: z.string().optional(),
  toolCall: ToolCallSchema.optional(),
  history: z.array(ChatMessageSchema).optional(),
  actor: Actor.optional(),
});

// ============================================================================
// Tool Registry
// ============================================================================

type ToolHandlerCtx = { 
  actor: z.infer<typeof Actor> | undefined;
  requestId: string;
};
type ToolHandler = (input: any, ctx: ToolHandlerCtx) => Promise<any>;

type Tool = {
  name: string;
  schema: z.ZodTypeAny;
  handler: ToolHandler;
};

const registry = new Map<string, Tool>();

function registerTool(tool: Tool) {
  registry.set(tool.name, tool);
}

registerTool({
  name: "dns_list_records",
  schema: z.object({ zone: z.string().min(1) }),
  handler: async (input, ctx) => {
    log("info", `Calling dns_list_records`, { 
      requestId: ctx.requestId, 
      zone: input.zone 
    });
    
    const data = await fetchWithTimeout(
      `${ADAPTERS_URL}/dns/${encodeURIComponent(input.zone)}/records`
    );
    
    log("info", `DNS records fetched`, { 
      requestId: ctx.requestId, 
      recordCount: data.records?.length || 0 
    });
    return data;
  },
});

registerTool({
  name: "user_get_summary",
  schema: z.object({ query: z.string().min(1) }),
  handler: async (input, ctx) => {
    log("info", `Calling user_get_summary`, { 
      requestId: ctx.requestId, 
      query: input.query 
    });

    const data = await fetchWithTimeout(
      `${ADAPTERS_URL}/user/summary?q=${encodeURIComponent(input.query)}`
    );

    log("info", `User summary fetched`, { 
      requestId: ctx.requestId, 
      email: data.user?.email,
      plans: data.user?.plans,
      invoices: data.user?.invoices,
      tickets: data.user?.tickets
    });
    return data;
  },
});

registerTool({
  name: "backups_list",
  schema: z.object({ domain: z.string().min(1) }),
  handler: async (input, ctx) => {
    log("info", `Calling backups_list`, { 
      requestId: ctx.requestId, 
      domain: input.domain 
    });
    
    const data = await fetchWithTimeout(
      `${ADAPTERS_URL}/backups/${encodeURIComponent(input.domain)}`
    );
    
    log("info", `Backups fetched`, { 
      requestId: ctx.requestId, 
      backupCount: data.backups?.length || 0 
    });
    return data;
  },
});

// ============================================================================
// Authenticated User Tools (Phase 3)
// ============================================================================

registerTool({
  name: "billing_get_invoices",
  schema: z.object({ 
    status: z.enum(["all", "paid", "unpaid", "overdue"]).default("all"),
    limit: z.number().default(10)
  }),
  handler: async (input, ctx) => {
    if (!ctx.actor?.userId) {
      throw new ToolError("Authentication required", 401, "auth_required");
    }
    
    log("info", `Calling billing_get_invoices`, { 
      requestId: ctx.requestId,
      userId: ctx.actor.userId,
      status: input.status
    });
    
    const data = await fetchWithTimeout(
      `${ADAPTERS_URL}/billing/invoices?userId=${ctx.actor.userId}&status=${input.status}&limit=${input.limit}`
    );
    
    log("info", `Invoices fetched`, { 
      requestId: ctx.requestId,
      count: data.invoices?.length || 0
    });
    return data;
  },
});

registerTool({
  name: "billing_get_subscription",
  schema: z.object({}),
  handler: async (input, ctx) => {
    if (!ctx.actor?.userId) {
      throw new ToolError("Authentication required", 401, "auth_required");
    }
    
    log("info", `Calling billing_get_subscription`, { 
      requestId: ctx.requestId,
      userId: ctx.actor.userId
    });
    
    const data = await fetchWithTimeout(
      `${ADAPTERS_URL}/billing/subscription?userId=${ctx.actor.userId}`
    );
    
    log("info", `Subscription fetched`, { 
      requestId: ctx.requestId,
      plan: data.subscription?.plan
    });
    return data;
  },
});

registerTool({
  name: "ticket_create",
  schema: z.object({
    subject: z.string().min(3),
    message: z.string().min(10),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    department: z.enum(["support", "billing", "technical", "sales"]).default("support")
  }),
  handler: async (input, ctx) => {
    if (!ctx.actor?.userId) {
      throw new ToolError("Authentication required", 401, "auth_required");
    }
    
    log("info", `Calling ticket_create`, { 
      requestId: ctx.requestId,
      userId: ctx.actor.userId,
      subject: input.subject,
      priority: input.priority
    });
    
    const data = await fetchWithTimeout(
      `${ADAPTERS_URL}/tickets`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: ctx.actor.userId,
          subject: input.subject,
          message: input.message,
          priority: input.priority,
          department: input.department
        })
      }
    );
    
    log("info", `Ticket created`, { 
      requestId: ctx.requestId,
      ticketId: data.ticket?.id
    });
    return data;
  },
});

registerTool({
  name: "ticket_list",
  schema: z.object({
    status: z.enum(["all", "open", "closed"]).default("open"),
    limit: z.number().default(10)
  }),
  handler: async (input, ctx) => {
    if (!ctx.actor?.userId) {
      throw new ToolError("Authentication required", 401, "auth_required");
    }
    
    log("info", `Calling ticket_list`, { 
      requestId: ctx.requestId,
      userId: ctx.actor.userId,
      status: input.status
    });
    
    const data = await fetchWithTimeout(
      `${ADAPTERS_URL}/tickets?userId=${ctx.actor.userId}&status=${input.status}&limit=${input.limit}`
    );
    
    log("info", `Tickets fetched`, { 
      requestId: ctx.requestId,
      count: data.tickets?.length || 0
    });
    return data;
  },
});

registerTool({
  name: "account_get_info",
  schema: z.object({}),
  handler: async (input, ctx) => {
    if (!ctx.actor?.userId) {
      throw new ToolError("Authentication required", 401, "auth_required");
    }
    
    log("info", `Calling account_get_info`, { 
      requestId: ctx.requestId,
      userId: ctx.actor.userId
    });
    
    const data = await fetchWithTimeout(
      `${ADAPTERS_URL}/account/${ctx.actor.userId}`
    );
    
    log("info", `Account info fetched`, { 
      requestId: ctx.requestId,
      email: data.account?.email
    });
    return data;
  },
});

// ============================================================================
// Reply Rendering
// ============================================================================

function renderReply(call: any, result: any): string {
  if (call.name === "dns_list_records" && result?.records) {
    const rows = result.records.map((r: any) => `${r.name}  ${r.type}  ${r.value}`).join("\n");
    return `I found ${result.records.length} DNS records for ${result.zone}:\n` + rows;
  }
  if (call.name === "user_get_summary" && result?.user) {
    const u = result.user;
    return [
      `Here's what I see for ${u.email}:`,
      `Plans: ${(u.plans || []).join(", ") || "none"}`,
      `Invoices: ${u.invoices}`,
      `Open tickets: ${u.tickets}`,
    ].join("\n");
  }
  if (call.name === "backups_list") {
    if (!result?.backups || result.backups.length === 0) {
      return `No backups found for ${result?.domain || "this domain"}. ${result?.message || ""}`;
    }
    
    const formatDate = (isoDate: string) => {
      const date = new Date(isoDate);
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    };
    
    const rows = result.backups.slice(0, 10).map((b: any) => {
      const fileName = b.file.split("/").pop() || b.file;
      const date = b.created_at ? formatDate(b.created_at) : "Unknown date";
      return `• ${fileName} (${b.size_mb} MB) - ${date}`;
    }).join("\n");
    
    const total = result.backups.length;
    const showing = Math.min(total, 10);
    const header = `I found ${total} backup${total !== 1 ? "s" : ""} for ${result.domain}${total > 10 ? " (showing latest 10)" : ""}:`;
    return `${header}\n${rows}`;
  }
  return "OK, I executed the tool.";
}

// ============================================================================
// Routes
// ============================================================================

app.get("/", (_req, res) => {
  res.json({
    service: "Migra AFM Guardian - Orchestrator",
    version: "1.0.0",
    endpoints: {
      "GET /health": "Health check",
      "POST /chat": "Chat endpoint (natural language or direct tool call)"
    },
    tools: Array.from(registry.keys()),
    docs: "https://github.com/migrahosting/afm-guardian"
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "orchestrator", env: process.env.NODE_ENV || "dev" });
});

app.post("/chat", async (req, res) => {
  const requestId = randomUUID();
  
  try {
    log("info", "Chat request received", { requestId, hasMessage: !!req.body.message, hasToolCall: !!req.body.toolCall });
    
    // Validate request schema
    const payload = ChatRequestSchema.parse(req.body);
    const actor = payload.actor;

    // Direct tool call mode
    if (payload.toolCall) {
      const call = ToolCallSchema.parse(payload.toolCall);
      const tool = registry.get(call.name);
      
      if (!tool) {
        log("warn", "Unknown tool requested", { requestId, toolName: call.name });
        return res.status(404).json({ 
          ok: false, 
          error: "unknown_tool",
          detail: `Tool '${call.name}' does not exist`,
          requestId 
        });
      }

      // Validate tool input
      const validated = tool.schema.parse(call.input);
      
      // Execute tool
      const result = await tool.handler(validated, { actor, requestId });
      const reply = renderReply(call, result);

      log("info", "Tool executed (direct mode)", { requestId, toolName: call.name });

      return res.json({
        ok: true,
        mode: "tool_direct",
        reply,
        toolCall: { ...call, input: validated },
        toolResult: result,
      });
    }

    // Natural language mode
    if (payload.message) {
      const history = payload.history || [];
      
      // Ask LLM to decide tool
      const decision: DecidedTool = await decideToolWithLLM(
        payload.message,
        history as any,
        requestId
      );
      
      if (!decision) {
        log("info", "No tool needed (chat only)", { requestId });
        return res.json({
          ok: true,
          mode: "chat_only",
          reply: "I can help you check DNS records, backups, and client summaries. Example: 'Check DNS for migrahosting.com'",
        });
      }
      
      const tool = registry.get(decision.name);
      if (!tool) {
        log("error", "LLM decided unknown tool", { requestId, toolName: decision.name });
        return res.status(500).json({ 
          ok: false, 
          error: "llm_error",
          detail: "LLM returned an invalid tool name",
          requestId 
        });
      }

      // Validate tool input
      const validated = tool.schema.parse(decision.input);
      
      // Execute tool
      const result = await tool.handler(validated, { actor, requestId });
      const reply = renderReply({ name: decision.name }, result);

      log("info", "Tool executed (auto mode)", { requestId, toolName: decision.name });

      return res.json({
        ok: true,
        mode: "tool_auto",
        reply,
        decidedTool: {
          name: decision.name,
          input: validated,
        },
        toolResult: result,
      });
    }

    // Neither message nor toolCall provided
    log("warn", "Empty request", { requestId });
    return res.status(400).json({ 
      ok: false, 
      error: "empty_request",
      detail: "Either 'message' or 'toolCall' must be provided",
      requestId 
    });
    
  } catch (e: any) {
    // Zod validation errors
    if (e instanceof z.ZodError) {
      log("warn", "Validation error", { requestId, issues: e.errors });
      return res.status(400).json({
        ok: false,
        error: "validation_error",
        detail: e.errors[0]?.message || "Request validation failed",
        requestId,
      });
    }

    // Tool execution errors (adapter failures, timeouts)
    if (e instanceof ToolError) {
      log("error", "Tool execution failed", { 
        requestId, 
        errorCode: e.errorCode, 
        statusCode: e.statusCode,
        detail: e.detail 
      });
      return res.status(502).json({
        ok: false,
        error: "tool_failed",
        detail: e.detail || e.message,
        requestId,
      });
    }

    // LLM errors (handled by llmRouter, should be wrapped in ToolError)
    if (e.message?.includes("LLM") || e.message?.includes("llm")) {
      log("error", "LLM error", { requestId, error: e.message });
      return res.status(503).json({
        ok: false,
        error: "llm_error",
        detail: "LLM service unavailable",
        requestId,
      });
    }

    // Unknown errors
    log("error", "Internal error", { requestId, error: e.message, stack: e.stack });
    return res.status(500).json({
      ok: false,
      error: "internal_error",
      detail: "An unexpected error occurred",
      requestId,
    });
  }
});

const port = process.env.PORT || 8090;
app.listen(port, () => {
  log("info", `Orchestrator listening on :${port}`, { port });
});
