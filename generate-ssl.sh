#!/bin/bash
# Helper script to generate SSL certificates with custom domain support
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSL_DIR="$DIR/frontend/ssl"
DOMAIN="${1:-localhost}"

mkdir -p "$SSL_DIR"

echo "Generating SSL certificate and private key for domain: $DOMAIN (with SAN extensions)..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$SSL_DIR/key.pem" \
  -out "$SSL_DIR/cert.pem" \
  -subj "/C=US/ST=Production/L=Local/O=EmployeeSystem/OU=IT/CN=$DOMAIN" \
  -addext "subjectAltName=DNS:$DOMAIN,DNS:localhost,IP:127.0.0.1"

# Restrict file permissions for cryptographic material
chmod 600 "$SSL_DIR/key.pem"
chmod 644 "$SSL_DIR/cert.pem"

echo "SSL Certificate successfully generated in $SSL_DIR:"
echo " - Certificate: $SSL_DIR/cert.pem"
echo " - Private Key: $SSL_DIR/key.pem"
