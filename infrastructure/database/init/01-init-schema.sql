-- ============================================================================
-- AVAHUI PLATFORM — POSTGRESQL INITIALIZATION SCHEMA
-- Location: infrastructure/database/init/01-init-schema.sql
-- Automatically executed on first PostgreSQL container startup
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE allocation_mode AS ENUM ('FIXED', 'BIDDING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE circle_status AS ENUM ('DRAFT', 'RECRUITING', 'ACTIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE round_status AS ENUM ('PENDING', 'OPEN', 'SETTLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE member_status AS ENUM ('ACTIVE', 'DEFAULTED', 'WITHDRAWN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tx_type AS ENUM (
        'FAUCET_MINT',
        'APPROVE_TOKEN',
        'CREATE_CIRCLE',
        'JOIN_CIRCLE',
        'CONTRIBUTE',
        'PLACE_BID',
        'COMMIT_BID',
        'REVEAL_BID',
        'SETTLE_ROUND',
        'WITHDRAW_COLLATERAL',
        'CANCEL_CIRCLE',
        'SWAP_TOKEN',
        'VERIFY_ATTESTATION'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tx_status AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    privy_did VARCHAR(128) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    display_name VARCHAR(100),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. WALLETS
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address VARCHAR(42) NOT NULL UNIQUE,
    wallet_client_type VARCHAR(50) NOT NULL DEFAULT 'privy',
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);

-- 3. CIRCLES
CREATE TABLE IF NOT EXISTS circles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metadata_id VARCHAR(64) NOT NULL UNIQUE,
    contract_address VARCHAR(42) UNIQUE,
    chain_id INTEGER NOT NULL DEFAULT 43113,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    creator_address VARCHAR(42) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    allocation_mode allocation_mode NOT NULL,
    status circle_status NOT NULL DEFAULT 'DRAFT',
    max_members SMALLINT NOT NULL CHECK (max_members BETWEEN 5 AND 10),
    current_member_count SMALLINT NOT NULL DEFAULT 0,
    current_round SMALLINT NOT NULL DEFAULT 0,
    total_rounds SMALLINT NOT NULL CHECK (total_rounds BETWEEN 5 AND 10),
    contribution_amount NUMERIC(78, 0) NOT NULL,
    collateral_amount NUMERIC(78, 0) NOT NULL,
    round_duration_seconds INTEGER NOT NULL,
    bidding_duration_seconds INTEGER NOT NULL DEFAULT 0,
    grace_period_seconds INTEGER NOT NULL,
    start_deadline TIMESTAMPTZ NOT NULL,
    min_bid NUMERIC(78, 0) NOT NULL DEFAULT 0,
    max_bid NUMERIC(78, 0) NOT NULL DEFAULT 0,
    total_discount_pool NUMERIC(78, 0) NOT NULL DEFAULT 0,
    creation_tx_hash VARCHAR(66),
    activated_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_circles_status ON circles(status);
CREATE INDEX IF NOT EXISTS idx_circles_creator ON circles(creator_address);
CREATE INDEX IF NOT EXISTS idx_circles_contract ON circles(contract_address);

-- 4. CIRCLE_MEMBERS
CREATE TABLE IF NOT EXISTS circle_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    member_address VARCHAR(42) NOT NULL,
    slot_index SMALLINT NOT NULL,
    status member_status NOT NULL DEFAULT 'ACTIVE',
    has_received_payout BOOLEAN NOT NULL DEFAULT FALSE,
    won_round_number SMALLINT,
    default_count SMALLINT NOT NULL DEFAULT 0,
    join_tx_hash VARCHAR(66) NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (circle_id, member_address),
    UNIQUE (circle_id, slot_index)
);
CREATE INDEX IF NOT EXISTS idx_circle_members_address ON circle_members(member_address);

-- 5. COLLATERALS
CREATE TABLE IF NOT EXISTS collaterals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    member_id UUID NOT NULL UNIQUE REFERENCES circle_members(id) ON DELETE CASCADE,
    member_address VARCHAR(42) NOT NULL,
    initial_locked_amount NUMERIC(78, 0) NOT NULL,
    current_locked_amount NUMERIC(78, 0) NOT NULL,
    total_slashed_amount NUMERIC(78, 0) NOT NULL DEFAULT 0,
    withdrawn_amount NUMERIC(78, 0) NOT NULL DEFAULT 0,
    discount_bonus_claimed NUMERIC(78, 0) NOT NULL DEFAULT 0,
    is_withdrawn BOOLEAN NOT NULL DEFAULT FALSE,
    withdraw_tx_hash VARCHAR(66),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. ROUNDS
CREATE TABLE IF NOT EXISTS rounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    round_number SMALLINT NOT NULL,
    status round_status NOT NULL DEFAULT 'PENDING',
    start_time TIMESTAMPTZ,
    contribution_deadline TIMESTAMPTZ,
    bidding_deadline TIMESTAMPTZ,
    grace_deadline TIMESTAMPTZ,
    winner_address VARCHAR(42),
    gross_pot_amount NUMERIC(78, 0) NOT NULL DEFAULT 0,
    winning_bid_amount NUMERIC(78, 0) NOT NULL DEFAULT 0,
    net_payout_amount NUMERIC(78, 0) NOT NULL DEFAULT 0,
    settled_at TIMESTAMPTZ,
    settlement_tx_hash VARCHAR(66),
    UNIQUE (circle_id, round_number)
);
CREATE INDEX IF NOT EXISTS idx_rounds_circle_status ON rounds(circle_id, status);

