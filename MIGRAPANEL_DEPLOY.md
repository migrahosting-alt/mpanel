# mPanel UI – migrapanel.com Deployment (mpanel-core)

## Overview
- mPanel UI is deployed to **mpanel-core** and served exclusively from https://migrapanel.com.
- nginx on mpanel-core serves the site from `/srv/web/core/migrapanel.com/public`.
- Builds are produced locally (WSL) and synced to the server via rsync.

## Requirements
- WSL user: **bonex**.
- Repo path: `/home/bonex/MigraWeb/MigraHosting/dev/migra-panel`.
- SSH access verified: `ssh admin1@10.1.10.50`.
- nginx virtual host for `migrapanel.com` points to `/srv/web/core/migrapanel.com/public`.
- API base env var: `VITE_MPANEL_API_BASE_URL="https://api.migrahosting.com/api/live.php"`.

## Build + Deploy Steps
1. `cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel`
2. (First time) `npm install`
3. Build UI: `npm run build:mpanel`
4. Deploy via rsync: `npm run deploy:mpanel-core`
5. Test locally: `curl -I http://10.1.10.50 -H "Host: migrapanel.com"`
6. Verify in browser: `https://migrapanel.com`

## Notes
- The deploy script uses `--delete`, so files removed locally are also purged on the server.
- All API calls must rely on the env-based base URL; never hard-code localhost or other domains in the UI.
