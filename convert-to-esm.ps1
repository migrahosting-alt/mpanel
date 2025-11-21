# PowerShell script to convert CommonJS to ES Modules for Phase 6 files
Write-Host "Converting Phase 6 CommonJS files to ES Modules..." -ForegroundColor Cyan

$files = @(
    "src/routes/sslRoutes.js",
    "src/routes/dnsZoneRoutes.js",
    "src/routes/backupRoutes.js",
    "src/routes/monitoringRoutes.js",
    "src/routes/appInstallerRoutes.js",
    "src/controllers/sslController.js",
    "src/controllers/dnsZoneController.js",
    "src/controllers/backupController.js",
    "src/controllers/monitoringController.js",
    "src/controllers/appInstallerController.js"
)

foreach ($file in $files) {
    Write-Host "Processing $file..." -ForegroundColor Yellow
    
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        
        # Convert requires to imports
        $content = $content -replace "const express = require\('express'\);", "import express from 'express';"
        $content = $content -replace "const pool = require\('\.\./db/pool'\);", "import pool from '../db/pool.js';"
        $content = $content -replace "const logger = require\('\.\./utils/logger'\);", "import logger from '../utils/logger.js';"
        $content = $content -replace "const crypto = require\('crypto'\);", "import crypto from 'crypto';"
        $content = $content -replace "const os = require\('os'\);", "import os from 'os';"
        $content = $content -replace "const fs = require\('fs'\);", "import fs from 'fs';"
        $content = $content -replace "const path = require\('path'\);", "import path from 'path';"
        $content = $content -replace "const \{ exec \} = require\('child_process'\);", "import { exec } from 'child_process';"
        
        # Convert controller requires to imports
        $content = $content -replace "const (\w+Controller) = require\('\.\./controllers/(\w+Controller)'\);", 'import * as $1 from ''../controllers/$2.js'';'
        $content = $content -replace "const \{ authenticate, requireAdmin \} = require\('\.\./middleware/auth'\);", "import { authenticateToken as authenticate, requireRole } from '../middleware/auth.js';"
        $content = $content -replace "const \{ authenticate \} = require\('\.\./middleware/auth'\);", "import { authenticateToken as authenticate } from '../middleware/auth.js';"
        
        # Convert exports to export const
        $content = $content -replace "exports\.(\w+) = async \(", 'export const $1 = async ('
        $content = $content -replace "exports\.(\w+) = \(", 'export const $1 = ('
        
        # Convert module.exports to export default
        $content = $content -replace "module\.exports = router;", "export default router;"
        
        # Save file
        Set-Content -Path $file -Value $content -NoNewline
        Write-Host "  ✓ Converted $file" -ForegroundColor Green
    } else {
        Write-Host "  ✗ File not found: $file" -ForegroundColor Red
    }
}

Write-Host "`nConversion complete!" -ForegroundColor Cyan
