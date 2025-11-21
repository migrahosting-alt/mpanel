# Migra AFM Guardian Integration Guide

## Overview

**Migra AFM Guardian (codename: Abigail)** is now fully integrated with mPanel as a product offering. This AI-powered support assistant can be provisioned for customers and embedded on their websites.

## What's Been Integrated

### ✅ Database Tables Created:
- `guardian_instances` - Customer Guardian instances
- `guardian_sessions` - Chat sessions
- `guardian_messages` - Conversation history
- `guardian_analytics` - Daily aggregated metrics

### ✅ Backend Services:
- **guardianService.js** - Core business logic (create/update/delete instances, logging, analytics)
- **guardianController.js** - API request handlers
- **guardianRoutes.js** - RESTful API endpoints

### ✅ API Endpoints (all under `/api/guardian`):
- `POST /instances` - Create Guardian instance
- `GET /instances` - List all instances
- `GET /instances/:id` - Get instance details
- `PUT /instances/:id` - Update instance
- `DELETE /instances/:id` - Delete instance
- `POST /instances/:id/regenerate-token` - Regenerate widget token
- `GET /instances/:id/analytics` - Get analytics
- `GET /instances/:id/sessions` - Get session history
- `GET /sessions/:sessionId/conversation` - Get conversation
- `GET /instances/:id/embed-code` - Get widget embed code

### ✅ Embeddable Widget:
- **File:** `public/guardian/widget.js`
- **Features:**
  - Floating chat bubble
  - Customizable colors, title, avatar
  - Real-time LLM-powered responses
  - Session management
  - Message history
  - Typing indicators
- **One-line integration** for customer websites

### ✅ Demo Page:
- **File:** `public/guardian/demo.html`
- **URL:** `http://localhost:2271/guardian/demo.html`
- Complete marketing page with pricing, features, live demo

### ✅ Product Plans:
Three Guardian plans auto-created in database:
1. **Starter** - $29.99/mo (1,000 messages, basic tools)
2. **Professional** - $79.99/mo (5,000 messages, all tools, voice, branding)
3. **Enterprise** - $199.99/mo (unlimited everything, white-label)

### ✅ RBAC Permissions:
- `guardian.read` - View instances and analytics
- `guardian.create` - Create new instances
- `guardian.update` - Modify configurations
- `guardian.delete` - Remove instances

Permissions granted to: super_admin, admin (all), manager (read/create/update), support (read)

---

## Setup Instructions

### 1. Run Database Migrations

```bash
# Apply Guardian product tables
docker exec mpanel-postgres psql -U mpanel -d mpanel -f /app/prisma/migrations/20251116_add_guardian_product/migration.sql

# Apply Guardian RBAC permissions
docker exec mpanel-postgres psql -U mpanel -d mpanel -f /app/prisma/migrations/20251116_add_guardian_permissions/migration.sql
```

Or use the migration script:
```bash
cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel
npm run migrate
```

### 2. Configure Guardian Backend

The Guardian backend (migra-afm-guardian-complete-v2) needs to integrate with mPanel:

**Update Guardian's `.env`:**
```env
# mPanel Integration
MPANEL_API_URL=http://localhost:2271/api
MPANEL_JWT_SECRET=your-jwt-secret

# PowerDNS Integration (if you have PDNS)
PDNS_API_URL=http://your-pdns-server:8081/api/v1
PDNS_API_KEY=your-pdns-key
PDNS_SERVER_ID=localhost

# OpenAI for LLM
LLM_API_KEY=your-openai-api-key
LLM_MODEL=gpt-4o-mini

# Gateway Configuration
PORT=8080
ALLOWED_ORIGINS=http://localhost:2271,https://migrapanel.com
```

**Start Guardian Services:**
```bash
cd migra-afm-guardian-complete-v2
docker compose -f infra/docker-compose.yml up --build -d
```

### 3. Verify Integration

**Check Guardian is running:**
```bash
curl http://localhost:8080/health
# Should return: {"status":"healthy",...}
```

**Check mPanel Guardian endpoints:**
```bash
# Get auth token first
TOKEN="your-admin-jwt-token"

# List instances (should be empty initially)
curl http://localhost:2271/api/guardian/instances \
  -H "Authorization: Bearer $TOKEN"
```

---

## Creating a Guardian Instance (Admin)

### Via API:

