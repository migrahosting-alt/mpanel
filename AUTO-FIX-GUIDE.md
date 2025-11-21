# mPanel Auto-Fix & Recovery System

## 🚀 Quick Start

### Automatic Mode (Recommended)
```bash
./auto-fix.sh --auto
```
This will automatically detect and fix any issues with your mPanel installation.

### Interactive Mode
```bash
./auto-fix.sh
```
Shows a menu with all available options.

---

## 📋 Features

### 1️⃣ **Smart Auto-Fix** (Recommended)
Automatically detects and fixes issues:
- ✅ Database connectivity
- ✅ Redis connectivity  
- ✅ Backend server (Node.js)
- ✅ Frontend server (Vite)
- ✅ Port conflicts
- ✅ Missing dependencies
- ✅ Corrupted node_modules

**Usage:**
```bash
./auto-fix.sh --auto
```

### 2️⃣ **Component-Specific Fixes**

#### Fix Backend Only
```bash
./auto-fix.sh
# Then select option 2
```
Fixes:
- Kills stuck Node.js processes
- Clears port 2271
- Reinstalls dependencies if needed
- Restarts backend server
- Verifies health

#### Fix Frontend Only
```bash
./auto-fix.sh
# Then select option 3
```
Fixes:
- Kills stuck Vite processes
- Clears port 2272
- Clears Vite cache
- Reinstalls dependencies if needed
- Restarts frontend server

#### Fix Database
```bash
./auto-fix.sh
# Then select option 4
```
Restarts PostgreSQL container and verifies connectivity.

#### Fix Redis
```bash
./auto-fix.sh
# Then select option 5
```
Restarts Redis container and verifies connectivity.

### 3️⃣ **Health Check**
```bash
./auto-fix.sh
# Then select option 6
```
Checks all components without making changes:
- PostgreSQL (mpanel-postgres)
- Redis (mpanel-redis)
- Backend (localhost:2271)
- Frontend (localhost:2272)

### 4️⃣ **Nuclear Rebuild** ☢️
```bash
./auto-fix.sh
# Then select option 7
```
**⚠️ WARNING: This resets EVERYTHING**

Steps performed:
1. Creates backup
2. Kills all Node.js/Vite processes
3. Deletes all node_modules
4. Restarts all Docker containers
5. Reinstalls all dependencies
6. Starts backend and frontend

**Use when:**
- Everything is broken
- Dependency hell
- After major updates
- Last resort

### 5️⃣ **Automatic Backups**
Before any fix, the system automatically backs up:
- `node_modules` directory listing
- Backend logs
- Frontend logs
- `package-lock.json` files

**Backup location:** `/tmp/mpanel-backups/`

**View backups:**
```bash
./auto-fix.sh
# Then select option 9
```

### 6️⃣ **View Logs**
```bash
./auto-fix.sh
# Then select option 8
```
Shows recent logs from:
- Backend: `/tmp/mpanel-backend.log`
- Frontend: `/tmp/mpanel-frontend.log`

---

## 🎯 Common Scenarios

### Scenario 1: "Page not found / 404 Error"
**Cause:** Frontend server is down

**Fix:**
```bash
./auto-fix.sh --auto
```
Or manually:
```bash
./auto-fix.sh
# Select option 3 (Fix Frontend Only)
```

### Scenario 2: "Failed to fetch / API errors"
**Cause:** Backend server is down

**Fix:**
```bash
./auto-fix.sh --auto
```
Or manually:
```bash
./auto-fix.sh
# Select option 2 (Fix Backend Only)
```

### Scenario 3: "Database connection error"
**Cause:** PostgreSQL container is down

**Fix:**
```bash
./auto-fix.sh --auto
```

### Scenario 4: "Port already in use"
**Cause:** Old processes still running

**Fix:**
```bash
./auto-fix.sh --auto
```
The script automatically kills processes on ports 2271 and 2272.

### Scenario 5: "Module not found / Dependencies missing"
**Cause:** Corrupted node_modules

**Fix:**
```bash
./auto-fix.sh
# Select option 2 (Fix Backend) or 3 (Fix Frontend)
```
The script will detect missing dependencies and reinstall.

### Scenario 6: "Everything is broken"
**Fix:**
```bash
./auto-fix.sh
# Select option 7 (Nuclear Rebuild)
# Type "yes" to confirm
```

---

## 🔍 Manual Health Checks

### Check Backend
```bash
curl http://localhost:2271/api/health
# Should return: {"status":"ok","features":[...]}
```

### Check Frontend
```bash
curl -I http://localhost:2272
# Should return: HTTP/1.1 200 OK
```

### Check Database
```bash
docker exec mpanel-postgres pg_isready -U mpanel
# Should return: accepting connections
```

### Check Redis
```bash
docker exec mpanel-redis redis-cli ping
# Should return: PONG
```

### Check Running Processes
```bash
ps aux | grep -E 'node.*server|vite' | grep -v grep
```

### Check Ports
```bash
lsof -i :2271 -i :2272 | grep LISTEN
```

---

## 🛠️ Advanced Usage

### Schedule Auto-Fix (Cron Job)
Run auto-fix every 30 minutes:
```bash
crontab -e

# Add this line:
*/30 * * * * cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel && ./auto-fix.sh --auto >> /tmp/mpanel-autofix-cron.log 2>&1
```

### Create Custom Recovery Script
```bash
#!/bin/bash
# my-custom-recovery.sh

# Use auto-fix as a library
source /home/bonex/MigraWeb/MigraHosting/dev/migra-panel/auto-fix.sh

# Run specific checks
check_backend || fix_backend
check_frontend || fix_frontend

# Custom logic here
echo "Recovery complete!"
```

