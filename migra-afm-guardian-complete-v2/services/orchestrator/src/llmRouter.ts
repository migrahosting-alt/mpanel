import fetch from "node-fetch";
import { z } from "zod";

// ============================================================================
// Logging Helper (matches orchestrator)
// ============================================================================

type LogLevel = "info" | "warn" | "error" | "debug";

function log(level: LogLevel, message: string, meta?: Record<string, any>) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: "llmRouter",
    level,
    msg: message,
    ...meta,
  };
  console.log(JSON.stringify(entry));
}

// ============================================================================
// Schemas and Types
// ============================================================================

const LlmDecisionSchema = z.object({
  tool: z.union([
    z.literal("dns_list_records"),
    z.literal("user_get_summary"),
    z.literal("backups_list"),
    z.literal("billing_get_invoices"),
    z.literal("billing_get_subscription"),
    z.literal("ticket_create"),
    z.literal("ticket_list"),
    z.literal("account_get_info"),
    z.null()
  ]).optional(),
  input: z.record(z.any()).optional()
});

export type DecidedTool = {
  name: "dns_list_records" | "user_get_summary" | "backups_list" | 
        "billing_get_invoices" | "billing_get_subscription" |
        "ticket_create" | "ticket_list" | "account_get_info";
  input: any;
} | null;

const DEFAULT_MODEL = process.env.LLM_MODEL || "gpt-4.1-mini";
const API_URL = process.env.LLM_API_URL || "https://api.openai.com/v1/chat/completions";
const API_KEY = process.env.LLM_API_KEY || "";

// ============================================================================
// Heuristic Fallback
// ============================================================================

function heuristicDecision(message: string, requestId?: string): DecidedTool {
  log("info", "Using heuristic decision (LLM unavailable)", { requestId });
  
  const m = message.toLowerCase();
  if (m.includes("dns") || m.includes("record") || m.includes("mx") || m.includes("spf")) {
    const domain = m.match(/[a-z0-9.-]+\.[a-z]{2,}/)?.[0] || "example.com";
    log("debug", "Heuristic matched dns_list_records", { requestId, domain });
    return { name: "dns_list_records", input: { zone: domain } };
  }
  if (m.includes("backup")) {
    const domain = m.match(/[a-z0-9.-]+\.[a-z]{2,}/)?.[0] || "example.com";
    log("debug", "Heuristic matched backups_list", { requestId, domain });
    return { name: "backups_list", input: { domain } };
  }
  if (m.includes("client") || m.includes("user") || m.includes("account")) {
    const email = m.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)?.[0] || "client@example.com";
    log("debug", "Heuristic matched user_get_summary", { requestId, query: email });
    return { name: "user_get_summary", input: { query: email } };
  }
  
  log("debug", "No heuristic match", { requestId });
  return null;
}

// ============================================================================
// LLM Decision with Timeout
// ============================================================================

type HistoryMessage = { from: "user" | "afm"; text: string };

export async function decideToolWithLLM(
  message: string,
  history: HistoryMessage[] | undefined,
  requestId?: string
): Promise<DecidedTool> {
  if (!API_KEY) {
    log("warn", "LLM_API_KEY not configured, using heuristics", { requestId });
    return heuristicDecision(message, requestId);
  }

  const systemPrompt = `
You are Abigail, the AI brain of Migra AFM Guardian.
Decide exactly one tool to call, or null.

Tools:
- "dns_list_records" with { "zone": "<domain>" } - List DNS records for a zone
- "user_get_summary" with { "query": "<email or search text>" } - Get user account summary
- "backups_list" with { "domain": "<domain>" } - List backups for a domain

Authenticated User Tools (require login):
- "billing_get_invoices" with { "status": "all|paid|unpaid|overdue", "limit": 10 } - Get user's invoices
- "billing_get_subscription" with {} - Get user's current subscription/plan
- "ticket_create" with { "subject": "...", "message": "...", "priority": "normal|high|urgent", "department": "support|billing|technical|sales" } - Create support ticket
- "ticket_list" with { "status": "all|open|closed", "limit": 10 } - List user's support tickets
- "account_get_info" with {} - Get detailed account information

Output ONLY JSON like:
{"tool":"dns_list_records","input":{"zone":"migrahosting.com"}}
or
{"tool":"billing_get_invoices","input":{"status":"unpaid","limit":5}}
or
{"tool":null,"input":{}}
`;

  const userContent = JSON.stringify({
    message,
    history: (history || []).slice(-10),
  });

  const body = {
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: systemPrompt.trim() },
      { role: "user", content: userContent },
    ],
    temperature: 0.1,
    max_tokens: 150,
  };

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    log("info", "Calling LLM for tool decision", { requestId, model: DEFAULT_MODEL });

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Check HTTP status
    if (!response.ok) {
      const errorText = await response.text();
      log("error", `LLM API HTTP ${response.status}`, { 
        requestId, 
        status: response.status, 
        error: errorText 
      });
      log("warn", "Falling back to heuristic decision", { requestId });
      return heuristicDecision(message, requestId);
    }

    const data: any = await response.json();
    const raw = data?.choices?.[0]?.message?.content?.trim();
    
    if (!raw) {
      log("warn", "LLM returned empty response", { requestId });
      return heuristicDecision(message, requestId);
    }

    // Parse LLM JSON response
    let parsed: any;
    try { 
      parsed = JSON.parse(raw); 
    } catch (parseError) {
      log("error", "LLM JSON parse failed", { requestId, response: raw });
      return heuristicDecision(message, requestId);
    }

    // Validate against schema
    const decision = LlmDecisionSchema.parse(parsed);
    
    if (!decision.tool || decision.tool === null) {
      log("info", "LLM decided no tool needed", { requestId });
      return null;
    }

    log("info", "LLM decided tool", { requestId, tool: decision.tool, input: decision.input });
    return { name: decision.tool, input: decision.input || {} };
    
  } catch (e: any) {
    clearTimeout(timeout);

    if (e.name === "AbortError") {
      log("error", "LLM API timeout after 10s", { requestId });
      log("warn", "Falling back to heuristic decision", { requestId });
      return heuristicDecision(message, requestId);
    }

    // Zod validation errors
    if (e instanceof z.ZodError) {
      log("error", "LLM response validation failed", { requestId, issues: e.errors });
      return heuristicDecision(message, requestId);
    }

    // Other errors (network, etc.)
    log("error", "LLM error", { requestId, error: e.message, stack: e.stack });
    log("warn", "Falling back to heuristic decision", { requestId });
    return heuristicDecision(message, requestId);
  }
}