```bash
curl -X POST http://localhost:2271/api/guardian/instances \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-uuid",
    "instanceName": "Main Support Chat",
    "gatewayUrl": "http://localhost:8080",
    "allowedOrigins": ["https://customer-site.com"],
    "maxMessagesPerDay": 1000,
    "enableVoice": false,
    "widgetTitle": "AI Support",
    "widgetSubtitle": "Ask me anything!",
    "primaryColor": "#3b82f6",
    "assistantName": "Abigail",
    "planId": "plan-uuid",
    "monthlyPrice": 29.99
  }'
```

### Response:

```json
{
  "success": true,
  "data": {
    "id": "instance-uuid",
    "widget_token": "guardian_abc123...",
    "instance_name": "Main Support Chat",
    "gateway_url": "http://localhost:8080",
    "status": "active",
    ...
  }
}
```

---

## Embedding Widget on Customer Site

### Step 1: Get Embed Code

```bash
curl http://localhost:2271/api/guardian/instances/{instance-id}/embed-code \
  -H "Authorization: Bearer $TOKEN"
```

### Step 2: Customer Adds to Their Website

```html
<!-- Add before </body> tag -->
<script>
  window.MigraGuardianConfig = {
    token: 'guardian_abc123...',
    gatewayUrl: 'http://localhost:8080',
    title: 'AI Support',
    subtitle: 'Ask me anything!',
    primaryColor: '#3b82f6',
    assistantName: 'Abigail',
    enableVoice: false
  };
</script>
<script src="https://migrapanel.com/guardian/widget.js" async></script>
```

### Step 3: Test the Widget

- Open customer's website
- Click the chat bubble in bottom-right corner
- Ask questions like:
  - "Check DNS for example.com"
  - "Show backups for my domain"
  - "Get user info for admin@example.com"

---

## Widget Features

### Customization Options:

```javascript
window.MigraGuardianConfig = {
  // Required
  token: 'guardian_xxx',              // Widget authentication token
  gatewayUrl: 'https://...',          // Guardian gateway URL
  
  // Optional Branding
  title: 'AI Support',                // Chat header title
  subtitle: 'How can I help?',        // Chat header subtitle
  primaryColor: '#3b82f6',            // Brand color (buttons, header)
  assistantName: 'Abigail',           // AI assistant name
  avatarUrl: 'https://...',           // Custom avatar image
  
  // Optional Features
  enableVoice: false                  // Voice input/output
};
```

### Programmatic Control:

```javascript
// Open chat programmatically
window.MigraGuardian.open();

// Close chat
window.MigraGuardian.close();

// Send message programmatically
window.MigraGuardian.sendMessage('Hello!');
```

---

## Guardian Backend Tools

The Guardian orchestrator has these built-in tools:

### 1. DNS List Records
**Tool:** `dns_list_records`  
**Example:** "Check DNS for migrahosting.com"  
**Integration:** Calls PowerDNS API or mPanel DNS service

### 2. User Summary
**Tool:** `user_get_summary`  
**Example:** "Get info for client@example.com"  
**Integration:** Calls mPanel `/users/summary` endpoint

### 3. Backups List
**Tool:** `backups_list`  
**Example:** "Show backups for example.com"  
**Integration:** Scans backup directory or calls backup service

---

## Adding New Tools to Guardian

**1. Create tool in Guardian orchestrator** (`services/orchestrator/src/index.ts`):

```typescript
registerTool({
  name: "website_status",
  schema: z.object({ domain: z.string() }),
  handler: async (input, ctx) => {
    const response = await fetch(`${MPANEL_API_URL}/websites/status/${input.domain}`, {
      headers: { 'Authorization': `Bearer ${ctx.mPanelToken}` }
    });
    return await response.json();
  }
});
```

**2. Update LLM prompt** to include new tool in decision-making

**3. Restart Guardian services:**
```bash
docker compose -f infra/docker-compose.yml restart orchestrator
```

---

## Analytics & Monitoring

### View Instance Analytics:

```bash
curl "http://localhost:2271/api/guardian/instances/{id}/analytics?startDate=2025-11-01&endDate=2025-11-16" \
  -H "Authorization: Bearer $TOKEN"
```

**Returns:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2025-11-16",
      "sessions_count": 45,
      "messages_count": 230,
      "unique_users_count": 38,
      "tool_calls_count": 67,
      "avg_response_time_ms": 1250,
      "success_rate": 98.5,
      "avg_rating": 4.7,
      "total_llm_cost": 0.523
    }
  ]
}
```

### View Session History:

```bash
curl http://localhost:2271/api/guardian/instances/{id}/sessions \
  -H "Authorization: Bearer $TOKEN"
```

### View Conversation:

```bash
curl http://localhost:2271/api/guardian/sessions/{session-id}/conversation \
  -H "Authorization: Bearer $TOKEN"
