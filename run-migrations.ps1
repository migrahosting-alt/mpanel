#!/usr/bin/env pwsh
# Run all database migrations

$ErrorActionPreference = "Stop"
$MIGRATIONS_DIR = ".\prisma\migrations"

Write-Host "=== Starting Database Migrations ===" -ForegroundColor Cyan

# Create migrations tracking table
Write-Host "`nCreating _migrations table..." -ForegroundColor Yellow
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "CREATE TABLE IF NOT EXISTS _migrations (id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, executed_at TIMESTAMP DEFAULT NOW());" | Out-Null

# Get list of executed migrations
$executedMigrations = docker exec mpanel-postgres psql -U mpanel -d mpanel -t -c "SELECT name FROM _migrations;"
$executed = @()
if ($executedMigrations) {
    $executed = $executedMigrations -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
}

# Get all migration directories
$migrationDirs = Get-ChildItem -Path $MIGRATIONS_DIR -Directory | Sort-Object Name

$executedCount = 0
$skippedCount = 0

foreach ($dir in $migrationDirs) {
    $migrationName = $dir.Name
    $migrationFile = Join-Path $dir.FullName "migration.sql"
    
    if ($executed -contains $migrationName) {
        Write-Host "Skipping $migrationName (already executed)" -ForegroundColor Gray
        $skippedCount++
        continue
    }
    
    if (-not (Test-Path $migrationFile)) {
        Write-Host "Migration file not found: $migrationFile" -ForegroundColor Yellow
        continue
    }
    
    Write-Host "Running $migrationName..." -ForegroundColor Green
    
    try {
        # Copy migration file to container
        docker cp $migrationFile mpanel-postgres:/tmp/migration.sql | Out-Null
        
        # Execute migration in a transaction
        docker exec mpanel-postgres psql -U mpanel -d mpanel -c "BEGIN;" | Out-Null
        docker exec mpanel-postgres psql -U mpanel -d mpanel -f /tmp/migration.sql
        docker exec mpanel-postgres psql -U mpanel -d mpanel -c "INSERT INTO _migrations (name) VALUES ('$migrationName');" | Out-Null
        docker exec mpanel-postgres psql -U mpanel -d mpanel -c "COMMIT;" | Out-Null
        
        Write-Host "Completed $migrationName" -ForegroundColor Green
        $executedCount++
    }
    catch {
        Write-Host "Failed to execute $migrationName" -ForegroundColor Red
        docker exec mpanel-postgres psql -U mpanel -d mpanel -c "ROLLBACK;" | Out-Null
        Write-Error $_.Exception.Message
        exit 1
    }
}

Write-Host "`n=== Migration Summary ===" -ForegroundColor Cyan
Write-Host "Executed: $executedCount" -ForegroundColor Green
Write-Host "Skipped: $skippedCount" -ForegroundColor Gray
Write-Host "Total: $($migrationDirs.Count)" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
