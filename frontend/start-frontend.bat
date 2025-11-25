@echo off
title mPanel Frontend - Port 3001
cd /d k:\MigraHosting\dev\migrahosting-landing\mpanel-main\mpanel-main\frontend
echo Starting mPanel Frontend on port 3001...
node node_modules/vite/bin/vite.js --port 3001
pause
