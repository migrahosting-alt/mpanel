# ============================================
# mPanel Quick Start - Production Deployment
# ============================================

## 🚀 Deploy mPanel in 30 Minutes

### Prerequisites Checklist
- [ ] Ubuntu 22.04 LTS server (4+ CPU, 8GB+ RAM, 100GB+ SSD)
- [ ] Root/sudo access
- [ ] Domain name (e.g., panel.yourdomain.com)
- [ ] Stripe account (live API keys)
- [ ] OpenAI API key (optional, for AI features)
- [ ] Email SMTP credentials

---

## Option 1: Automated Deployment (Recommended)

### Step 1: SSH into Your Server
```bash
ssh root@your-server-ip
```

### Step 2: Download and Run Deployment Script
```bash
# Download script
curl -fsSL https://raw.githubusercontent.com/migrahosting-alt/mpanel/main/deploy-production.sh -o deploy.sh

# Make executable
chmod +x deploy.sh

# Run deployment
sudo bash deploy.sh
```

### Step 3: Configure Environment
When prompted, edit `.env` file:
```bash
cd /var/www/mpanel
nano .env
```

**Replace these critical values:**
- `STRIPE_SECRET_KEY=sk_live_YOUR_KEY`
- `STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_KEY`
- `JWT_SECRET=` (64+ random characters)
- `ENCRYPTION_KEY=` (32 characters)
- `SMTP_USER=your-email@gmail.com`
- `SMTP_PASS=your-app-password`
- `ADMIN_EMAIL=admin@yourdomain.com`
- `ADMIN_PASSWORD=secure-password`
- `DOMAIN_PANEL=panel.yourdomain.com`
- `DOMAIN_API=api.yourdomain.com`

Press Enter to continue deployment.

