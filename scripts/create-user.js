#!/usr/bin/env node

/**
 * Create Password User for bmad-orchestrator
 *
 * Usage: npm run create-user
 *
 * Prompts for email and password, outputs YAML snippet for secrets file.
 */

import { createInterface } from 'readline';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const prompt = (question) =>
  new Promise((resolve) => rl.question(question, resolve));

/**
 * Validate email format
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║     Create Password User for bmad-orchestrator        ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Get email
    const email = await prompt('Email: ');
    if (!isValidEmail(email)) {
      console.error('\n❌ Invalid email format');
      process.exit(1);
    }

    // Get password
    const password = await prompt(`Password (min ${MIN_PASSWORD_LENGTH} chars): `);
    if (password.length < MIN_PASSWORD_LENGTH) {
      console.error(`\n❌ Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      process.exit(1);
    }

    // Confirm password
    const confirm = await prompt('Confirm password: ');
    if (password !== confirm) {
      console.error('\n❌ Passwords do not match');
      process.exit(1);
    }

    // Hash password
    console.log('\n⏳ Hashing password...');
    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Output YAML snippet
    console.log('\n✅ User created successfully!');
    console.log('');
    console.log('Add this to bmad-orchestrator.secrets.yaml under password_users:');
    console.log('');
    console.log('─'.repeat(60));
    console.log(`  - email: "${email}"`);
    console.log(`    password_hash: "${hash}"`);
    console.log('─'.repeat(60));
    console.log('');
    console.log('Example secrets file structure:');
    console.log('');
    console.log('  password_users:');
    console.log(`    - email: "${email}"`);
    console.log(`      password_hash: "${hash}"`);
    console.log('');
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
