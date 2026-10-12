#!/bin/bash
# generate-cert.sh - Generate self-signed certificate for HTTPS

# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    echo "OpenSSL not found. Please install OpenSSL:"
    echo "  Ubuntu/Debian: sudo apt-get install openssl"
    echo "  macOS: brew install openssl"
    echo "  Windows: Download from https://slproweb.com/products/Win32OpenSSL.html"
    exit 1
fi

echo "Generating self-signed certificate..."
mkdir -p certs

# Generate private key and certificate (valid for 365 days)
openssl req -x509 -newkey rsa:2048 -nodes \
  -out certs/server.crt \
  -keyout certs/server.key \
  -days 365 \
  -subj "/C=ID/ST=State/L=City/O=Lab/CN=*"

if [ $? -eq 0 ]; then
    echo "✓ Certificate generated successfully!"
    echo ""
    echo "Files created:"
    echo "  - certs/server.crt (certificate)"
    echo "  - certs/server.key (private key)"
    echo ""
    echo "Next: Start server with: npm start"
    echo "Then access via HTTPS: https://192.168.1.6:3000"
    echo ""
    echo "NOTE: Browser will show security warning (self-signed cert)"
    echo "Click 'Advanced' and 'Proceed' to continue"
else
    echo "✗ Failed to generate certificate"
    exit 1
fi
