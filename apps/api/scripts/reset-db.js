#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting AvaHui PostgreSQL tables while preserving uuid-ossp extension...');
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      notifications,
      blockchain_events,
      blockchain_transactions,
      indexer_state,
      payouts,
      bids,
      contributions,
      rounds,
      collaterals,
      circle_members,
      circles,
      wallets,
      users
    RESTART IDENTITY CASCADE;
  `);
  console.log('✓ Tables truncated cleanly.');
}

main()
  .catch((err) => {
    console.error('Reset DB error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