### Step 4: Wait for Completion
The script will:
- ✅ Install Docker, Node.js, Nginx, Certbot
- ✅ Clone mPanel repository
- ✅ Start PostgreSQL, Redis, MinIO
- ✅ Run database migrations (130 tables)
- ✅ Build frontend
- ✅ Start backend with PM2
- ✅ Configure Nginx + SSL (Let's Encrypt)
- ✅ Set up firewall

**Total time: ~15-20 minutes**

---

## Option 2: Manual Deployment

### Step 1: Generate Secrets
```bash
# On your local machine or server
bash generate-secrets.sh > secrets.txt

# Review and save secrets
cat secrets.txt
```

### Step 2: Prepare Server
```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
apt install -y docker-compose-plugin

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install tools
npm install -g pm2
apt install -y nginx certbot python3-certbot-nginx git
```

### Step 3: Clone Repository
```bash
cd /var/www
git clone https://github.com/migrahosting-alt/mpanel.git
cd mpanel
```

### Step 4: Configure Environment
```bash
# Copy template
cp .env.production.template .env

# Edit with your values
nano .env
```

### Step 5: Install Dependencies
```bash
# Backend
npm install --production

# Frontend
cd frontend
npm install
cd ..
```

### Step 6: Start Infrastructure
```bash
# Start Docker services
docker compose up -d

# Wait for services
sleep 15

# Verify
docker compose ps
```

### Step 7: Database Setup
```bash
# Run migrations
npx prisma migrate deploy

# Generate client
npx prisma generate

# Create admin (if script exists)
node scripts/create-admin.js
```

### Step 8: Build Frontend
```bash
cd frontend
npm run build
cd ..
```

### Step 9: Start Backend
```bash
# Start with PM2
pm2 start src/server.js --name mpanel-backend

# Save and enable startup
pm2 save
pm2 startup
```

### Step 10: Configure Nginx
```bash
# Create config
nano /etc/nginx/sites-available/mpanel
```

Paste this configuration (replace domains):
```nginx
# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Frontend
server {
    listen 80;
    server_name panel.yourdomain.com;

    root /var/www/mpanel/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable site:
```bash
ln -s /etc/nginx/sites-available/mpanel /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Step 11: Setup SSL
```bash
certbot --nginx -d api.yourdomain.com -d panel.yourdomain.com \
    --email admin@yourdomain.com --agree-tos --redirect
```

### Step 12: Configure Firewall
```bash
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable
```

---

## Post-Deployment

### 1. Verify Installation
```bash
# Check services
docker compose ps
pm2 status
systemctl status nginx

# Test API
curl https://api.yourdomain.com/api/health
```

### 2. Configure Stripe Webhook
1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://api.yourdomain.com/api/webhooks/stripe`
3. Select events: `payment_intent.succeeded`, `customer.subscription.*`
4. Copy webhook secret to `.env` → `STRIPE_WEBHOOK_SECRET`
5. Restart backend: `pm2 restart mpanel-backend`

### 3. Access mPanel
- Frontend: `https://panel.yourdomain.com`
- API Docs: `https://api.yourdomain.com/api-docs`
- GraphQL: `https://api.yourdomain.com/graphql`
- Monitoring: `https://monitoring.yourdomain.com` (if configured)

### 4. Create First User
1. Go to `https://panel.yourdomain.com`
2. Click "Sign Up"
3. Enter email, password, name
4. Verify email (check SMTP logs if needed)
5. Login and explore dashboard

### 5. Test Critical Features
- [ ] User registration and login
- [ ] Enable 2FA (Settings → Security)
- [ ] Add payment method (use test card: 4242 4242 4242 4242)
- [ ] Create subscription
- [ ] Test WebSocket (real-time notifications)
- [ ] Try GraphQL playground
- [ ] Create a website/domain
- [ ] Upload file to MinIO

---

## Troubleshooting

### Backend Won't Start
```bash
# Check logs
pm2 logs mpanel-backend --lines 100

# Common issues:
# - Database connection: verify DATABASE_URL in .env
# - Redis connection: check REDIS_URL
# - Port in use: netstat -tlnp | grep 3000
```

### Frontend Shows Blank Page
```bash
# Check Nginx error logs
tail -f /var/log/nginx/error.log

# Verify build
ls -lh /var/www/mpanel/frontend/dist/

# Rebuild if needed
cd /var/www/mpanel/frontend
npm run build
```

### Database Connection Failed
```bash
# Check PostgreSQL
docker logs mpanel-postgres

# Test connection
docker exec -it mpanel-postgres psql -U mpanel -d mpanel_production

# Reset if needed
docker compose down -v
docker compose up -d
sleep 10
npx prisma migrate deploy
```

### SSL Certificate Issues
```bash
# Check Certbot logs
certbot certificates

# Renew manually
certbot renew --force-renewal

# Test auto-renewal
certbot renew --dry-run
```

---

## Monitoring & Maintenance

### Daily Checks
```bash
# System health
pm2 status
docker compose ps
df -h  # Disk space
free -h  # Memory

# Application logs
pm2 logs mpanel-backend --lines 50
```

### Weekly Backups
```bash
# Database backup
docker exec mpanel-postgres pg_dump -U mpanel mpanel_production > backup_$(date +%Y%m%d).sql

# Compress
gzip backup_$(date +%Y%m%d).sql

# Store securely (upload to S3, etc.)
```

### Update mPanel
```bash
cd /var/www/mpanel

# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Rebuild frontend
cd frontend
npm install
npm run build
cd ..

# Restart backend
pm2 restart mpanel-backend
```

---

## Support & Resources

- **Documentation**: See `PRODUCTION_DEPLOY_NOW.md` for detailed guide
- **GitHub**: https://github.com/migrahosting-alt/mpanel
- **API Docs**: https://api.yourdomain.com/api-docs
- **GraphQL Playground**: https://api.yourdomain.com/graphql

---

## Success Checklist

✅ All services running (PostgreSQL, Redis, MinIO, Backend)  
✅ SSL certificates active (https://)  
✅ Users can register and login  
✅ 2FA working  
✅ Stripe payments processing  
✅ Webhooks receiving events  
✅ WebSocket connections active  
✅ GraphQL accessible  
✅ API response time <100ms  
✅ No critical errors in logs  

**🎉 Congratulations! mPanel is live in production!**
