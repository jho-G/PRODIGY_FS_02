#!/bin/bash
# Helper script to generate development SSL certificates for localhost
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSL_DIR="$DIR/frontend/ssl"

mkdir -p "$SSL_DIR"

echo "Generating local SSL certificate and private key..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$SSL_DIR/key.pem" \
  -out "$SSL_DIR/cert.pem" \
  -subj "/C=US/ST=Development/L=Local/O=EmployeeSystem/OU=Dev/CN=localhost"

echo "SSL Certificate successfully generated in $SSL_DIR:"
echo " - Certificate: $SSL_DIR/cert.pem"
echo " - Private Key: $SSL_DIR/key.pem"