```

---

## Security

### Widget Token Authentication:
- Each instance gets a unique `widget_token`
- Token is used by widget to authenticate with Guardian gateway
- Guardian gateway validates token before processing chat requests
- Tokens can be regenerated via API

### Regenerate Token:

```bash
curl -X POST http://localhost:2271/api/guardian/instances/{id}/regenerate-token \
  -H "Authorization: Bearer $TOKEN"
```

### CORS Protection:
- Configure `allowed_origins` per instance
- Gateway enforces CORS based on instance configuration
- Prevents widget embedding on unauthorized domains

---

## Billing Integration

Guardian instances are linked to mPanel plans:

```sql
SELECT 
  gi.instance_name,
  c.email as customer_email,
  p.name as plan_name,
  gi.monthly_price,
  gi.total_messages,
  gi.status
FROM guardian_instances gi
JOIN customers c ON gi.customer_id = c.id
LEFT JOIN plans p ON gi.plan_id = p.id;
```

**Usage Tracking:**
- Messages counted in real-time
- Daily analytics aggregated automatically
- Can implement usage-based billing
- Monitor for plan limit overages

---

## Troubleshooting

### Widget Not Appearing:

1. **Check token is correct:**
   ```javascript
   console.log(window.MigraGuardianConfig.token);
   ```

2. **Check Gateway URL is accessible:**
   ```bash
   curl http://localhost:8080/health
   ```

3. **Check browser console for errors**

### Chat Not Responding:

1. **Verify Guardian services are running:**
   ```bash
   docker compose -f infra/docker-compose.yml ps
   ```

2. **Check Guardian logs:**
   ```bash
   docker compose -f infra/docker-compose.yml logs -f gateway
   docker compose -f infra/docker-compose.yml logs -f orchestrator
   ```

3. **Verify LLM_API_KEY is set:**
   ```bash
   # In Guardian .env
   echo $LLM_API_KEY
   ```

### Tools Not Working:

1. **Check adapter service:**
   ```bash
   curl http://localhost:8095/health
   ```

2. **Verify PowerDNS/mPanel URLs:**
   ```bash
   # Test PDNS
   curl http://your-pdns:8081/api/v1/servers
   
   # Test mPanel
   curl http://localhost:2271/api/health
   ```

---

## Next Steps

### 1. Production Deployment:

- Deploy Guardian services to production servers
- Update `gatewayUrl` in instances to production URL
- Configure SSL/HTTPS for widget.js serving
- Set up monitoring/alerting for Guardian services

### 2. Marketing Site Integration:

- Copy `public/guardian/demo.html` to marketing site
- Update branding/colors to match marketing
- Add Guardian to product pages
- Create signup flow for Guardian plans

### 3. Customer Portal:

- Add Guardian management to mPanel admin UI
- Let customers configure widget appearance
- Show analytics dashboard
- Manage subscriptions/billing

### 4. Advanced Features:

- Add more tools (website status, ticket creation, etc.)
- Implement voice support
- Add conversation export
- Create Guardian mobile app
- Multi-language support

---

## File Locations

**mPanel Integration:**
```
src/
├── services/guardianService.js          # Business logic
├── controllers/guardianController.js    # API handlers
└── routes/guardianRoutes.js             # API routes

prisma/migrations/
├── 20251116_add_guardian_product/       # Database tables
└── 20251116_add_guardian_permissions/   # RBAC permissions

public/guardian/
├── widget.js                            # Embeddable widget
└── demo.html                            # Marketing demo page
```

**Guardian Backend:**
```
migra-afm-guardian-complete-v2/
├── services/
│   ├── gateway/          # API gateway (port 8080)
│   ├── orchestrator/     # LLM tool router (port 8090)
│   └── adapters/         # System integrations (port 8095)
├── infra/
│   └── docker-compose.yml
└── .env                  # Configuration
```

---

## Support

**Documentation:**
- Guardian Backend: `migra-afm-guardian-complete-v2/README.md`
- Guardian Copilot Instructions: `migra-afm-guardian-complete-v2/.github/copilot-instructions.md`
- mPanel API: `API_EXAMPLES.md`

**Health Check URLs:**
- Guardian Gateway: `http://localhost:8080/health`
- Guardian Orchestrator: `http://localhost:8090/health`
- Guardian Adapters: `http://localhost:8095/health`
- mPanel API: `http://localhost:2271/api/health`

---

**Last Updated:** November 16, 2025  
**mPanel Version:** 1.0.0  
**Guardian Version:** 2.0  
**Status:** ✅ Fully Integrated & Ready for Production
