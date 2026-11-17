@echo off
title BaSa3D + 3D Catalog Dev Launcher
setlocal

cd /d "%~dp0"

echo [BaSa3D] Cleaning up previous dev ports 3000 and 8338...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8338,3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 1 /nobreak >nul

where wt >nul 2>nul
if %errorlevel%==0 (
  echo [BaSa3D] Launching in Windows Terminal tabs...
  wt -w 0 new-tab --title "BaSa3D Dev (3000)" -d "%~dp0" cmd /k "npm run dev" ; new-tab --title "3D Catalog (8338)" -d "%~dp0" cmd /k "npm run catalog"
  exit /b 0
)

echo [BaSa3D] Windows Terminal not found, launching in separate cmd windows...
start "BaSa3D Dev (3000)" cmd /k "npm run dev"
start "3D Catalog (8338)" cmd /k "npm run catalog"
