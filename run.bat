@echo off
setlocal enabledelayedexpansion
REM Background Remover Pro - Node.js Launcher

echo.
echo ════════════════════════════════════════════
echo 🎨 Background Remover Pro - Local Launch
echo ════════════════════════════════════════════
echo.

cd /d "%~dp0"

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ❌ ERROR: Node.js is not installed or not in PATH
    echo.
    echo 📥 Please install Node.js from: https://nodejs.org/
    echo.
    echo ⚙️  Installation Steps:
    echo    1. Download Node.js LTS from https://nodejs.org/
    echo    2. Run the installer
    echo    3. Accept default settings
    echo    4. Restart your computer
    echo    5. Try running this script again
    echo.
    echo Press any key to close this window...
    pause >nul
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ❌ ERROR: npm is not installed or not in PATH
    echo.
    echo Please reinstall Node.js from https://nodejs.org/
    echo.
    echo Press any key to close this window...
    pause >nul
    exit /b 1
)

REM Show Node and npm versions
echo ✓ Node.js found:
node --version
echo ✓ npm found:
npm --version
echo.

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo 📥 Installing dependencies (this may take 2-5 minutes on first run)...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo ❌ ERROR: Failed to install dependencies
        echo.
        echo Try these solutions:
        echo    1. Delete the 'node_modules' folder
        echo    2. Close all terminals and Node.js windows
        echo    3. Run this script again
        echo.
        echo Press any key to close this window...
        pause >nul
        exit /b 1
    )
    echo ✓ Dependencies installed successfully
    echo.
)

REM Build the frontend
echo 🔨 Building frontend...
call npm run build
if errorlevel 1 (
    echo.
    echo ❌ ERROR: Failed to build frontend
    echo.
    echo Try:
    echo    1. Delete the 'dist' folder
    echo    2. Run this script again
    echo.
    echo Press any key to close this window...
    pause >nul
    exit /b 1
)
echo ✓ Frontend built successfully
echo.

REM Launch the app
echo ✅ All systems ready!
echo.
echo 🚀 Starting Background Remover Pro...
echo.
echo 📍 The app will open at: http://localhost:8080
echo 📍 Backend running at: http://localhost:3001
echo.
echo 💡 Tips:
echo    • If browser doesn't open, manually visit http://localhost:8080
echo    • To stop the server, press Ctrl+C
echo    • Close this window to stop the app
echo.
echo ════════════════════════════════════════════
echo.

call npm run start

echo.
echo ❌ Server stopped
echo.
echo Press any key to close this window...
pause >nul
