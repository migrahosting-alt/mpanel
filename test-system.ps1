# MPanel System Test Script
# This script tests all major components of the mPanel system

Write-Host "`n╔════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     MPANEL SYSTEM HEALTH CHECK                ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$results = @{
    passed = 0
    failed = 0
    warnings = 0
}

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$ExpectedStatus = 200,
        [switch]$ShouldFail
    )
    
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host "  ✓ $Name" -ForegroundColor Green
            $script:results.passed++
            return $true
        } else {
            Write-Host "  ✗ $Name (Got $($response.StatusCode), expected $ExpectedStatus)" -ForegroundColor Red
            $script:results.failed++
            return $false
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($ShouldFail -and $statusCode -eq $ExpectedStatus) {
            Write-Host "  ✓ $Name (Protected: $statusCode)" -ForegroundColor Green
            $script:results.passed++
            return $true
        } elseif ($null -eq $statusCode) {
            Write-Host "  ✗ $Name (Server not responding)" -ForegroundColor Red
            $script:results.failed++
            return $false
        } else {
            Write-Host "  ⚠ $Name (Got $statusCode, expected $ExpectedStatus)" -ForegroundColor Yellow
            $script:results.warnings++
            return $false
        }
    }
}

# Test 1: Infrastructure Services
Write-Host "1. Testing Docker Infrastructure..." -ForegroundColor Yellow
$dockerServices = docker ps --format "table {{.Names}}\t{{.Status}}" 2>&1
if ($dockerServices -like "*postgres*" -and $dockerServices -like "*redis*") {
    Write-Host "  ✓ Docker services running" -ForegroundColor Green
    $results.passed++
} else {
    Write-Host "  ✗ Docker services not fully running" -ForegroundColor Red
    $results.failed++
}

# Test 2: Backend Server
Write-Host "`n2. Testing Backend Server..." -ForegroundColor Yellow
Test-Endpoint "Health Endpoint" "http://localhost:3000/api/health"
Test-Endpoint "Metrics Endpoint" "http://localhost:3000/api/metrics"
Test-Endpoint "Auth Protection" "http://localhost:3000/api/products" -ExpectedStatus 401 -ShouldFail

# Test 3: Premium Tools Routes
Write-Host "`n3. Testing Premium Tools..." -ForegroundColor Yellow
Test-Endpoint "Integration Templates" "http://localhost:3000/api/premium/integrations/templates" -ExpectedStatus 401 -ShouldFail
Test-Endpoint "SEO Templates" "http://localhost:3000/api/premium/seo/templates" -ExpectedStatus 401 -ShouldFail
Test-Endpoint "Installer List" "http://localhost:3000/api/premium/installers" -ExpectedStatus 401 -ShouldFail
Test-Endpoint "AI Builder Templates" "http://localhost:3000/api/premium/ai-builder/templates"

# Test 4: Frontend
Write-Host "`n4. Testing Frontend..." -ForegroundColor Yellow
Test-Endpoint "Frontend Homepage" "http://localhost:3001"

# Test 5: Monitoring
Write-Host "`n5. Testing Monitoring Stack..." -ForegroundColor Yellow
Test-Endpoint "Prometheus" "http://localhost:9090"
Test-Endpoint "Grafana" "http://localhost:3002"

# Summary
Write-Host "`n╔════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     TEST RESULTS                               ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "  Passed:   $($results.passed)" -ForegroundColor Green
Write-Host "  Warnings: $($results.warnings)" -ForegroundColor Yellow
Write-Host "  Failed:   $($results.failed)" -ForegroundColor Red

$total = $results.passed + $results.warnings + $results.failed
$percentage = [math]::Round(($results.passed / $total) * 100, 1)

Write-Host "`n  Success Rate: $percentage%" -ForegroundColor $(if ($percentage -ge 80) { "Green" } elseif ($percentage -ge 60) { "Yellow" } else { "Red" })

if ($results.failed -eq 0 -and $results.warnings -eq 0) {
    Write-Host "`n  🎉 ALL SYSTEMS OPERATIONAL!" -ForegroundColor Green
} elseif ($results.failed -eq 0) {
    Write-Host "`n  ⚠️  System operational with warnings" -ForegroundColor Yellow
} else {
    Write-Host "`n  ❌ System has failures - review above" -ForegroundColor Red
}

Write-Host ""
