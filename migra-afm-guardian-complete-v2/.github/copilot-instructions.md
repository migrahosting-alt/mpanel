# Migra AFM Guardian (Abigail) — AI Agent Instructions

## Project Overview

**Migra AFM Guardian** (codename: Abigail) is an LLM-powered support technician for the MigraHosting/mPanel hosting ecosystem. Built as a three-tier microservice architecture:

- **Gateway** (`services/gateway`, port 8080): Auth/routing layer, JWT verification (RS256), forwards `/chat` to Orchestrator
- **Orchestrator** (`services/orchestrator`, port 8090): LLM decision engine, tool registry, response rendering
- **Adapters** (`services/adapters`, port 8095): External system integrations (PowerDNS, mPanel, backups)

**Data flow**: Client → Gateway (auth) → Orchestrator (LLM tool decision) → Adapters (system calls) → Orchestrator (render reply) → Client

## Tech Stack

- **Node 20+** with TypeScript (strict mode)
- **Express** + **Zod** (schema validation)
- **OpenAI-compatible LLM** (default: gpt-4.1-mini)
- **Docker Compose** for orchestration

## Quick Start

```bash
# Setup environment
cp .env.example .env
# Edit .env: Set LLM_API_KEY (required for LLM routing)

# Build and run all services
docker compose -f infra/docker-compose.yml up --build -d

# Health checks
curl http://localhost:8080/health  # Gateway
curl http://localhost:8090/health  # Orchestrator
curl http://localhost:8095/health  # Adapters

# Test chat flow (requires Bearer token)
curl -X POST http://localhost:8080/chat \
  -H "Authorization: Bearer demo.token" \
  -H "Content-Type: application/json" \
  -d '{"message": "Check DNS for migrahosting.com"}'
```

**Local dev mode** (without Docker):
```bash
cd services/gateway && npm run dev      # Port 8080
cd services/orchestrator && npm run dev # Port 8090
cd services/adapters && npm run dev     # Port 8095
```

## Architecture Deep Dive

### Gateway Service (`services/gateway/src/index.ts`)

**Responsibilities**: Public API, JWT authentication, request forwarding

**Auth flow**:
- Supports RS256 JWT verification using `JWT_PUBLIC_KEY` env var
- Uses `jose` library (`jwtVerify`, `importSPKI`)
- Demo mode: Accepts `Bearer demo.token` when `JWT_PUBLIC_KEY` not configured
- Attaches `actor: { userId, roles, scopes }` from JWT claims to request body

**Key patterns**:
- Structured JSON logging: `log(level, message, meta)` pattern used across all services
- Request ID tracking: Uses `x-request-id` header (generated or forwarded)
- 30-second timeout for orchestrator calls with `AbortController`
- CORS configured via `ALLOWED_ORIGINS` (comma-separated)

### Orchestrator Service (`services/orchestrator/src/`)

**Core files**:
- `index.ts`: Tool registry, `/chat` endpoint, reply rendering
- `llmRouter.ts`: LLM decision logic with heuristic fallback

**Two request modes**:

1. **Natural language** (`{ message, history?, actor? }`):
   - Calls `decideToolWithLLM()` to analyze message
   - Falls back to regex heuristics if `LLM_API_KEY` missing
   - Returns: `{ ok, mode: "tool_auto", reply, decidedTool, toolResult }`

2. **Direct tool call** (`{ toolCall: { name, input, actor } }`):
   - Bypasses LLM, executes specified tool directly
   - Returns: `{ ok, mode: "tool_direct", reply, toolCall, toolResult }`

**Tool registration pattern**:
```typescript
registerTool({
  name: "tool_name",
  schema: z.object({ param: z.string() }),
  handler: async (input, ctx) => {
    const data = await fetchWithTimeout(`${ADAPTERS_URL}/endpoint`);
    return data;
  }
});
```

**Error handling**:
- Custom `ToolError` class with `statusCode`, `errorCode`, `detail`
- `fetchWithTimeout()` helper (10s default) wraps all adapter calls
- Consistent error shape: `{ ok: false, error, detail?, requestId }`

**Reply rendering**: Human-friendly text generation in `renderReply()` function
- Example: DNS records formatted as table rows, not raw JSON
- Supports Haitian Creole context (MigraHosting market)

