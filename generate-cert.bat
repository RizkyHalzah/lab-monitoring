@echo off
REM generate-cert.bat - Generate self-signed certificate for Windows

echo Generating self-signed certificate...
if not exist certs mkdir certs

REM Check if openssl is available
where openssl >nul 2>nul
if %errorlevel% neq 0 (
    echo OpenSSL not found. Please install:
    echo   Option 1: Download Win64OpenSSL from https://slproweb.com/products/Win32OpenSSL.html
    echo   Option 2: Or use Git Bash which includes openssl
    echo.
    pause
    exit /b 1
)

REM Generate certificate
openssl req -x509 -newkey rsa:2048 -nodes ^
  -out certs\server.crt ^
  -keyout certs\server.key ^
  -days 365 ^
  -subj "/C=ID/ST=State/L=City/O=Lab/CN=*"

if %errorlevel% equ 0 (
    echo.
    echo Certificate generated successfully!
    echo.
    echo Files created:
    echo   - certs\server.crt
    echo   - certs\server.key
    echo.
    echo Next: Start server with: npm start
    echo Then access via HTTPS: https://192.168.1.6:3000
    echo.
    echo NOTE: Browser will show security warning
    echo Click "Advanced" and "Proceed" to continue
) else (
    echo Failed to generate certificate
    pause
    exit /b 1
)

pause
