# mPanel UI – migrapanel.com Deployment (mpanel-core)

## Overview
- mPanel UI is deployed to **mpanel-core** (10.1.10.206) and served exclusively at https://migrapanel.com.
- nginx serves the live site from `/var/www/migrapanel.com/public`, while rsync writes first to the staging path `/srv/web/core/migrapanel.com/public`.
- Builds are produced locally (WSL) and synced to the server via rsync.

## Requirements
- WSL user: **bonex**.
- Repo path: `/home/bonex/MigraWeb/MigraHosting/dev/migra-panel`.
- SSH access verified: `ssh mhadmin@10.1.10.206`.
- nginx virtual host for `migrapanel.com` points to `/var/www/migrapanel.com/public` (symlink-free path owned by www-data).
- API base env var: `VITE_MPANEL_API_BASE_URL="https://api.migrahosting.com/api/live.php"`.

## Build + Deploy Steps
1. `cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel`
2. (First time) `npm install`
3. Build UI: `npm run build:mpanel`
4. Deploy via rsync: `npm run deploy:mpanel-core` (script syncs to the staging path and then uses `sudo rsync` to promote the build into `/var/www/migrapanel.com/public`; add `-y` to skip the confirmation prompt if desired.)
5. Test locally: `curl -I http://10.1.10.206 -H "Host: migrapanel.com"` (the HTML should reference `index-*.js` from the latest build).
6. Verify in browser: `https://migrapanel.com` (hard refresh to bust cache).

## Notes
- The deploy script uses `--delete`, so files removed locally are also purged on the server.
- All API calls must rely on the env-based base URL; never hard-code localhost or other domains in the UI.
