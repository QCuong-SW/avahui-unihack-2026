-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('MEMBER', 'VERIFIER', 'ADMIN');

-- CreateEnum
CREATE TYPE "allocation_mode" AS ENUM ('FIXED', 'BIDDING');

-- CreateEnum
CREATE TYPE "circle_status" AS ENUM ('DRAFT', 'RECRUITING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "round_status" AS ENUM ('PENDING', 'OPEN', 'SETTLED');

-- CreateEnum
CREATE TYPE "member_status" AS ENUM ('ACTIVE', 'DEFAULTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "tx_type" AS ENUM ('FAUCET_MINT', 'APPROVE_TOKEN', 'CREATE_CIRCLE', 'JOIN_CIRCLE', 'CONTRIBUTE', 'PLACE_BID', 'COMMIT_BID', 'REVEAL_BID', 'SETTLE_ROUND', 'WITHDRAW_COLLATERAL', 'CANCEL_CIRCLE', 'SWAP_TOKEN', 'VERIFY_ATTESTATION');

-- CreateEnum
CREATE TYPE "tx_status" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "privy_did" VARCHAR(128) NOT NULL,
    "email" VARCHAR(255),
    "display_name" VARCHAR(100),
    "avatar_url" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'MEMBER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "team1_verified" BOOLEAN NOT NULL DEFAULT false,
    "identity_nullifier" VARCHAR(66),
    "trust_tier" SMALLINT NOT NULL DEFAULT 0,
    "pending_voucher" JSONB,
    "last_gas_drip_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_nonces" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "address" VARCHAR(42) NOT NULL,
    "nonce" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_nonces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "address" VARCHAR(42) NOT NULL,
    "wallet_client_type" VARCHAR(50) NOT NULL DEFAULT 'privy',
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "metadata_id" VARCHAR(64) NOT NULL,
    "contract_address" VARCHAR(42),
    "chain_id" INTEGER NOT NULL DEFAULT 43113,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "creator_address" VARCHAR(42) NOT NULL,
    "token_address" VARCHAR(42) NOT NULL,
    "allocation_mode" "allocation_mode" NOT NULL,
    "status" "circle_status" NOT NULL DEFAULT 'DRAFT',
    "max_members" SMALLINT NOT NULL,
    "current_member_count" SMALLINT NOT NULL DEFAULT 0,
    "current_round" SMALLINT NOT NULL DEFAULT 0,
    "total_rounds" SMALLINT NOT NULL,
    "contribution_amount" DECIMAL(78,0) NOT NULL,
    "collateral_amount" DECIMAL(78,0) NOT NULL,
    "round_duration_seconds" INTEGER NOT NULL,
    "bidding_duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "grace_period_seconds" INTEGER NOT NULL,
    "start_deadline" TIMESTAMPTZ(6) NOT NULL,
    "min_bid" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "max_bid" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "total_discount_pool" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "total_yield_earned" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "is_sealed_bid" BOOLEAN NOT NULL DEFAULT true,
    "enable_yield_vault" BOOLEAN NOT NULL DEFAULT true,
    "is_private_invite" BOOLEAN NOT NULL DEFAULT false,
    "invite_code_hash" VARCHAR(66),
    "require_team1_attestation" BOOLEAN NOT NULL DEFAULT false,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "is_hidden_by_admin" BOOLEAN NOT NULL DEFAULT false,
    "moderation_reason" TEXT,
    "creation_tx_hash" VARCHAR(66),
    "activated_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "circles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circle_members" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "circle_id" UUID NOT NULL,
    "user_id" UUID,
    "member_address" VARCHAR(42) NOT NULL,
    "slot_index" SMALLINT NOT NULL,
    "status" "member_status" NOT NULL DEFAULT 'ACTIVE',
    "has_received_payout" BOOLEAN NOT NULL DEFAULT false,
    "won_round_number" SMALLINT,
    "default_count" SMALLINT NOT NULL DEFAULT 0,
    "join_tx_hash" VARCHAR(66) NOT NULL,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "circle_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaterals" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "circle_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "member_address" VARCHAR(42) NOT NULL,
    "initial_locked_amount" DECIMAL(78,0) NOT NULL,
    "current_locked_amount" DECIMAL(78,0) NOT NULL,
    "total_slashed_amount" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "withdrawn_amount" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "discount_bonus_claimed" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "is_withdrawn" BOOLEAN NOT NULL DEFAULT false,
    "withdraw_tx_hash" VARCHAR(66),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collaterals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "circle_id" UUID NOT NULL,
    "round_number" SMALLINT NOT NULL,
    "status" "round_status" NOT NULL DEFAULT 'PENDING',
    "start_time" TIMESTAMPTZ(6),
    "contribution_deadline" TIMESTAMPTZ(6),
    "bidding_deadline" TIMESTAMPTZ(6),
    "grace_deadline" TIMESTAMPTZ(6),
    "winner_address" VARCHAR(42),
    "gross_pot_amount" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "winning_bid_amount" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "net_payout_amount" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "settled_at" TIMESTAMPTZ(6),
    "settlement_tx_hash" VARCHAR(66),

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "circle_id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "round_number" SMALLINT NOT NULL,
    "member_address" VARCHAR(42) NOT NULL,
    "amount" DECIMAL(78,0) NOT NULL,
    "is_from_collateral_slash" BOOLEAN NOT NULL DEFAULT false,
    "tx_hash" VARCHAR(66) NOT NULL,
    "contributed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bids" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "circle_id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "round_number" SMALLINT NOT NULL,
    "bidder_address" VARCHAR(42) NOT NULL,
    "bid_amount" DECIMAL(78,0) NOT NULL,
    "is_winning_bid" BOOLEAN NOT NULL DEFAULT false,
    "tx_hash" VARCHAR(66) NOT NULL,
    "placed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "circle_id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "round_number" SMALLINT NOT NULL,
    "recipient_address" VARCHAR(42) NOT NULL,
    "gross_amount" DECIMAL(78,0) NOT NULL,
    "discount_amount" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(78,0) NOT NULL,
    "tx_hash" VARCHAR(66) NOT NULL,
    "paid_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blockchain_transactions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "chain_id" INTEGER NOT NULL DEFAULT 43113,
    "tx_hash" VARCHAR(66) NOT NULL,
    "sender_address" VARCHAR(42) NOT NULL,
    "contract_address" VARCHAR(42) NOT NULL,
    "circle_id" UUID,
    "tx_type" "tx_type" NOT NULL,
    "status" "tx_status" NOT NULL DEFAULT 'PENDING',
    "block_number" BIGINT,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ(6),

    CONSTRAINT "blockchain_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blockchain_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "chain_id" INTEGER NOT NULL DEFAULT 43113,
    "tx_hash" VARCHAR(66) NOT NULL,
    "log_index" INTEGER NOT NULL,
    "block_number" BIGINT NOT NULL,
    "block_timestamp" TIMESTAMPTZ(6) NOT NULL,
    "contract_address" VARCHAR(42) NOT NULL,
    "event_name" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT true,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blockchain_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indexer_state" (
    "chain_id" INTEGER NOT NULL,
    "last_processed_block" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indexer_state_pkey" PRIMARY KEY ("chain_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "circle_id" UUID,
    "title" VARCHAR(160) NOT NULL,
    "body" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_privy_did_key" ON "users"("privy_did");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_identity_nullifier_key" ON "users"("identity_nullifier");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "auth_nonces_nonce_key" ON "auth_nonces"("nonce");

-- CreateIndex
CREATE INDEX "idx_auth_nonces_address" ON "auth_nonces"("address");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_address_key" ON "wallets"("address");

-- CreateIndex
CREATE INDEX "idx_wallets_user_id" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "idx_wallets_address" ON "wallets"("address");

-- CreateIndex
CREATE UNIQUE INDEX "circles_metadata_id_key" ON "circles"("metadata_id");

-- CreateIndex
CREATE UNIQUE INDEX "circles_contract_address_key" ON "circles"("contract_address");

-- CreateIndex
CREATE INDEX "idx_circles_status" ON "circles"("status");

-- CreateIndex
CREATE INDEX "idx_circles_creator" ON "circles"("creator_address");

-- CreateIndex
CREATE INDEX "idx_circles_contract" ON "circles"("contract_address");

-- CreateIndex
CREATE INDEX "idx_circle_members_address" ON "circle_members"("member_address");

-- CreateIndex
CREATE UNIQUE INDEX "circle_members_circle_id_member_address_key" ON "circle_members"("circle_id", "member_address");

-- CreateIndex
CREATE UNIQUE INDEX "circle_members_circle_id_slot_index_key" ON "circle_members"("circle_id", "slot_index");

-- CreateIndex
CREATE UNIQUE INDEX "collaterals_member_id_key" ON "collaterals"("member_id");

-- CreateIndex
CREATE INDEX "idx_rounds_circle_status" ON "rounds"("circle_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_circle_id_round_number_key" ON "rounds"("circle_id", "round_number");

-- CreateIndex
CREATE INDEX "idx_contributions_member" ON "contributions"("member_address");

-- CreateIndex
CREATE UNIQUE INDEX "contributions_circle_id_round_number_member_address_key" ON "contributions"("circle_id", "round_number", "member_address");

-- CreateIndex
CREATE INDEX "idx_bids_round" ON "bids"("round_id", "bid_amount" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "payouts_round_id_key" ON "payouts"("round_id");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_circle_id_round_number_key" ON "payouts"("circle_id", "round_number");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_circle_id_recipient_address_key" ON "payouts"("circle_id", "recipient_address");

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_transactions_tx_hash_key" ON "blockchain_transactions"("tx_hash");

-- CreateIndex
CREATE INDEX "idx_tx_sender" ON "blockchain_transactions"("sender_address");

-- CreateIndex
CREATE INDEX "idx_events_block_number" ON "blockchain_events"("block_number");

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_events_chain_id_tx_hash_log_index_key" ON "blockchain_events"("chain_id", "tx_hash", "log_index");

-- CreateIndex
CREATE INDEX "idx_notifications_user_unread" ON "notifications"("user_id", "is_read");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circle_members" ADD CONSTRAINT "circle_members_circle_id_fkey" FOREIGN KEY ("circle_id") REFERENCES "circles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circle_members" ADD CONSTRAINT "circle_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaterals" ADD CONSTRAINT "collaterals_circle_id_fkey" FOREIGN KEY ("circle_id") REFERENCES "circles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaterals" ADD CONSTRAINT "collaterals_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "circle_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_circle_id_fkey" FOREIGN KEY ("circle_id") REFERENCES "circles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_circle_id_fkey" FOREIGN KEY ("circle_id") REFERENCES "circles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_circle_id_fkey" FOREIGN KEY ("circle_id") REFERENCES "circles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_circle_id_fkey" FOREIGN KEY ("circle_id") REFERENCES "circles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "blockchain_transactions_circle_id_fkey" FOREIGN KEY ("circle_id") REFERENCES "circles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_circle_id_fkey" FOREIGN KEY ("circle_id") REFERENCES "circles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