### LLM Router (`llmRouter.ts`)

**LLM decision flow**:
1. Checks for `LLM_API_KEY` (falls back to heuristics if missing)
2. Constructs prompt with system message + message history
3. Calls OpenAI-compatible endpoint with 10s timeout
4. Validates response against `LlmDecisionSchema`
5. Returns `{ name, input }` or `null` (no tool needed)

**Heuristic fallback** (when LLM unavailable):
- Regex patterns: "dns" → `dns_list_records`, "backup" → `backups_list`, "client/user" → `user_get_summary`
- Extracts domain/email via regex from message

**Current tools**:
- `dns_list_records`: `{ zone: string }`
- `user_get_summary`: `{ query: string }`
- `backups_list`: `{ domain: string }`

### Adapters Service (`services/adapters/src/index.ts`)

**Three main adapters** (all with stub fallbacks when env vars missing):

1. **PowerDNS** (`GET /dns/:zone/records`):
   - Calls `PDNS_API_URL/servers/{PDNS_SERVER_ID}/zones/{zone}`
   - Maps PowerDNS `rrsets` to `{ name, type, value, ttl, priority? }[]`
   - Handles zone normalization (ensures trailing dot)
   - Errors: 404 (zone not found), 401/403 (auth), 504 (timeout)

2. **mPanel** (`GET /user/summary?q=...`):
   - Calls `MPANEL_API_URL/users/summary?q={query}`
   - Returns: `{ email, plans[], invoices, tickets }`
   - Stub data when `MPANEL_API_URL` missing

3. **Backups** (`GET /backups/:domain`):
   - Scans `BACKUPS_BASE/{domain}/` directory
   - Filters for: `.tar.gz`, `.tgz`, `.zip`, `.tar`, `.sql.gz`, `.sql`
   - Returns: `{ file, size_mb, created_at }[]` sorted newest-first
   - Security: Sanitizes domain to prevent path traversal

## Critical Development Patterns

### Adding New Tools (Complete Workflow)

**1. Register in orchestrator** (`services/orchestrator/src/index.ts`):
```typescript
registerTool({
  name: "new_tool_name",
  schema: z.object({ param: z.string().min(1) }),
  handler: async (input, ctx) => {
    log("info", `Calling new_tool_name`, { requestId: ctx.requestId, param: input.param });
    const data = await fetchWithTimeout(`${ADAPTERS_URL}/new-endpoint`);
    log("info", `Tool completed`, { requestId: ctx.requestId, resultCount: data.items?.length });
    return data;
  }
});
```

**2. Update LLM prompt** (`llmRouter.ts`):
- Add tool to system prompt description
- Add to `LlmDecisionSchema` union: `z.literal("new_tool_name")`
- Add heuristic pattern in `heuristicDecision()`

**3. Implement adapter endpoint** (`services/adapters/src/index.ts`):
```typescript
app.get("/new-endpoint", async (req, res) => {
  try {
    const param = req.query.param;
    // Validate, sanitize, call external API
    res.json({ ok: true, data: [...] });
  } catch (e) {
    log("error", "Adapter error", { error: e.message });
    res.status(500).json({ ok: false, error: "adapter_error", detail: e.message });
  }
});
```

**4. Add reply rendering** in `renderReply()`:
```typescript
if (call.name === "new_tool_name" && result?.items) {
  return `Found ${result.items.length} items:\n` + result.items.map(i => `• ${i.name}`).join("\n");
}
```

### Environment Configuration

**Required**:
- `LLM_API_KEY`: OpenAI API key (or compatible endpoint)

**Adapter configuration** (optional, uses stubs if missing):
- `PDNS_API_URL`, `PDNS_API_KEY`, `PDNS_SERVER_ID`: PowerDNS integration
- `MPANEL_API_URL`: mPanel backend API
- `BACKUPS_BASE`: Filesystem path for backup scans

**Auth**:
- `JWT_PUBLIC_KEY`: RS256 public key (PEM format) for token verification
- Demo mode active when missing (accepts `demo.token`)

**Docker Compose reads root `.env`** — service-level `.env` files are for local dev only

### Error Handling Standards

**All services return consistent shape**:
```typescript
{ ok: false, error: "error_code", detail?: "Human message", requestId?: "uuid" }
```

