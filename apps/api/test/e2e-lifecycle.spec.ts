import {
  AllocationMode,
  CircleStatus,
  MemberStatus,
  RoundStatus,
  TransactionType,
} from '@avahui/shared';
import { formatUsdcUnits, normalizeAddress } from '../src/common/utils/format.util';
import {
  BlockchainIndexerService,
  IndexedEventInput,
} from '../src/modules/blockchain/services/blockchain-indexer.service';

describe('Track B / Stage 5 — End-to-End Circle Lifecycle & Indexer Synchronization', () => {
  // In-memory relational database state for simulation
  let dbCircles: Map<string, any>;
  let dbMembers: Map<string, any>;
  let dbCollaterals: Map<string, any>;
  let dbRounds: Map<string, any>;
  let dbContributions: Map<string, any>;
  let dbBids: Map<string, any>;
  let dbPayouts: Map<string, any>;
  let dbTransactions: Map<string, any>;
  let dbEvents: Map<string, any>;
  let dbNotifications: any[];
  let dbIndexerState: any;

  let mockPrisma: any;
  let indexerService: BlockchainIndexerService;

  const CHAIN_ID = 43113;
  const FACTORY_ADDRESS = normalizeAddress('0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512');
  const CIRCLE_ADDRESS = normalizeAddress('0x9A676e781A523b5d0C0e43731313A708CB607508');
  const TOKEN_ADDRESS = normalizeAddress('0x5FbDB2315678afecb367f032d93F642f64180aa3');

  const USERS = [
    { address: normalizeAddress('0x71C95911E9a5D330f4D621842EC243EE13432921'), userId: 'usr_01' },
    { address: normalizeAddress('0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'), userId: 'usr_02' },
    { address: normalizeAddress('0x9965507D1a55bcC2695C58ba16FB37d819B0A4df'), userId: 'usr_03' },
    { address: normalizeAddress('0x976EA74026E72CD1110150531856037a981a3C29'), userId: 'usr_04' },
    { address: normalizeAddress('0x90F79bf6EB2c4f870365E785982E1f101E93b906'), userId: 'usr_05' },
  ];

  beforeEach(() => {
    dbCircles = new Map();
    dbMembers = new Map();
    dbCollaterals = new Map();
    dbRounds = new Map();
    dbContributions = new Map();
    dbBids = new Map();
    dbPayouts = new Map();
    dbTransactions = new Map();
    dbEvents = new Map();
    dbNotifications = [];
    dbIndexerState = null;

    mockPrisma = {
      indexerState: {
        findUnique: jest.fn(() => dbIndexerState),
        create: jest.fn(({ data }) => {
          dbIndexerState = { ...data };
          return dbIndexerState;
        }),
        update: jest.fn(({ data }) => {
          dbIndexerState = { ...dbIndexerState, ...data };
          return dbIndexerState;
        }),
      },
      blockchainEvent: {
        findUnique: jest.fn(({ where }) => {
          const key = `${where.chainId_txHash_logIndex.chainId}:${where.chainId_txHash_logIndex.txHash}:${where.chainId_txHash_logIndex.logIndex}`;
          return dbEvents.get(key) || null;
        }),
        create: jest.fn(({ data }) => {
          const key = `${data.chainId}:${data.txHash}:${data.logIndex}`;
          dbEvents.set(key, data);
          return data;
        }),
      },
      circle: {
        upsert: jest.fn(({ where, create, update }) => {
          let item = dbCircles.get(where.metadataId);
          if (item) {
            Object.assign(item, update);
          } else {
            item = { id: `cir_${Date.now()}_${Math.random()}`, ...create };
            dbCircles.set(where.metadataId, item);
          }
          return item;
        }),
        findUnique: jest.fn(({ where }) => {
          if (where.contractAddress) {
            return Array.from(dbCircles.values()).find(
              (c) => c.contractAddress === where.contractAddress,
            ) || null;
          }
          if (where.id) return dbCircles.get(where.id) || null;
          return null;
        }),
        findMany: jest.fn(() => Array.from(dbCircles.values())),
        update: jest.fn(({ where, data }) => {
          const item = Array.from(dbCircles.values()).find(
            (c) => c.id === where.id || c.contractAddress === where.contractAddress,
          );
          if (item) Object.assign(item, data);
          return item;
        }),
      },
      circleMember: {
        upsert: jest.fn(({ where, create, update }) => {
          const key = `${where.circleId_memberAddress.circleId}:${where.circleId_memberAddress.memberAddress}`;
          let item = dbMembers.get(key);
          if (item) {
            Object.assign(item, update);
          } else {
            item = { id: `mem_${dbMembers.size + 1}`, ...create };
            dbMembers.set(key, item);
          }
          return item;
        }),
        findUnique: jest.fn(({ where }) => {
          if (where.circleId_memberAddress) {
            const key = `${where.circleId_memberAddress.circleId}:${where.circleId_memberAddress.memberAddress}`;
            const mem = dbMembers.get(key);
            if (!mem) return null;
            const col = dbCollaterals.get(mem.id);
            return { ...mem, collateral: col };
          }
          if (where.id) {
            const mem = Array.from(dbMembers.values()).find((m) => m.id === where.id);
            if (!mem) return null;
            const col = dbCollaterals.get(mem.id);
            return { ...mem, collateral: col };
          }
          return null;
        }),
        findMany: jest.fn(({ where }) => {
          return Array.from(dbMembers.values()).filter((m) => {
            if (where.circleId && m.circleId !== where.circleId) return false;
            return true;
          });
        }),
        count: jest.fn(({ where }) => {
          return Array.from(dbMembers.values()).filter((m) => m.circleId === where.circleId).length;
        }),
        update: jest.fn(({ where, data }) => {
          const mem = Array.from(dbMembers.values()).find((m) => m.id === where.id);
          if (mem) {
            if (data.defaultCount?.increment) {
              mem.defaultCount = (mem.defaultCount || 0) + data.defaultCount.increment;
            }
            if (data.status) mem.status = data.status;
          }
          return mem;
        }),
        updateMany: jest.fn(({ where, data }) => {
          Array.from(dbMembers.values()).forEach((m) => {
            if (m.circleId === where.circleId && m.memberAddress === where.memberAddress) {
              Object.assign(m, data);
            }
          });
          return { count: 1 };
        }),
      },
      collateral: {
        upsert: jest.fn(({ where, create, update }) => {
          let item = dbCollaterals.get(where.memberId);
          if (item) {
            Object.assign(item, update);
          } else {
            item = { id: `col_${dbCollaterals.size + 1}`, ...create, totalSlashedAmount: '0' };
            dbCollaterals.set(where.memberId, item);
          }
          return item;
        }),
        update: jest.fn(({ where, data }) => {
          const item = Array.from(dbCollaterals.values()).find((c) => c.id === where.id);
          if (item) Object.assign(item, data);
          return item;
        }),
      },
      round: {
        upsert: jest.fn(({ where, create, update }) => {
          const key = `${where.circleId_roundNumber.circleId}:${where.circleId_roundNumber.roundNumber}`;
          let item = dbRounds.get(key);
          if (item) {
            Object.assign(item, update);
          } else {
            item = { id: `rnd_${where.circleId_roundNumber.roundNumber}`, ...create };
            dbRounds.set(key, item);
          }
          return item;
        }),
        update: jest.fn(({ where, data }) => {
          const item = Array.from(dbRounds.values()).find((r) => r.id === where.id);
          if (item) Object.assign(item, data);
          return item;
        }),
      },
      contribution: {
        upsert: jest.fn(({ where, create, update }) => {
          const key = `${where.circleId_roundNumber_memberAddress.circleId}:${where.circleId_roundNumber_memberAddress.roundNumber}:${where.circleId_roundNumber_memberAddress.memberAddress}`;
          let item = dbContributions.get(key);
          if (item) {
            item = { ...item, ...update };
          } else {
            item = { id: `contrib_${dbContributions.size + 1}`, ...create };
          }
          dbContributions.set(key, item);
          return item;
        }),
      },
      bid: {
        create: jest.fn(({ data }) => {
          const item = { id: `bid_${dbBids.size + 1}`, ...data };
          dbBids.set(item.id, item);
          return item;
        }),
        findFirst: jest.fn(({ where }) => {
          return (
            Array.from(dbBids.values()).find(
              (b) =>
                b.roundId === where.roundId &&
                b.bidderAddress === where.bidderAddress &&
                b.bidAmount === where.bidAmount,
            ) || null
          );
        }),
        update: jest.fn(({ where, data }) => {
          const item = dbBids.get(where.id);
          if (item) Object.assign(item, data);
          return item;
        }),
      },
      payout: {
        upsert: jest.fn(({ where, create, update }) => {
          let item = dbPayouts.get(where.roundId);
          if (item) {
            item = { ...item, ...update };
          } else {
            item = { id: `payout_${dbPayouts.size + 1}`, ...create };
          }
          dbPayouts.set(where.roundId, item);
          return item;
        }),
      },
      blockchainTransaction: {
        upsert: jest.fn(({ where, create, update }) => {
          let item = dbTransactions.get(where.txHash);
          if (item) {
            item = { ...item, ...update };
          } else {
            item = { id: `tx_${dbTransactions.size + 1}`, ...create };
          }
          dbTransactions.set(where.txHash, item);
          return item;
        }),
      },
      wallet: {
        findUnique: jest.fn(({ where }) => {
          const user = USERS.find((u) => u.address === where.address);
          return user ? { userId: user.userId, address: user.address } : null;
        }),
      },
      notification: {
        create: jest.fn(({ data }) => {
          dbNotifications.push(data);
          return data;
        }),
        createMany: jest.fn(({ data }) => {
          dbNotifications.push(...data);
          return { count: data.length };
        }),
      },
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    };

    indexerService = new BlockchainIndexerService(mockPrisma);
  });

  it('orchestrates the entire 10-step ROSCA lifecycle via smart contract event indexing', async () => {
    // -------------------------------------------------------------------------
    // STEP 1: Factory creates Circle -> CircleCreated event
    // -------------------------------------------------------------------------
    const createEvent: IndexedEventInput = {
      chainId: CHAIN_ID,
      txHash: '0xaaaa000100000000000000000000000000000000000000000000000000000001',
      logIndex: 0,
      blockNumber: 38500001n,
      blockTimestamp: new Date('2026-11-08T10:00:00Z'),
      contractAddress: FACTORY_ADDRESS,
      eventName: 'CircleCreated',
      args: {
        circleAddress: CIRCLE_ADDRESS,
        creator: USERS[0].address,
        metadataId: 'meta_unihack_lifecycle_01',
        name: 'Hụi Builders UniHack 2026 — Dây 5 Người',
        token: TOKEN_ADDRESS,
        allocationMode: 1, // BIDDING
        maxMembers: 5,
        contributionAmount: 100000000n, // 100 USDC
        collateralAmount: 100000000n,   // 100 USDC
      },
    };

    const indexedCreate = await indexerService.processDecodedEvent(createEvent);
    expect(indexedCreate).toBe(true);

    const circle = Array.from(dbCircles.values())[0];
    expect(circle).toBeDefined();
    expect(circle.status).toBe(CircleStatus.Recruiting);
    expect(circle.allocationMode).toBe(AllocationMode.BIDDING);
    expect(circle.maxMembers).toBe(5);
    expect(circle.contractAddress).toBe(CIRCLE_ADDRESS);

    // -------------------------------------------------------------------------
    // STEP 2: 5 Members join sequentially -> MemberJoined events
    // -------------------------------------------------------------------------
    for (let i = 0; i < 5; i++) {
      const joinEvent: IndexedEventInput = {
        chainId: CHAIN_ID,
        txHash: `0xbbbb000${i + 1}0000000000000000000000000000000000000000000000000000000${i + 1}`,
        logIndex: 0,
        blockNumber: BigInt(38500010 + i),
        blockTimestamp: new Date(`2026-11-08T10:0${i + 1}:00Z`),
        contractAddress: CIRCLE_ADDRESS,
        eventName: 'MemberJoined',
        args: {
          circleAddress: CIRCLE_ADDRESS,
          member: USERS[i].address,
          slotIndex: i + 1,
          collateralLocked: 100000000n,
        },
      };

      const res = await indexerService.processDecodedEvent(joinEvent);
      expect(res).toBe(true);
    }

    expect(dbMembers.size).toBe(5);
    expect(dbCollaterals.size).toBe(5);
    expect(circle.currentMemberCount).toBe(5);

    // -------------------------------------------------------------------------
    // STEP 3: Circle reaches max members and activates -> CircleActivated event
    // -------------------------------------------------------------------------
    const activateEvent: IndexedEventInput = {
      chainId: CHAIN_ID,
      txHash: '0xcccc000100000000000000000000000000000000000000000000000000000001',
      logIndex: 1,
      blockNumber: 38500015n,
      blockTimestamp: new Date('2026-11-08T10:05:00Z'),
      contractAddress: CIRCLE_ADDRESS,
      eventName: 'CircleActivated',
      args: {
        circleAddress: CIRCLE_ADDRESS,
        startTime: 1762596300,
        currentRound: 1,
        contributionDeadline: 1762596600,
        biddingDeadline: 1762596480,
      },
    };

    const indexedActivate = await indexerService.processDecodedEvent(activateEvent);
    expect(indexedActivate).toBe(true);
    expect(circle.status).toBe(CircleStatus.Active);
    expect(circle.currentRound).toBe(1);

    const round1Key = `${circle.id}:1`;
    const round1 = dbRounds.get(round1Key);
    expect(round1).toBeDefined();
    expect(round1.status).toBe(RoundStatus.Open);
    expect(round1.grossPotAmount).toBe('500000000'); // 5 * 100 USDC

    // -------------------------------------------------------------------------
    // STEP 4: All 5 members contribute to Round 1 -> ContributionMade events
    // -------------------------------------------------------------------------
    for (let i = 0; i < 5; i++) {
      const contribEvent: IndexedEventInput = {
        chainId: CHAIN_ID,
        txHash: `0xc111000${i + 1}0000000000000000000000000000000000000000000000000000000${i + 1}`,
        logIndex: 0,
        blockNumber: BigInt(38500020 + i),
        blockTimestamp: new Date(`2026-11-08T10:06:0${i}Z`),
        contractAddress: CIRCLE_ADDRESS,
        eventName: 'ContributionMade',
        args: {
          circleAddress: CIRCLE_ADDRESS,
          roundNumber: 1,
          member: USERS[i].address,
          amount: 100000000n,
        },
      };
      await indexerService.processDecodedEvent(contribEvent);
    }

    const round1Contribs = Array.from(dbContributions.values()).filter(
      (c) => c.circleId === circle.id && c.roundNumber === 1,
    );
    expect(round1Contribs.length).toBe(5);

    // -------------------------------------------------------------------------
    // STEP 5: Competitive Bidding in Round 1 -> BidSubmitted events
    // -------------------------------------------------------------------------
    // User 2 bids 10 USDC
    const bid1: IndexedEventInput = {
      chainId: CHAIN_ID,
      txHash: '0xb111000100000000000000000000000000000000000000000000000000000001',
      logIndex: 0,
      blockNumber: 38500026n,
      blockTimestamp: new Date('2026-11-08T10:06:30Z'),
      contractAddress: CIRCLE_ADDRESS,
      eventName: 'BidSubmitted',
      args: {
        circleAddress: CIRCLE_ADDRESS,
        roundNumber: 1,
        bidder: USERS[1].address,
        bidAmount: 10000000n, // 10 USDC
      },
    };
    await indexerService.processDecodedEvent(bid1);

    // User 3 outbids with 15 USDC
    const bid2: IndexedEventInput = {
      chainId: CHAIN_ID,
      txHash: '0xb111000200000000000000000000000000000000000000000000000000000002',
      logIndex: 0,
      blockNumber: 38500028n,
      blockTimestamp: new Date('2026-11-08T10:06:45Z'),
      contractAddress: CIRCLE_ADDRESS,
      eventName: 'BidSubmitted',
      args: {
        circleAddress: CIRCLE_ADDRESS,
        roundNumber: 1,
        bidder: USERS[2].address,
        bidAmount: 15000000n, // 15 USDC
      },
    };
    await indexerService.processDecodedEvent(bid2);

    expect(dbBids.size).toBe(2);
    expect(round1.winningBidAmount).toBe('15000000');
    expect(round1.netPayoutAmount).toBe('485000000'); // 500 - 15 = 485 USDC

    // -------------------------------------------------------------------------
    // STEP 6: Settle Round 1 -> RoundSettled event
    // -------------------------------------------------------------------------
    const settleR1Event: IndexedEventInput = {
      chainId: CHAIN_ID,
      txHash: '0xdddd000100000000000000000000000000000000000000000000000000000001',
      logIndex: 0,
      blockNumber: 38500035n,
      blockTimestamp: new Date('2026-11-08T10:08:00Z'),
      contractAddress: CIRCLE_ADDRESS,
      eventName: 'RoundSettled',
      args: {
        circleAddress: CIRCLE_ADDRESS,
        roundNumber: 1,
        recipient: USERS[2].address,
        grossPotAmount: 500000000n,
        winningBidAmount: 15000000n,
        netPayoutAmount: 485000000n,
        nextRoundNumber: 2,
      },
    };

    await indexerService.processDecodedEvent(settleR1Event);

    expect(round1.status).toBe(RoundStatus.Settled);
    expect(round1.winnerAddress).toBe(USERS[2].address);

    const winnerMember = Array.from(dbMembers.values()).find(
      (m) => m.memberAddress === USERS[2].address,
    );
    expect(winnerMember.hasReceivedPayout).toBe(true);
    expect(winnerMember.wonRoundNumber).toBe(1);

    expect(circle.totalDiscountPool).toBe('15000000');
    expect(circle.currentRound).toBe(2);

    const round2 = dbRounds.get(`${circle.id}:2`);
    expect(round2).toBeDefined();
    expect(round2.status).toBe(RoundStatus.Open);

    // -------------------------------------------------------------------------
    // STEP 7: Round 2 Auto-Slash simulation -> CollateralSlashed event
    // (User 5 fails to contribute -> Collateral is slashed)
    // -------------------------------------------------------------------------
    const slashEvent: IndexedEventInput = {
      chainId: CHAIN_ID,
      txHash: '0xeeee000100000000000000000000000000000000000000000000000000000001',
      logIndex: 0,
      blockNumber: 38500050n,
      blockTimestamp: new Date('2026-11-08T10:12:00Z'),
      contractAddress: CIRCLE_ADDRESS,
      eventName: 'CollateralSlashed',
      args: {
        circleAddress: CIRCLE_ADDRESS,
        roundNumber: 2,
        defaultedMember: USERS[4].address,
        slashedAmount: 100000000n, // 100 USDC slashed
        remainingCollateral: 0n,   // 0 left
      },
    };

    await indexerService.processDecodedEvent(slashEvent);

    const slashedMember = Array.from(dbMembers.values()).find(
      (m) => m.memberAddress === USERS[4].address,
    );
    expect(slashedMember.status).toBe(MemberStatus.Defaulted);
    expect(slashedMember.defaultCount).toBe(1);

    const slashedContrib = Array.from(dbContributions.values()).find(
      (c) => c.memberAddress === USERS[4].address && c.roundNumber === 2,
    );
    expect(slashedContrib.isFromCollateralSlash).toBe(true);
    expect(slashedContrib.amount).toBe('100000000');

    // -------------------------------------------------------------------------
    // STEP 8: Settle remaining rounds 2..5 -> RoundSettled events
    // -------------------------------------------------------------------------
    for (let r = 2; r <= 5; r++) {
      const recipient = USERS[r === 2 ? 0 : r === 3 ? 1 : r === 4 ? 3 : 4].address;
      const settleEvent: IndexedEventInput = {
        chainId: CHAIN_ID,
        txHash: `0xdddd000${r}0000000000000000000000000000000000000000000000000000000${r}`,
        logIndex: 0,
        blockNumber: BigInt(38500050 + r * 10),
        blockTimestamp: new Date(`2026-11-08T10:${15 + r}:00Z`),
        contractAddress: CIRCLE_ADDRESS,
        eventName: 'RoundSettled',
        args: {
          circleAddress: CIRCLE_ADDRESS,
          roundNumber: r,
          recipient,
          grossPotAmount: 500000000n,
          winningBidAmount: 0n,
          netPayoutAmount: 500000000n,
          nextRoundNumber: r === 5 ? 0 : r + 1,
        },
      };
      await indexerService.processDecodedEvent(settleEvent);
    }

    expect(dbPayouts.size).toBe(5);

    // -------------------------------------------------------------------------
    // STEP 9: Circle completes -> CircleCompleted event
    // -------------------------------------------------------------------------
    const completeEvent: IndexedEventInput = {
      chainId: CHAIN_ID,
      txHash: '0xffff000100000000000000000000000000000000000000000000000000000001',
      logIndex: 1,
      blockNumber: 38500110n,
      blockTimestamp: new Date('2026-11-08T10:30:00Z'),
      contractAddress: CIRCLE_ADDRESS,
      eventName: 'CircleCompleted',
      args: {
        circleAddress: CIRCLE_ADDRESS,
        totalDiscountPool: 15000000n,
      },
    };

    await indexerService.processDecodedEvent(completeEvent);
    expect(circle.status).toBe(CircleStatus.Completed);
    expect(circle.totalDiscountPool).toBe('15000000');

    // -------------------------------------------------------------------------
    // STEP 10: Members claim collateral + discount bonus -> CollateralWithdrawn
    // -------------------------------------------------------------------------
    // Bonus per member = 15 USDC / 5 = 3 USDC
    const bonusPerMember = 15000000n / 5n; // 3000000n (3 USDC)

    for (let i = 0; i < 4; i++) {
      const withdrawEvent: IndexedEventInput = {
        chainId: CHAIN_ID,
        txHash: `0x9999000${i + 1}0000000000000000000000000000000000000000000000000000000${i + 1}`,
        logIndex: 0,
        blockNumber: BigInt(38500120 + i),
        blockTimestamp: new Date(`2026-11-08T10:35:0${i}Z`),
        contractAddress: CIRCLE_ADDRESS,
        eventName: 'CollateralWithdrawn',
        args: {
          circleAddress: CIRCLE_ADDRESS,
          member: USERS[i].address,
          collateralReturned: 100000000n,
          discountBonusReturned: bonusPerMember,
        },
      };

      const res = await indexerService.processDecodedEvent(withdrawEvent);
      expect(res).toBe(true);

      const mem = Array.from(dbMembers.values()).find((m) => m.memberAddress === USERS[i].address);
      expect(mem.status).toBe(MemberStatus.Withdrawn);
      const col = dbCollaterals.get(mem.id);
      expect(col.currentLockedAmount).toBe('0');
      expect(col.withdrawnAmount).toBe('100000000');
      expect(col.discountBonusClaimed).toBe(bonusPerMember.toString());
      expect(col.isWithdrawn).toBe(true);
    }

    // -------------------------------------------------------------------------
    // STEP 11: Idempotency verification
    // Re-indexing any event returns false and does not alter database state
    // -------------------------------------------------------------------------
    const reindexedCreate = await indexerService.processDecodedEvent(createEvent);
    const reindexedComplete = await indexerService.processDecodedEvent(completeEvent);
    expect(reindexedCreate).toBe(false);
    expect(reindexedComplete).toBe(false);
  });
});
