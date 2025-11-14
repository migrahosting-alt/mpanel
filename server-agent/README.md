# mPanel Server Agent

A lightweight Node.js agent for collecting and reporting system metrics to the mPanel control panel.

## Features

- ✅ **CPU Metrics**: Usage percentage, load average (1min, 5min, 15min)
- ✅ **Memory Metrics**: Total, used, free, cached, swap
- ✅ **Disk Metrics**: Usage per mount point, I/O statistics
- ✅ **Network Metrics**: Traffic per interface (RX/TX bytes and packets)
- ✅ **Automatic Registration**: Registers with control panel on first run
- ✅ **Retry Logic**: Handles network failures gracefully
- ✅ **Lightweight**: < 50 MB memory usage, < 1% CPU usage

## Requirements

- Node.js >= 18.0.0
- Network access to mPanel control panel (HTTPS recommended)
- API key from control panel

## Installation

### Quick Start

1. **Download the agent**:
```bash
git clone <repository-url>
cd server-agent
```

2. **Install dependencies**:
```bash
npm install
```

3. **Configure the agent**:
```bash
cp config.example.json config.json
nano config.json
```

Update `config.json` with your control panel URL and API key:
```json
{
  "controlPanel": {
    "url": "https://panel.example.com",
    "apiKey": "agent_xxxxxxxxxxxxxxxx"
  }
}
```

4. **Start the agent**:
```bash
npm start
```

### Linux (systemd service)

1. Create service file `/etc/systemd/system/mpanel-agent.service`:
```ini
[Unit]
Description=mPanel Server Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mpanel-agent
ExecStart=/usr/bin/node /opt/mpanel-agent/src/agent.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

2. Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable mpanel-agent
sudo systemctl start mpanel-agent
sudo systemctl status mpanel-agent
```

3. View logs:
```bash
sudo journalctl -u mpanel-agent -f
```

### Windows (Service)

Use [node-windows](https://github.com/coreybutler/node-windows) or [NSSM](https://nssm.cc/) to run as a Windows service.

## Configuration

Edit `config.json`:

| Setting | Description | Default |
|---------|-------------|---------|
| `controlPanel.url` | Control panel URL | `http://localhost:3000` |
| `controlPanel.apiKey` | API key for authentication | Required |
| `agent.reportInterval` | Seconds between metric reports | `60` |
| `agent.enabledCollectors` | Metrics to collect | `["cpu", "memory", "disk", "network"]` |
| `logging.level` | Log level (info, debug, error) | `info` |

### Environment Variables

You can override config with environment variables:

```bash
export MPANEL_URL="https://panel.example.com"
export MPANEL_API_KEY="agent_xxxxxxxxxxxxxxxx"
export REPORT_INTERVAL=30
export LOG_LEVEL=debug

npm start
```

## Usage

### Run in development mode (with auto-reload):
```bash
npm run dev
```

### Run in production mode:
```bash
npm start
```

### Test connection:
```bash
curl http://localhost:3000/api/agent/heartbeat \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"agentId": "123", "timestamp": "2025-11-11T10:00:00Z"}'
```

## Metrics Collected

### CPU
```json
{
  "usage": 25.5,
  "cores": 8,
  "load": {
    "1min": 1.2,
    "5min": 1.5,
    "15min": 1.3
  }
}
```

### Memory
```json
{
  "total": 16384,
  "used": 8192,
  "free": 8192,
  "cached": 2048,
  "usagePercent": 50.0,
  "swap": {
    "total": 4096,
    "used": 512,
    "free": 3584
  }
}
```

### Disk
```json
{
  "disks": [
    {
      "mount": "/",
      "fs": "/dev/sda1",
      "type": "ext4",
      "total": 102400,
      "used": 51200,
      "free": 51200,
      "usagePercent": 50.0
    }
  ],
  "io": {
    "rIO": 1000,
    "wIO": 500,
    "tIO": 1500
  }
}
```

### Network
```json
{
  "interfaces": [
    {
      "name": "eth0",
      "ip4": "192.168.1.100",
      "mac": "00:11:22:33:44:55",
      "rx": {
        "bytes": 1048576,
        "packets": 1000
      },
      "tx": {
        "bytes": 524288,
        "packets": 500
      }
    }
  ],
  "totals": {
    "rxBytes": 1048576,
    "txBytes": 524288
  }
}
```

## Troubleshooting

### Agent fails to register
- Check control panel URL is accessible
- Verify API key is correct
- Check firewall allows outbound HTTPS
- Check control panel logs for errors

### Metrics not appearing
- Verify agent is registered (check `config.json` for `agentId`)
- Check network connectivity to control panel
- Review agent logs for errors
- Verify API key has correct permissions

### High resource usage
- Increase `reportInterval` to reduce frequency
- Disable unused collectors in `enabledCollectors`
- Check for system resource constraints

## Security

- **HTTPS**: Always use HTTPS in production
- **API Keys**: Keep API keys secure, rotate regularly
- **Firewall**: Allow outbound HTTPS only
- **Permissions**: Run with minimal required permissions
- **Updates**: Keep agent and dependencies updated

## Development

### Project Structure
```
server-agent/
├── package.json
├── config.json
├── src/
│   ├── agent.js           # Main agent process
│   ├── config.js          # Configuration manager
│   ├── reporter.js        # Metrics reporter
│   └── collectors/
│       ├── cpu.js         # CPU metrics collector
│       ├── memory.js      # Memory metrics collector
│       ├── disk.js        # Disk metrics collector
│       └── network.js     # Network metrics collector
└── README.md
```

### Adding Custom Collectors

1. Create a new file in `src/collectors/`:
```javascript
export async function collectCustomMetrics() {
  // Your collection logic
  return {
    metric1: value1,
    metric2: value2,
  };
}
```

2. Import in `src/agent.js`:
```javascript
import { collectCustomMetrics } from './collectors/custom.js';
```

3. Add to collection loop:
```javascript
if (enabledCollectors.includes('custom')) {
  metrics.custom = await collectCustomMetrics();
}
```

## License

MIT

## Support

For issues and feature requests, please use the GitHub issue tracker.
