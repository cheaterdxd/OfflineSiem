# OfflineSiem - Quick Start Script
# Chạy script này để khởi động ứng dụng ở chế độ development

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OfflineSiem - Development Launcher  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Kiểm tra Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "✗ Node.js not found! Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Kiểm tra Rust
Write-Host "Checking Rust..." -ForegroundColor Yellow
if (Get-Command cargo -ErrorAction SilentlyContinue) {
    $rustVersion = cargo --version
    Write-Host "✓ Rust found: $rustVersion" -ForegroundColor Green
} else {
    Write-Host "✗ Rust not found! Please install Rust from https://rustup.rs/" -ForegroundColor Red
    exit 1
}

# Kiểm tra node_modules
Write-Host ""
Write-Host "Checking dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing Node.js dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to install dependencies!" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "✓ Dependencies already installed" -ForegroundColor Green
}

# Khởi chạy ứng dụng
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