-- 7. CONTRIBUTIONS
CREATE TABLE IF NOT EXISTS contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    round_number SMALLINT NOT NULL,
    member_address VARCHAR(42) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,
    is_from_collateral_slash BOOLEAN NOT NULL DEFAULT FALSE,
    tx_hash VARCHAR(66) NOT NULL,
    contributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (circle_id, round_number, member_address)
);
CREATE INDEX IF NOT EXISTS idx_contributions_member ON contributions(member_address);

-- 8. BIDS
CREATE TABLE IF NOT EXISTS bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    round_number SMALLINT NOT NULL,
    bidder_address VARCHAR(42) NOT NULL,
    bid_amount NUMERIC(78, 0) NOT NULL,
    is_winning_bid BOOLEAN NOT NULL DEFAULT FALSE,
    tx_hash VARCHAR(66) NOT NULL,
    placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bids_round ON bids(round_id, bid_amount DESC);

-- 9. PAYOUTS
CREATE TABLE IF NOT EXISTS payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    round_id UUID NOT NULL UNIQUE REFERENCES rounds(id) ON DELETE CASCADE,
    round_number SMALLINT NOT NULL,
    recipient_address VARCHAR(42) NOT NULL,
    gross_amount NUMERIC(78, 0) NOT NULL,
    discount_amount NUMERIC(78, 0) NOT NULL DEFAULT 0,
    net_amount NUMERIC(78, 0) NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (circle_id, round_number),
    UNIQUE (circle_id, recipient_address)
);

-- 10. BLOCKCHAIN_TRANSACTIONS
CREATE TABLE IF NOT EXISTS blockchain_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER NOT NULL DEFAULT 43113,
    tx_hash VARCHAR(66) NOT NULL UNIQUE,
    sender_address VARCHAR(42) NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    circle_id UUID REFERENCES circles(id) ON DELETE SET NULL,
    tx_type tx_type NOT NULL,
    status tx_status NOT NULL DEFAULT 'PENDING',
    block_number BIGINT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tx_sender ON blockchain_transactions(sender_address);

-- 11. BLOCKCHAIN_EVENTS (Idempotency key: chain_id + tx_hash + log_index)
CREATE TABLE IF NOT EXISTS blockchain_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER NOT NULL DEFAULT 43113,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INTEGER NOT NULL,
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    event_name VARCHAR(80) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT TRUE,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (chain_id, tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_events_block_number ON blockchain_events(block_number);

-- 12. INDEXER_STATE
CREATE TABLE IF NOT EXISTS indexer_state (
    chain_id INTEGER PRIMARY KEY,
    last_processed_block BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
