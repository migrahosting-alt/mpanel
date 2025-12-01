# mPanel – Backend Tasks Tonight (mpanel-core)

Host: **mpanel-core (10.1.10.206)**  
Path: **/opt/mpanel**

Goal: Get a STABLE backend + UI served for `https://migrapanel.com` and have
at least these working:

- Login
- Dashboard
- Users list (basic)
- Customers list (stub or basic)
- Servers list (using existing srv1 record)
- Provisioning overview (even if empty)

---

## 0. Sanity Check

```bash
ssh mhadmin@10.1.10.206
cd /opt/mpanel

ls
node -v
npm -v
```

Confirm:

Repo is present (package.json exists).

Node is v18+ (ideally v20).

1. Install Dependencies (Clean)
cd /opt/mpanel

rm -rf node_modules
npm install    # or yarn / pnpm if package.json says so


If it’s a monorepo and uses pnpm:

pnpm install

2. Verify .env
cd /opt/mpanel
cp .env.example .env   # only if .env does NOT exist

nano .env


Required keys (fill real values):

NODE_ENV=production
APP_URL=https://migrapanel.com

DATABASE_URL=postgresql://user:password@10.1.10.210:5432/mpanel_db

JWT_SECRET=change_me_to_long_random

REDIS_URL=redis://127.0.0.1:6379   # or comment out if not used yet


Save and exit.

3. Run DB Migrations + Seed

Check scripts:

cat package.json | sed -n '80,180p'


Look for things like:

migrate, db:migrate, prisma:migrate

db:seed, seed

Run what exists (examples):

npm run db:migrate        # or
npm run migrate           # or
npx prisma migrate deploy


Optional seed (if available):

npm run db:seed           # or
npx prisma db seed


If migrate fails → stop and fix (likely DB URL, missing role, etc.).

4. Build Backend (API) Code

Check for build scripts:

grep -n "build" package.json


Run:

npm run build           # recommended first
# or, if separated:
npm run build:api
npm run build:web


Goal: generate compiled JS into dist/ (or similar) without errors.

5. Start API Temporarily (Foreground) for Testing

Look at scripts:

grep -n "start:api" package.json
grep -n "start" package.json


Try:

npm run start:api
# OR
npm run dev:api
# OR
node dist/api/index.js


In another SSH window, test:

curl -i http://127.0.0.1:2271/api/health      # adjust port if needed
curl -i http://127.0.0.1:2271/api/auth/me     # should 401, not 500


If health 500s → check logs in terminal; fix before moving on.

6. Wire API to Systemd (if not already)

Create or edit /etc/systemd/system/mpanel-api.service:

```
[Unit]
Description=mPanel API Service
After=network.target

[Service]
User=mhadmin
WorkingDirectory=/opt/mpanel
Environment=NODE_ENV=production
EnvironmentFile=/opt/mpanel/.env
ExecStart=/usr/bin/node dist/api/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```


Reload + start:

sudo systemctl daemon-reload
sudo systemctl enable mpanel-api
sudo systemctl restart mpanel-api
sudo systemctl status mpanel-api --no-pager


Health check (again):

curl -i http://127.0.0.1:2271/api/health

7. Build Frontend SPA

From /opt/mpanel:

npm run build           # or npm run build:web


Identify the UI build output:

Either dist/ directly

Or apps/web/dist/

Or packages/web/dist/

Normalize it so the server expects /opt/mpanel/dist/index.html:

cd /opt/mpanel
rm -rf dist
mkdir -p dist

# Example if Vite/web is under apps/web:
cp -r apps/web/dist/* dist/

ls dist/index.html


You MUST have /opt/mpanel/dist/index.html now.

8. Restart mPanel Frontend Server

Depending on how the mPanel UI server is implemented:

If it’s served by same Node API process, nothing more to do.

If there is a separate mpanel-ui service, restart it.

Example:

sudo systemctl restart mpanel-api
# or
sudo systemctl restart mpanel-ui


Then from your local browser:

Go to https://migrapanel.com

Confirm NO ENOENT /opt/mpanel/dist/index.html error.

9. Smoke Test in Browser

Open dev tools → Network + Console.

Check routes:

/admin

Should load.

Should hit /api/auth/me once.

/admin/users

Should call /api/admin/users.

/admin/customers

Should call /api/customers.

/servers

Should call /api/servers.

/provisioning

Should call /api/provisioning/summary and /api/provisioning/tasks.

If any page is completely blank:

Check the console for React errors.

Fix components to always handle loading/error/empty states.

10. Minimum Backend Routes to Confirm

By tonight, these should return at least something (even static / fake data is OK to start):

GET /api/auth/me → current user (or 401)

GET /api/dashboard/summary → { totalRevenue, activeCustomers, activeSubscriptions }

GET /api/admin/users → array of User

GET /api/customers → array (can be empty)

GET /api/servers → includes srv1

GET /api/provisioning/summary → counters (0 is OK)

GET /api/provisioning/tasks → array (can be empty)

When these are 200 and the UI uses them correctly, mPanel is “alive” and ready to receive real provisioning logic.
