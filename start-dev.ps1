# OfflineSiem - Quick Start Script
# Chay script nay de khoi dong ung dung o che do development

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OfflineSiem - Development Launcher  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Kiem tra Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
if (Get-Command node -ErrorAction SilentlyContinue) {
    try {
        $nodeVersion = node --version
        Write-Host "[OK] Node.js found: $nodeVersion" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] Node.js found but failed to check version" -ForegroundColor Yellow
    }
} else {
    Write-Host "[ERR] Node.js not found! Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Kiem tra Rust
Write-Host "Checking Rust..." -ForegroundColor Yellow

# Try to add Cargo to PATH if not found (common issue after fresh install)
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    $cargoPath = Join-Path $env:USERPROFILE ".cargo\bin"
    if (Test-Path $cargoPath) {
        Write-Host "[WARN] Cargo not in PATH, adding temporarily..." -ForegroundColor Yellow
        $env:Path += ";$cargoPath"
    }
}

if (Get-Command cargo -ErrorAction SilentlyContinue) {
    try {
        $rustVersion = cargo --version
        Write-Host "[OK] Rust found: $rustVersion" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] Rust found but failed to check version" -ForegroundColor Yellow
    }
} else {
    Write-Host "[ERR] Rust not found! Please install Rust from https://rustup.rs/" -ForegroundColor Red
    Write-Host "  Tip: If you just installed Rust, try restarting your terminal." -ForegroundColor Gray
    exit 1
}

# Kiem tra node_modules
Write-Host ""
Write-Host "Checking dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing Node.js dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERR] Failed to install dependencies!" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "[OK] Dependencies already installed" -ForegroundColor Green
}

# Khoi chay ung dung
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting OfflineSiem in development mode..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tips:" -ForegroundColor Yellow
Write-Host "  - Press F12 to open DevTools" -ForegroundColor Gray
Write-Host "  - Frontend changes will hot-reload automatically" -ForegroundColor Gray
Write-Host "  - Backend changes require rebuild (automatic)" -ForegroundColor Gray
Write-Host "  - Press Ctrl+C to stop the application" -ForegroundColor Gray
Write-Host ""

npm run tauri dev
