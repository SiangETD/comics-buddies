@echo off
title Comics Buddies - Dev Server
cd /d "%~dp0"
echo Starting Comics Buddies...
echo.
echo Once ready, open: http://localhost:5173
echo API server runs on: http://localhost:3001
echo Press Ctrl+C to stop the server.
echo.
npm run dev
pause
