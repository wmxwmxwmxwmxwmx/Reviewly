@echo off
setlocal

echo Starting PRism development server...

if not exist node_modules (
  echo Dependencies not found. Installing with npm...
  call npm install
  if errorlevel 1 exit /b %errorlevel%
)

start "" "http://localhost:3000"
call npm run dev
