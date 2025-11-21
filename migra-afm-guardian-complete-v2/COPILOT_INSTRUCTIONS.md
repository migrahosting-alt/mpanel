# Copilot Agent Instructions — Migra AFM Guardian (Abigail)

## Mission

You are working on **Migra AFM Guardian**, codename **Abigail**:
- An AI support technician for the **MigraHosting / mPanel / MigraMail** ecosystem.
- It must act like a smart human support engineer:
  - Understand user questions about hosting, DNS, email, backups, billing.
  - Decide which backend “tool” to call.
  - Execute tools safely.
  - Return helpful, human-style answers.

Primary goals:
1. **World-class chat support backend** (Gateway + Orchestrator + Tools).
2. **First-class chat UI** inside the **mPanel** control panel.
3. **Safety**: no destructive actions without explicit confirmation & guardrails.

---

## Current Architecture (this repo)

Monorepo layout:

- `infra/docker-compose.yml`
  - Spins up:
    - `gateway` on port 8080
    - `orchestrator` on port 8090
    - `adapters` on port 8095

- `services/gateway/`
  - Node + Express.
  - Public entrypoint.
  - Endpoints:
    - `GET /health`
    - `POST /chat`
  - Responsibilities:
    - Accepts chat requests from UI.
    - Requires a Bearer token (auth will be improved later).
    - Attaches `actor` (userId, roles, scopes) to the body.
    - Forwards to Orchestrator at `${ORCH_URL}/chat`.

- `services/orchestrator/`
  - Node + Express.
  - Files:
    - `src/index.ts`
    - `src/llmRouter.ts`
  - Responsibilities:
    - Validates incoming JSON with **zod**.
    - Supports two modes:
      1. **Natural language**: `{ message, history? }`
      2. **Direct tool call**: `{ toolCall: { name, input, actor } }`
    - Uses `decideToolWithLLM()` to pick a tool from a message:
      - `dns_list_records`
      - `user_get_summary`
      - `backups_list`
    - Calls internal “tools” (handlers) which in turn call the Adapters.
    - Renders a **plain-text reply** string for the user.

- `services/adapters/`
  - Node + Express.
  - Single index file with stub endpoints:
    - `GET /health`
    - `GET /dns/:zone/records`
    - `GET /user/summary?q=...`
    - `GET /backups/:domain`
  - For now these return **fake data**. They will later be wired to:
    - PowerDNS API (PDNS)
    - mPanel backend (user/accounts)
    - Filesystem backups (`/mnt/windows-backup/...`).

- `packages/types/`
  - Shared `Actor` and `ToolCall` TypeScript types.

- `packages/sdk/`
  - Placeholder SDK for future integration from other services/clients.

- `packages/widget/`
  - `index.html` — simple HTML test console that calls `POST /chat` on the gateway in:
    - Auto (LLM) mode
    - Manual tool modes

Environment:
- Node 20+
- TypeScript
- Express + zod
- OpenAI-style LLM at `LLM_API_URL` using model `LLM_MODEL` (e.g. `gpt-4.1` or `gpt-4.1-mini`).

---

## Design Principles

1. **Tools first**: All real actions (DNS, backups, users, mail, billing, etc.) must be encapsulated as **typed tools**:
   - Each tool has:
     - `schema` (zod) for validation.
     - `handler(input, ctx)` for execution.
   - Orchestrator decides which tool to call and with what input.
2. **Safety & auditability**:
   - No destructive operations (delete DNS, wipe backups, restart services) without:
     - A clear tool name like `dns_delete_record`.
     - Input schema.
     - Explicit “high-risk” flag and confirmation flow.
   - Always log decisions and tool results.
3. **Clean TypeScript**:
   - Avoid `any` when possible.
   - Strong schemas for all external inputs.
4. **Separation of concerns**:
   - Gateway = auth + routing.
   - Orchestrator = brain (LLM + tool registry + reply rendering).
   - Adapters = integration with external systems (PDNS, mPanel, mail, filesystem, etc.).
5. **Extendable**:
   - Easy to add new tools:
     - Register schema + handler.
     - Optionally describe in LLM router prompt.

---

## Immediate Tasks for Copilot

When the user asks you for help, focus on these high-priority tasks:

### 1. Backend Hardening

**In `services/orchestrator` and `services/gateway`:**

- Add structured logging (e.g. JSON logs) for:
  - Incoming requests
  - LLM decisions (`decidedTool`)
  - Tool inputs and summarized outputs
  - Errors
- Improve error handling:
  - Wrap external calls (adapters, LLM) with try/catch.
  - Return stable JSON error shapes: `{ ok: false, error, detail? }`.

### 2. Real Adapter Integration (Phase 1)

Replace stubs in `services/adapters/src/index.ts` with real logic using environment variables:

- `GET /dns/:zone/records`
  - Call PDNS API at `PDNS_API_URL` with `PDNS_API_KEY`.
  - Map PDNS zone records into the shape expected by orchestrator.

- `GET /user/summary`
  - Call mPanel backend at `MPANEL_API_URL` (e.g. `/router.php?q=status` or dedicated endpoint).
  - Return summary: `email`, `plans[]`, `invoices`, `tickets`.

- `GET /backups/:domain`
  - Scan backup directories under `BACKUPS_BASE` for the domain.
  - Return latest files with `file`, `size_mb`, `created_at`.

### 3. Add More Tools

In `services/orchestrator/src/index.ts`, extend tool registry with **new tools** such as:

- `dns_get_record`, `dns_create_record`, `dns_delete_record`
- `mail_check_status` (check if a mailbox exists / last login)
- `hosting_list_services` (list active hosting plans for a user)
- `backups_get_latest` (single latest backup file for restore)

Each tool needs:
- A zod schema
- A handler that calls an appropriate adapter endpoint
- Reply rendering in `renderReply()` so Abigail can explain results to users

### 4. LLM Router Enhancement

In `services/orchestrator/src/llmRouter.ts`:

- Expand the system prompt to describe any new tools that are added.
- Keep JSON-only responses.
- Add better examples in the prompt (MigraHosting-specific scenarios).

---

## Future Work (for follow-up tasks)

- Implement a **React chat widget** inside the mPanel frontend that talks to this backend:
  - Floating button + chat drawer.
  - Auto vs Manual tool mode.
  - Shows `reply`, `decidedTool`, and high-risk confirmation steps.

- Implement **RAG service** for knowledge base:
  - New service: `services/rag/`
  - Connect to Qdrant, ingest docs (DNS, mail server, backups, hosting, pricing).
  - Add a tool like `kb_search` for the orchestrator to call when the user asks conceptual questions.

- Implement **auth integration**:
  - Replace fake `actor` in gateway with real JWT validation.
  - Extract user info (id, roles) from mPanel tokens.

---

## Style & Conventions

- Use TypeScript with strict options.
- Prefer `async/await` and `try/catch`.
- Wrap external calls in small reusable helpers.
- Document new tools inline with comments:
  - What the tool does.
  - Required input.
  - Possible error cases.

---

## Non-Goals (for now)

- No direct database writes for billing or orders yet.
- No dangerous tools without explicit human confirmation flows.
- No UI code in this repo beyond the simple HTML test widget.

