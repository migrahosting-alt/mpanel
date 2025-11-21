@echo off
echo Starting mPanel Backend Server...
cd /d "%~dp0"
start "mPanel Backend" node src/server.js
echo Server started in background window
timeout /t 3 /nobreak >nul
echo Testing health endpoint...
curl -s http://localhost:3000/api/health
