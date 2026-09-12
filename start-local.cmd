@echo off
setlocal

cd /d "%~dp0"

where node.exe >nul 2>&1
if errorlevel 1 (
  echo [local] Node.js was not found. Install Node.js 22 and try again.
  exit /b 1
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo [local] npm was not found. Reinstall Node.js and try again.
  exit /b 1
)

echo [local] Starting the PGCEAP frontend and backend...
echo [local] Frontend: http://localhost:5173
echo [local] Backend:  http://localhost:3601/api
echo [local] Press Ctrl+C to stop both services.
echo.

call npm.cmd run dev
exit /b %errorlevel%