**Common error codes**:
- `validation_error`: Zod schema validation failed
- `tool_failed`: Adapter call failed/timed out
- `llm_error`: LLM API unavailable
- `unauthorized`: JWT verification failed
- `timeout`: Request exceeded deadline
- `adapter_error`: Generic adapter failure

**Always wrap external calls** in try/catch with timeout via `AbortController`

### Logging Conventions

**Structured JSON logs** across all services:
```typescript
log("info", "Request received", { requestId, userId: actor?.userId, toolName: "dns_list_records" });
```

**Log levels**:
- `info`: Normal operation (requests, tool calls, completions)
- `warn`: Recoverable issues (LLM fallback, missing config, stub data used)
- `error`: Failures (adapter errors, timeouts, auth failures, stack traces included)
- `debug`: Heuristic matches, detailed LLM decisions

**View logs**: `docker compose -f infra/docker-compose.yml logs -f [service-name]`

## Testing & Debugging

**Widget testing**: Open `packages/widget/index.html` in browser for interactive testing
- Auto mode (LLM decides tool)
- Manual mode (select tool directly)
- Shows full response: `reply`, `decidedTool`, `toolResult`

**Curl examples**:
```bash
# Natural language (via gateway)
curl -X POST http://localhost:8080/chat \
  -H "Authorization: Bearer demo.token" \
  -d '{"message": "Show backups for example.com"}'

# Direct tool call (orchestrator)
curl -X POST http://localhost:8090/chat \
  -d '{"toolCall": {"name": "dns_list_records", "input": {"zone": "example.com"}}}'
```

**Common issues**:
- **Missing LLM_API_KEY**: Orchestrator falls back to regex heuristics (limited intelligence)
- **Port conflicts**: Ensure 8080, 8090, 8095 available before `docker compose up`
- **CORS errors**: Check `ALLOWED_ORIGINS` configuration in gateway
- **Stub data**: Check logs for "not configured, returning stub data" warnings

## Immediate Priority Tasks

### 1. Backend Hardening
- Expand structured logging: Add stack traces to all error logs
- Implement rate limiting (Redis-based)
- Add metrics collection (Prometheus format)

### 2. Real Adapter Integration
**PowerDNS** is production-ready (see `services/adapters/src/index.ts` lines 50-150)

**mPanel** needs implementation:
- Actual endpoint format unknown (currently calls `/users/summary?q=...`)
- May need to use `/router.php?q=status` or custom endpoint
- Verify response shape matches `{ email, plans[], invoices, tickets }`

**Backups** filesystem scanning is implemented, needs:
- Verification of `BACKUPS_BASE` structure on production servers
- Possibly add SFTP/S3 support for remote backups

### 3. New Tools to Add
- `dns_create_record`, `dns_delete_record` (requires high-risk confirmation flow)
- `mail_check_status` (mailbox existence, last login)
- `hosting_list_services` (active hosting plans)
- `kb_search` (future RAG integration with Qdrant)

### 4. Auth Improvements
- Validate JWT issuer/audience claims
- Add role-based access control (RBAC) for sensitive tools
- Implement audit logging to PostgreSQL

## Integration Points

**Planned external systems** (env vars configured, not yet integrated):
- `POSTGRES_URL`: Audit logging, session storage
- `REDIS_URL`: Caching, rate limiting, session management
- `QDRANT_URL`: Vector database for RAG/knowledge base
- `MINIO_ENDPOINT`: Backup storage/retrieval (S3-compatible)
- `MAIL_API_URL`: Mailbox management API

**Service communication**: Synchronous HTTP via `node-fetch` (no message queues)

## Design Principles

1. **Tools-first architecture**: All actions encapsulated as validated, typed tools
2. **Safety by default**: No destructive operations without explicit high-risk flags
3. **Fail gracefully**: LLM unavailable → heuristics; adapter down → clear error
4. **Clean TypeScript**: Avoid `any`, strong Zod schemas, strict compiler options
5. **Separation of concerns**: Gateway (auth) | Orchestrator (brain) | Adapters (integrations)

## Non-Goals (Current Phase)

- No direct database writes for billing/orders
- No WebSocket/real-time support (REST-only)
- No UI code beyond test widget (`packages/widget/index.html`)
- No complex confirmation flows yet (needed for destructive tools)
