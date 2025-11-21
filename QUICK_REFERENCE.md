# mPanel Quick Reference

## Current Status: ✅ 99% READY

### What's Working Right Now
- ✅ All dependencies installed
- ✅ Frontend builds and runs
- ✅ Backend starts successfully
- ✅ All scripts created

### What's Needed
- ⚠️ Docker Desktop WSL2 integration

---

## Quick Commands

### Enable Docker (One-time setup)
1. Open Docker Desktop on Windows
2. Settings → Resources → WSL Integration  
3. Enable for Ubuntu
4. Apply & Restart

### Complete Setup
```bash
bash setup-production-ready.sh
```

### Start System
```bash
bash start-all.sh
```

### Start Individual Services
```bash
bash start-backend.sh   # Backend only
bash start-frontend.sh  # Frontend only
docker compose up -d    # Docker services only
```

### Access Points
- Frontend: http://localhost:2272
- Backend: http://localhost:2271
- Health: http://localhost:2271/api/health
- Grafana: http://localhost:2274 (admin/admin)
- Prometheus: http://localhost:2273

---

## File Locations

```
/home/bonex/MigraWeb/MigraHosting/dev/migra-panel/
├── setup-production-ready.sh    # Complete automated setup
├── quick-start.sh               # Test without Docker
├── start-all.sh                 # Start everything
├── FINAL_STEP.md                # Next steps guide
├── PRODUCTION_READY_GUIDE.md    # Full documentation
└── .env                         # Configuration (secured)
```

---

## Troubleshooting

### Docker not accessible?
```bash
# Check Docker Desktop is running
docker ps

# If error, enable WSL2 integration in Docker Desktop
```

### Port in use?
```bash
# Check what's using it
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>
```

### Permission denied?
```bash
chmod +x *.sh
```

---

## Production Deployment

When ready for live server:

```bash
# Generate secrets
bash generate-secrets.sh > secrets.txt

# Update .env with production values
nano .env

# On live server
sudo bash deploy-production.sh
```

---

## Support

- **Full Guide**: PRODUCTION_READY_GUIDE.md
- **Features**: 100_PERCENT_COMPLETE.md
- **Checklist**: DEPLOYMENT_CHECKLIST.md
- **Status**: PRODUCTION_STATUS.md

---

**Next Step**: Enable Docker WSL2, then run `bash setup-production-ready.sh`
