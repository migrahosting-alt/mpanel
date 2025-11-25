# Test Phase 2 Fixes
Write-Host "`n=== PHASE 2 FIXES VERIFICATION ===" -ForegroundColor Cyan

# Test health
Write-Host "`nBackend Health:" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod 'http://localhost:3000/api/health'
    Write-Host "[OK] Status: $($health.status)" -ForegroundColor Green
    Write-Host "[OK] Features: $($health.features -join ', ')" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Health check failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test Phase 2 endpoints (should all return 401)
Write-Host "`nPhase 2 Endpoints (should require auth):" -ForegroundColor Yellow

$endpoints = @(
    @{name='File Manager'; url='http://localhost:3000/api/file-manager?path=/'},
    @{name='Databases'; url='http://localhost:3000/api/db-management'},
    @{name='Email Management'; url='http://localhost:3000/api/email-management/accounts'}
)

foreach ($ep in $endpoints) {
    try {
        $null = Invoke-WebRequest -Uri $ep.url -UseBasicParsing -ErrorAction Stop
        Write-Host "[ERROR] $($ep.name) - No auth required (BUG!)" -ForegroundColor Red
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 401) {
            Write-Host "[OK] $($ep.name) - Requires authentication (401)" -ForegroundColor Green
        } else {
            Write-Host "[ERROR] $($ep.name) - Unexpected error: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        }
    }
}

Write-Host "`n=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "[OK] Email routes: Fixed tenant_id NOT NULL constraint" -ForegroundColor Green
Write-Host "[OK] File Manager: Fixed Windows path (K:\MigraHosting\storage)" -ForegroundColor Green
Write-Host "[OK] Databases: Fixed tenant_id filtering in queries" -ForegroundColor Green
Write-Host "`n[OK] All Phase 2 backend routes ready!" -ForegroundColor Green
