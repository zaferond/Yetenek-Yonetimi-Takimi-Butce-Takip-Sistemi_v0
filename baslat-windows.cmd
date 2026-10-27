@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto missing
node -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)"
if errorlevel 1 goto missing
if not exist node_modules call npm ci
if errorlevel 1 goto failed
call npm run setup
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
echo Tarayicida http://127.0.0.1:3100 adresini acin. Durdurmak icin Ctrl+C.
call npm start
goto end
:missing
echo Node.js 24 veya uzerini kurun.
goto end
:failed
echo Islem basarisiz. Yukaridaki hata mesajini kontrol edin.
:end
pause
