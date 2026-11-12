#!/usr/bin/env node
/**
 * Production bootstrapper for @avahui/api.
 * Ensures PostgreSQL readiness, ensures `uuid-ossp`, baselines existing
 * SQL-initialized databases when `_prisma_migrations` is absent, runs
 * `prisma migrate deploy`, and then boots the compiled NestJS server.
 */
const { execSync } = require('child_process');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const API_ROOT = path.resolve(__dirname, '..');

function resolveMigrationDatabaseUrl(rawUrl) {
  if (process.env.DIRECT_DATABASE_URL) return process.env.DIRECT_DATABASE_URL;
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  if (!rawUrl) return rawUrl;
  // Neon pooled connections (-pooler.) use PgBouncer transaction pooling,
  // whereas Prisma migrate requires a direct connection for advisory locks.
  if (rawUrl.includes('.neon.tech') && rawUrl.includes('-pooler.')) {
    return rawUrl
      .replace('-pooler.', '.')
      .replace(/([?&])pgbouncer=true(&|$)/, '$1')
      .replace(/[?&]$/, '');
  }
  return rawUrl;
}

function getMigrationEnv() {
  const migrationUrl = resolveMigrationDatabaseUrl(process.env.DATABASE_URL);
  return migrationUrl
    ? { ...process.env, DATABASE_URL: migrationUrl }
    : process.env;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDatabase(prisma, maxAttempts = 10, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      console.log(
        `[start-prod] Waiting for PostgreSQL (${attempt}/${maxAttempts})...`,
      );
      await sleep(delayMs);
    }
  }
}

async function ensureMigrationsReady() {
  const prisma = new PrismaClient();
  try {
    await waitForDatabase(prisma);

    try {
      await prisma.$executeRawUnsafe(
        'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
      );
    } catch (extErr) {
      console.warn(
        '[start-prod] Warning: could not run CREATE EXTENSION uuid-ossp:',
        extErr instanceof Error ? extErr.message : String(extErr),
      );
    }

    const rows = await prisma.$queryRaw`
      SELECT
        to_regclass('public.users')::text AS has_users,
        to_regclass('public._prisma_migrations')::text AS has_migrations
    `;
    const state = Array.isArray(rows) ? rows[0] : null;

    if (state?.has_users && !state?.has_migrations) {
      console.log(
        '[start-prod] Existing schema detected without _prisma_migrations; baselining 0001_init...',
      );
      execSync('npx prisma migrate resolve --applied 0001_init', {
        cwd: API_ROOT,
        stdio: 'inherit',
        env: getMigrationEnv(),
      });
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log('[start-prod] Running prisma migrate deploy...');
  execSync('npx prisma migrate deploy', {
    cwd: API_ROOT,
    stdio: 'inherit',
    env: getMigrationEnv(),
  });
}

async function main() {
  await ensureMigrationsReady();
  console.log('[start-prod] Starting @avahui/api...');
  require(path.join(API_ROOT, 'dist', 'main'));
}

main().catch((err) => {
  console.error('[start-prod] Fatal startup error:', err);
  process.exit(1);
});

