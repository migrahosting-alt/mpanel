# Server Agent Architecture

**Date**: November 11, 2025  
**Purpose**: Design document for mPanel server monitoring agent  
**Status**: Draft

---

## 1. Architecture Decision: Pull-Based vs Push-Based

### Selected: **Push-Based (Agent → Control Panel)**

**Rationale**:
- ✅ Agents can operate behind NAT/firewalls
- ✅ No need to expose agent ports publicly
- ✅ Simpler firewall configuration on customer servers
- ✅ Agent controls reporting frequency
- ✅ Control panel doesn't need to know all agent IPs upfront

**How It Works**:
1. Agent runs on customer server (background service)
2. Agent collects metrics every 60 seconds
3. Agent pushes metrics to control panel API via HTTPS
4. Control panel stores metrics in time-series database
5. Dashboard queries metrics for visualization

---

## 2. Metrics to Collect

### System Metrics
- **CPU**: Usage percentage, load average (1min, 5min, 15min)
- **Memory**: Total, used, free, available, cached
- **Disk**: Total space, used space, free space, I/O stats (per mount point)
- **Network**: Bytes sent/received, packets sent/received (per interface)

### Process Metrics (Optional)
- Running processes count
- Top CPU consumers (top 5)
- Top memory consumers (top 5)

### Service Metrics
- PostgreSQL: Connection count, database sizes
- Nginx/Apache: Active connections, requests/sec
- Redis: Memory usage, connected clients
- Docker: Container count, running containers

---

## 3. Agent Components

### Core Files
```
server-agent/
├── package.json
├── src/
│   ├── agent.js           # Main agent process
│   ├── collectors/
│   │   ├── cpu.js         # CPU metrics
│   │   ├── memory.js      # Memory metrics
│   │   ├── disk.js        # Disk metrics
│   │   ├── network.js     # Network metrics
│   │   └── services.js    # Service-specific metrics
│   ├── reporter.js        # Sends metrics to control panel
│   ├── config.js          # Configuration management
│   └── auth.js            # API key authentication
├── config.example.json    # Example configuration
├── install.sh             # Installation script (Linux)
└── README.md              # Documentation
```

---

## 4. Authentication Flow

### API Key-Based Authentication

**Registration**:
1. Admin creates server in control panel
2. Control panel generates unique API key for server
3. Admin downloads agent installer with embedded API key
4. Agent uses API key in Authorization header

**Authentication Header**:
```
Authorization: Bearer <agent_api_key>
```

**Security**:
- API keys stored hashed in database (bcrypt)
- HTTPS required for all communication
- Keys can be rotated via control panel
- Failed auth attempts logged and rate-limited

---

## 5. API Endpoints

### Control Panel → Agent (not exposed, agent runs locally)
- No inbound connections required

### Agent → Control Panel
```
POST /api/agent/register
- Register agent on first run
- Body: { hostname, os, arch, version }
- Response: { serverId, registered: true }

POST /api/agent/metrics
- Submit collected metrics
- Body: { serverId, timestamp, metrics: {...} }
- Response: { received: true, nextReportIn: 60 }

POST /api/agent/heartbeat
- Quick health check (lightweight)
- Body: { serverId, timestamp }
- Response: { status: 'ok' }

GET /api/agent/config
- Fetch agent configuration from control panel
- Response: { reportInterval: 60, metricsEnabled: [...] }
```

---

## 6. Data Flow

```
┌─────────────────┐
│ Customer Server │
│                 │
│  ┌───────────┐  │
│  │   Agent   │  │
│  │           │  │
│  │ Collects: │  │
│  │ - CPU     │  │
│  │ - Memory  │  │
│  │ - Disk    │  │
│  │ - Network │  │
│  └─────┬─────┘  │
└────────┼────────┘
         │ HTTPS POST
         │ /api/agent/metrics
         │ (every 60s)
         ▼
┌─────────────────┐
│ Control Panel   │
│                 │
│  ┌───────────┐  │
│  │ Agent API │  │
│  └─────┬─────┘  │
│        │        │
│  ┌─────▼─────┐  │
│  │PostgreSQL │  │
│  │(metrics)  │  │
│  └─────┬─────┘  │
│        │        │
│  ┌─────▼─────┐  │
│  │ Dashboard │  │
│  │  (Charts) │  │
│  └───────────┘  │
└─────────────────┘
```

