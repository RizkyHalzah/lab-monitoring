#!/usr/bin/env node
// scripts/generate-cert.js - Cross-platform certificate generation

import { execSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const certsDir = join(projectRoot, 'certs');
const certFile = join(certsDir, 'server.crt');
const keyFile = join(certsDir, 'server.key');

console.log('🔐 Generating self-signed certificate for HTTPS...\n');

// Check if OpenSSL is available
try {
  execSync('openssl version', { stdio: 'ignore' });
} catch (e) {
  console.warn('⚠️ OpenSSL not found on your system. Trying Node fallback using "selfsigned" package...');
  try {
    // attempt to use selfsigned package as fallback
    const mod = await import('selfsigned');
    const selfsigned = mod.default || mod;
    console.log('Using selfsigned fallback to generate certificate...');
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const opts = { days: 365, keySize: 2048, algorithm: 'sha256', extensions: [{ name: 'basicConstraints', cA: true }] };
    const pems = selfsigned.generate(attrs, opts);
    // write files
    mkdirSync(certsDir, { recursive: true });
    const { writeFileSync } = await import('fs');
    writeFileSync(certFile, pems.cert, 'utf8');
    writeFileSync(keyFile, pems.private, 'utf8');
    console.log('\n✅ Certificate generated using selfsigned (no OpenSSL needed)');
    console.log(`  ✓ ${certFile}`);
    console.log(`  ✓ ${keyFile}`);
    console.log('\n🚀 Next: npm start');
    process.exit(0);
  } catch (fallbackErr) {
    console.error('❌ selfsigned fallback failed or not installed.');
    console.error('Error:', fallbackErr.message || fallbackErr);
    console.error('\nPlease install OpenSSL or run this script from Git Bash, or install dependency by running:');
    console.error('\n  npm install');
    console.error('\nThen retry: npm run generate-cert');
    process.exit(1);
  }
}

// Create certs directory
if (!existsSync(certsDir)) {
  mkdirSync(certsDir, { recursive: true });
  console.log(`📁 Created directory: ${certsDir}`);
}

// Check if cert already exists
if (existsSync(certFile) && existsSync(keyFile)) {
  console.log('✓ Certificate already exists:');
  console.log(`  - ${certFile}`);
  console.log(`  - ${keyFile}`);
  console.log('\n💡 To regenerate, delete the certs folder and run again.\n');
  process.exit(0);
}

try {
  // Generate self-signed certificate (valid for 365 days)
  const cmd = `openssl req -x509 -newkey rsa:2048 -nodes -out "${certFile}" -keyout "${keyFile}" -days 365 -subj "/C=ID/ST=State/L=City/O=Lab/CN=*"`;
  
  console.log('Generating certificate with OpenSSL...');
  execSync(cmd, { stdio: 'inherit' });
  
  console.log('\n✅ Certificate generated successfully!\n');
  console.log('📝 Files created:');
  console.log(`  ✓ ${certFile}`);
  console.log(`  ✓ ${keyFile}`);
  console.log('\n🚀 Next steps:');
  console.log('  1. Start the server: npm start');
  console.log('  2. Access via HTTPS: https://192.168.1.6:3000');
  console.log('  3. Or: https://192.168.1.11:3000\n');
  console.log('⚠️  Browser will show security warning (self-signed certificate)');
  console.log('   Click "Advanced" → "Proceed anyway" or "Accept risk" to continue\n');
  
} catch (e) {
  console.error('❌ Failed to generate certificate:', e.message);
  process.exit(1);
}
