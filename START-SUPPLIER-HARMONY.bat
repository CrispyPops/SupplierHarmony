@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required but was not found.
  echo If winget is available, this script will offer to install Node.js LTS.
  where winget >nul 2>nul
  if errorlevel 1 (
    echo Please install Node.js LTS from https://nodejs.org/ and run this file again.
    pause
    exit /b 1
  )
  choice /M "Install Node.js LTS now using winget"
  if errorlevel 2 (
    echo Please install Node.js LTS and run this file again.
    pause
    exit /b 1
  )
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
  if errorlevel 1 goto :error
  echo Node.js was installed. Please close this window and double-click this file again.
  pause
  exit /b 0
)
for /f "delims=" %%v in ('node -p "process.versions.node"') do set NODEVER=%%v
node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>22 || (a===22 && b>=13)?0:1)"
if errorlevel 1 (
  echo Supplier Harmony requires Node.js 22.13 or newer.
  echo Current version: %NODEVER%
  pause
  exit /b 1
)
if not exist node_modules (
  echo First run: installing application packages...
  call npm install
  if errorlevel 1 goto :error
)
if not exist dist (
  echo Building Supplier Harmony for the first time...
  call npm run build
  if errorlevel 1 goto :error
)
echo.
echo Starting Supplier Harmony...
echo Keep this window open while using the application.
echo Close this window when finished.
echo.
node server.mjs
goto :eof
:error
echo.
echo Supplier Harmony could not be started. See the message above.
pause
