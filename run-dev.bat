@echo off
setlocal enabledelayedexpansion
REM Background Remover Pro - Development Mode (with hot reload)

echo.
echo ════════════════════════════════════════════
echo 🎨 Background Remover Pro - Development Mode
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
        echo Press any key to close this window...
        pause >nul
        exit /b 1
    )
    echo ✓ Dependencies installed successfully
    echo.
)

REM Launch in dev mode (both frontend and backend with hot reload)
echo ✅ All systems ready!
echo.
echo 🚀 Starting Background Remover Pro (Development Mode)...
echo.
echo 📍 Frontend: http://localhost:8080
echo 📍 Backend:  http://localhost:3001
echo.
echo 💡 Development Features:
echo    • Hot reload enabled - changes reflected instantly
echo    • Frontend and backend both running
echo    • Full debug logging enabled
echo    • Better error messages
echo.
echo ⏸️  To stop: Press Ctrl+C in any terminal
echo.
echo ════════════════════════════════════════════
echo.

call npm run dev

echo.
echo 🛑 Development server stopped
echo.
echo Press any key to close this window...
pause >nul
