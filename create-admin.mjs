/**
 * create-admin.mjs
 * Run with: node create-admin.mjs
 * Creates a single ADMIN user directly in MySQL using argon2 (same hasher as the backend).
 */

import { hash } from 'argon2';
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';

// ── DB config (matches .env.auth / .env.main) ─────────────────────────────────
const DB = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '1234',
  database: 'mealplate',
};

// ── Admin account to create ───────────────────────────────────────────────────
const ADMIN = {
  name: 'Super Admin',
  email: 'admin@plate40.com',
  phone: '+919999999999',
  password: 'Admin@1234',
  role: 'ADMIN',
  status: 'ACTIVE',
};

// ─────────────────────────────────────────────────────────────────────────────
const conn = await mysql.createConnection(DB);

try {
  // Check duplicate
  const [rows] = await conn.execute(
    'SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1',
    [ADMIN.email.toLowerCase(), ADMIN.phone],
  );
  if (rows.length > 0) {
    console.log('⚠️  An account with this email or phone already exists. Skipping insert.');
    process.exit(0);
  }

  const passwordHash = await hash(ADMIN.password);
  const uuid = randomUUID();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  await conn.execute(
    `INSERT INTO users
       (uuid, name, email, phone, password_hash, role, status,
        email_verified_at, phone_verified_at, last_login_at,
        created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
    [
      uuid,
      ADMIN.name,
      ADMIN.email.toLowerCase(),
      ADMIN.phone,
      passwordHash,
      ADMIN.role,
      ADMIN.status,
      now,   // email_verified_at
      now,   // phone_verified_at
      now,   // created_at
      now,   // updated_at
    ],
  );

  console.log('✅ Admin user created successfully!');
  console.log('');
  console.log('  Login URL  : http://localhost:3001/login');
  console.log('  Email      :', ADMIN.email);
  console.log('  Password   :', ADMIN.password);
  console.log('  Role       :', ADMIN.role);
  console.log('');
  console.log('After login you will be redirected to /admin/dashboard');
} finally {
  await conn.end();
}
