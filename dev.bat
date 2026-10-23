@echo off
REM Start the Vite dev server (http://localhost:5175)
REM Uses npm.cmd to bypass the PowerShell execution-policy block on npm.ps1
cd /d "%~dp0"
call npm.cmd run dev %*
