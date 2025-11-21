# 🔐 mPanel Login Credentials

## Admin Portal Access

**URL**: http://localhost:2272/login

### Admin Account
```
Email:    admin@migrahosting.com
Password: admin123
Role:     admin
```

---

## System Status

✅ **Backend API**: http://localhost:2271 (Running)  
✅ **Frontend**: http://localhost:2272 (Running)  
✅ **GraphQL**: http://localhost:2271/graphql (Working)  
✅ **Database**: PostgreSQL on port 5433 (Healthy)  
✅ **Redis**: Port 6380 (Healthy)  
✅ **MinIO**: Port 9000 (Healthy)

---

## Quick Commands

```bash
# Start all services
bash start-mpanel.sh

# Stop all services
bash stop-mpanel.sh

# Check health
curl http://localhost:2271/api/health

# View logs
tail -f /tmp/mpanel-backend.log
tail -f /tmp/mpanel-frontend.log
```

---

## What Was Fixed

1. ✅ Redis port corrected (6388 → 6380)
2. ✅ WebSocket duplicate connection removed
3. ✅ GraphQL schema fixed (removed undefined Service type)
4. ✅ GraphQL route order fixed (404 handler moved after GraphQL init)
5. ✅ Frontend API URL configured (.env created with VITE_API_URL)
6. ✅ All hardcoded localhost:3000 URLs updated to use environment variable
7. ✅ Login page changed from "Client Portal" to "Admin Portal"
8. ✅ Admin user created in database

---

**Status**: 🟢 **READY FOR LOGIN!**

Try logging in now at: http://localhost:2272/login