### Monitoring Integration
Add to your monitoring system:
```bash
# Prometheus/Nagios health check
./auto-fix.sh --auto
exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo "OK: mPanel healthy"
    exit 0
else
    echo "CRITICAL: mPanel unhealthy"
    exit 2
fi
```

---

## 📊 What Gets Fixed

| Issue | Detection | Auto-Fix |
|-------|-----------|----------|
| Backend down | Health endpoint check | Kill process, restart |
| Frontend down | HTTP check | Kill Vite, clear cache, restart |
| Port conflicts | `lsof` check | Kill conflicting process |
| Missing dependencies | Check `node_modules` | `npm install` |
| Database down | `pg_isready` | Restart container |
| Redis down | `redis-cli ping` | Restart container |
| Corrupted cache | Heuristic | Clear `.vite` directory |
| Stuck processes | Process check | `pkill` |

---

## 🔔 Notifications

### Slack Webhook (Optional)
Add to `auto-fix.sh` after line 50:

```bash
send_slack_notification() {
    local message="$1"
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🔧 mPanel Auto-Fix: $message\"}" \
        YOUR_SLACK_WEBHOOK_URL
}

# Use it:
send_slack_notification "Backend was down, automatically recovered"
```

### Email Alerts (Optional)
```bash
send_email_alert() {
    local subject="$1"
    local body="$2"
    echo "$body" | mail -s "$subject" admin@migrahosting.com
}
```

---

## 📝 Logs

All logs are stored in `/tmp/`:
- **Auto-fix log:** `/tmp/mpanel-autofix.log`
- **Backend log:** `/tmp/mpanel-backend.log`
- **Frontend log:** `/tmp/mpanel-frontend.log`
- **Backups:** `/tmp/mpanel-backups/`

### View Real-time Logs
```bash
# Backend
tail -f /tmp/mpanel-backend.log

# Frontend
tail -f /tmp/mpanel-frontend.log

# Auto-fix
tail -f /tmp/mpanel-autofix.log
```

---

## 🚨 Troubleshooting

### Script Won't Run
```bash
chmod +x auto-fix.sh
```

### Docker Containers Not Found
```bash
# Start Docker services first
docker compose up -d
```

### Permission Denied on Ports
```bash
# Run with sudo (only if needed)
sudo ./auto-fix.sh --auto
```

### Script Hangs
Press `Ctrl+C` and check:
```bash
ps aux | grep auto-fix
# Kill if needed
pkill -f auto-fix
```

---

## 💡 Best Practices

1. **Run auto-fix before making changes**
   ```bash
   ./auto-fix.sh --auto
   ```

2. **Check logs after fixes**
   ```bash
   tail -50 /tmp/mpanel-backend.log
   tail -50 /tmp/mpanel-frontend.log
   ```

3. **Keep backups**
   - Backups are automatic
   - Clean old backups monthly: `rm /tmp/mpanel-backups/*_old_*`

4. **Monitor regularly**
   - Set up cron job for auto-fix
   - Check logs weekly

5. **Nuclear rebuild sparingly**
   - Only use when necessary
   - Takes 3-5 minutes
   - Always backed up first

---

## 🎓 Understanding the System

### What Happens During Auto-Fix?

1. **Health Checks** (5 seconds)
   - Ping all services
   - Check ports
   - Verify processes

2. **Issue Detection** (instant)
   - Identify failed components
   - Log issues

3. **Backup Creation** (5-10 seconds)
   - Snapshot current state
   - Save logs
   - Record package state

4. **Recovery** (30-60 seconds per component)
   - Kill stuck processes
   - Clear conflicts
   - Reinstall if needed
   - Restart services

5. **Verification** (15 seconds)
   - Re-run health checks
   - Confirm all green

**Total time:** 1-3 minutes (typical)

### Recovery Order (Important!)
The script fixes components in dependency order:
1. Database (PostgreSQL) - Others depend on this
2. Redis - Session storage
3. Backend - API server
4. Frontend - UI server

This ensures dependencies are satisfied.

---

## 🆘 Support

If auto-fix doesn't resolve your issue:

1. **Check the logs:**
   ```bash
   ./auto-fix.sh
   # Option 8 (View Logs)
   ```

2. **Try nuclear rebuild:**
   ```bash
   ./auto-fix.sh
   # Option 7 (Nuclear Rebuild)
   ```

3. **Manual recovery:**
   ```bash
   # Stop everything
   pkill -f node
   pkill -f vite
   docker compose down
   
   # Clean install
   rm -rf node_modules frontend/node_modules
   npm install
   cd frontend && npm install && cd ..
   
   # Restart
   docker compose up -d
   npm run dev &
   cd frontend && npm run dev &
   ```

4. **Contact support:**
   - Check GitHub issues: https://github.com/migrahosting-alt/mpanel
   - Email: admin@migrahosting.com

---

## 📦 What's Next?

After auto-fix completes successfully:

1. **Access mPanel:**
   - Frontend: http://localhost:2272
   - Backend API: http://localhost:2271

2. **Login:**
   - Email: admin@migrahosting.com
   - Password: admin123

3. **Test Guardian AI:**
   - Go to Administration → Guardian AI
   - Click "Create Instance"
   - Select customer and configure
   - Create!

---

**Last Updated:** November 18, 2025
**Version:** 1.0.0
**Maintainer:** MigraHosting Team