---

## 7. Metrics Storage Schema

### Database Tables

**servers_agents**:
```sql
CREATE TABLE servers_agents (
  id SERIAL PRIMARY KEY,
  server_id INTEGER REFERENCES servers(id),
  hostname VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  os VARCHAR(50),
  arch VARCHAR(50),
  agent_version VARCHAR(20),
  api_key_hash TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  last_seen TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**server_metrics**:
```sql
CREATE TABLE server_metrics (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER REFERENCES servers_agents(id),
  timestamp TIMESTAMP NOT NULL,
  cpu_usage DECIMAL(5,2),
  cpu_load_1min DECIMAL(5,2),
  cpu_load_5min DECIMAL(5,2),
  cpu_load_15min DECIMAL(5,2),
  memory_total BIGINT,
  memory_used BIGINT,
  memory_free BIGINT,
  memory_cached BIGINT,
  disk_total BIGINT,
  disk_used BIGINT,
  disk_free BIGINT,
  network_rx_bytes BIGINT,
  network_tx_bytes BIGINT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_server_metrics_agent_timestamp 
ON server_metrics(agent_id, timestamp DESC);
```

---

## 8. Agent Configuration

**config.json**:
```json
{
  "controlPanel": {
    "url": "https://panel.example.com",
    "apiKey": "agent_xxxxxxxxxxxxxxxx"
  },
  "agent": {
    "reportInterval": 60,
    "hostname": "auto-detect",
    "enabledCollectors": [
      "cpu",
      "memory",
      "disk",
      "network"
    ]
  },
  "logging": {
    "level": "info",
    "file": "/var/log/mpanel-agent.log"
  }
}
```

---

## 9. Installation Process

### Linux (systemd)
```bash
# Download agent
curl -O https://panel.example.com/downloads/mpanel-agent.tar.gz

# Extract
tar xzf mpanel-agent.tar.gz
cd mpanel-agent

# Install
sudo ./install.sh --api-key=<your_api_key>

# Start service
sudo systemctl start mpanel-agent
sudo systemctl enable mpanel-agent

# Check status
sudo systemctl status mpanel-agent
```

### Windows (Service)
```powershell
# Download agent installer
Invoke-WebRequest -Uri "https://panel.example.com/downloads/mpanel-agent-setup.exe" -OutFile "mpanel-agent-setup.exe"

# Run installer
.\mpanel-agent-setup.exe /APIKEY=<your_api_key> /SILENT

# Check service
Get-Service mpanel-agent
```

---

## 10. Error Handling

### Agent Side
- Retry failed metric submissions (exponential backoff)
- Log errors to local file
- Continue collecting metrics even if submission fails
- Buffer metrics locally if control panel is unreachable (max 1 hour)

### Control Panel Side
- Validate metrics payload schema
- Reject invalid/malformed data
- Mark agent as offline after 5 minutes of no heartbeat
- Alert admin if critical servers go offline

---

## 11. Security Considerations

✅ **Transport Security**:
- HTTPS only (TLS 1.2+)
- Certificate pinning (optional)

✅ **Authentication**:
- API keys with bcrypt hashing
- Rate limiting on auth endpoints
- Key rotation support

✅ **Authorization**:
- Agent can only submit metrics for its own server
- Agent cannot access other servers' data

✅ **Data Protection**:
- No sensitive data in metrics (passwords, keys)
- Minimal system information exposure

---

## 12. Performance Targets

- **Collection Time**: < 1 second
- **Submission Time**: < 500ms
- **Memory Usage**: < 50 MB
- **CPU Usage**: < 1% average
- **Network Bandwidth**: < 5 KB/min

---

## 13. Next Steps

1. ✅ Create agent project structure
2. ⏳ Implement CPU/memory/disk collectors
3. ⏳ Implement metrics reporter
4. ⏳ Create control panel API endpoints
5. ⏳ Build agent installer scripts
6. ⏳ Test on local machine
7. ⏳ Add dashboard visualization

---

*Last Updated: November 11, 2025*
