import * as fs from 'fs';
import * as path from 'path';
import * as solc from 'solc';
import {
  AllocationMode,
  CircleStatus,
  RoundStatus,
  TransactionType,
  formatTokenUnits,
} from '@avahui/shared';
import {
  AvaHuiCircleABI,
  AvaHuiFactoryABI,
  MockUSDCABI,
  Team1AttestationVerifierABI,
} from '@avahui/blockchain';
import { formatUsdcUnits, normalizeAddress } from '../src/common/utils/format.util';
import { BlockchainIndexerService } from '../src/modules/blockchain/services/blockchain-indexer.service';
import { CirclesService } from '../src/modules/circles/services/circles.service';
import { TransactionsService } from '../src/modules/transactions/services/transactions.service';

describe('Track B — Smart Contracts Compilation, ABI Parity, REST API & Indexer Lifecycle', () => {
  const contractsRoot = path.resolve(__dirname, '../../contracts/src');

  function readSoliditySource(relPath: string): string {
    return fs.readFileSync(path.join(contractsRoot, relPath), 'utf8');
  }

  it('compiles MockUSDC, AvaHuiCircle, and AvaHuiFactory cleanly with solc 0.8.24 and matches @avahui/blockchain ABIs', () => {
    const input = {
      language: 'Solidity',
      sources: {
        'interfaces/IERC20Minimal.sol': {
          content: readSoliditySource('interfaces/IERC20Minimal.sol'),
        },
        'interfaces/IAvaHuiFactory.sol': {
          content: readSoliditySource('interfaces/IAvaHuiFactory.sol'),
        },
        'interfaces/IAvaHuiCircle.sol': {
          content: readSoliditySource('interfaces/IAvaHuiCircle.sol'),
        },
        'interfaces/IYieldVault.sol': {
          content: readSoliditySource('interfaces/IYieldVault.sol'),
        },
        'libraries/SecurityLib.sol': {
          content: readSoliditySource('libraries/SecurityLib.sol'),
        },
        'mocks/MockUSDC.sol': {
          content: readSoliditySource('mocks/MockUSDC.sol'),
        },
        'mocks/AvaHuiYieldVault.sol': {
          content: readSoliditySource('mocks/AvaHuiYieldVault.sol'),
        },
        'verifiers/Team1AttestationVerifier.sol': {
          content: readSoliditySource('verifiers/Team1AttestationVerifier.sol'),
        },
        'AvaHuiCircle.sol': {
          content: readSoliditySource('AvaHuiCircle.sol'),
        },
        'AvaHuiFactory.sol': {
          content: readSoliditySource('AvaHuiFactory.sol'),
        },
      },
      settings: {
        optimizer: { enabled: true, runs: 200 },
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode.object'],
          },
        },
      },
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    const errors = (output.errors || []).filter(
      (e: { severity: string }) => e.severity === 'error',
    );
    expect(errors).toEqual([]);

    const compiledUsdc = output.contracts['mocks/MockUSDC.sol']['MockUSDC'];
    const compiledCircle = output.contracts['AvaHuiCircle.sol']['AvaHuiCircle'];
    const compiledFactory = output.contracts['AvaHuiFactory.sol']['AvaHuiFactory'];
    const compiledVerifier =
      output.contracts['verifiers/Team1AttestationVerifier.sol'][
        'Team1AttestationVerifier'
      ];

    expect(compiledUsdc.evm.bytecode.object.length).toBeGreaterThan(100);
    expect(compiledCircle.evm.bytecode.object.length).toBeGreaterThan(100);
    expect(compiledFactory.evm.bytecode.object.length).toBeGreaterThan(100);
    expect(compiledVerifier.evm.bytecode.object.length).toBeGreaterThan(100);

    const circleEventNames = compiledCircle.abi
      .filter((x: any) => x.type === 'event')
      .map((x: any) => x.name);

    for (const item of AvaHuiCircleABI.filter((x) => x.type === 'event')) {
      expect(circleEventNames).toContain(item.name);
    }

    const circleFnNames = compiledCircle.abi
      .filter((x: any) => x.type === 'function')
      .map((x: any) => x.name);
    for (const item of AvaHuiCircleABI.filter((x) => x.type === 'function')) {
      expect(circleFnNames).toContain(item.name);
    }

    const factoryFnNames = compiledFactory.abi
      .filter((x: any) => x.type === 'function')
      .map((x: any) => x.name);
    for (const item of AvaHuiFactoryABI.filter((x) => x.type === 'function')) {
      expect(factoryFnNames).toContain(item.name);
    }

    const factoryEventNames = compiledFactory.abi
      .filter((x: any) => x.type === 'event')
      .map((x: any) => x.name);
    for (const item of AvaHuiFactoryABI.filter((x) => x.type === 'event')) {
      expect(factoryEventNames).toContain(item.name);
    }

    const verifierFnNames = compiledVerifier.abi
      .filter((x: any) => x.type === 'function')
      .map((x: any) => x.name);
    for (const item of Team1AttestationVerifierABI.filter((x) => x.type === 'function')) {
      expect(verifierFnNames).toContain(item.name);
    }

    const verifierEventNames = compiledVerifier.abi
      .filter((x: any) => x.type === 'event')
      .map((x: any) => x.name);
    for (const item of Team1AttestationVerifierABI.filter((x) => x.type === 'event')) {
      expect(verifierEventNames).toContain(item.name);
    }

    const usdcFnNames = compiledUsdc.abi
      .filter((x: any) => x.type === 'function')
      .map((x: any) => x.name);
    for (const item of MockUSDCABI.filter((x) => x.type === 'function')) {
      expect(usdcFnNames).toContain(item.name);
    }
  });

  it('formats token base units (6 decimals) and normalizes addresses accurately', () => {
    expect(formatUsdcUnits('100000000')).toBe('100.00');
    expect(formatUsdcUnits('485500000')).toBe('485.50');
    expect(formatTokenUnits('15000000')).toBe('15.00');
    expect(normalizeAddress('0x71C95911E9a5D330f4D621842EC243EE13432921')).toBe(
      '0x71c95911e9a5d330f4d621842ec243ee13432921',
    );
  });

  it('processes blockchain events idempotently via UNIQUE (chainId, txHash, logIndex)', async () => {
    const processedEvents = new Set<string>();
    const createdCircles: any[] = [];

    const mockPrisma: any = {
      blockchainEvent: {
        findUnique: jest.fn(({ where }) => {
          const key = `${where.chainId_txHash_logIndex.chainId}:${where.chainId_txHash_logIndex.txHash}:${where.chainId_txHash_logIndex.logIndex}`;
          return processedEvents.has(key) ? { id: 'evt_1' } : null;
        }),
        create: jest.fn(({ data }) => {
          const key = `${data.chainId}:${data.txHash}:${data.logIndex}`;
          processedEvents.add(key);
          return data;
        }),
      },
      circle: {
        upsert: jest.fn(({ create }) => {
          const obj = { id: 'cir_uuid_1', ...create };
          createdCircles.push(obj);
          return obj;
        }),
      },
      blockchainTransaction: {
        upsert: jest.fn(({ create }) => create),
      },
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    };

    const indexer = new BlockchainIndexerService(mockPrisma);

    const eventInput = {
      chainId: 43113,
      txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      logIndex: 0,
      blockNumber: 100n,
      blockTimestamp: new Date(),
      contractAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      eventName: 'CircleCreated',
      args: {
        circleAddress: '0x9A676e781A523b5d0C0e43731313A708CB607508',
        creator: '0x71C95911E9a5D330f4D621842EC243EE13432921',
        metadataId: 'meta_test_01',
        name: 'Test Circle',
        token: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        allocationMode: 1,
        maxMembers: 5,
        contributionAmount: 100000000n,
        collateralAmount: 100000000n,
      },
    };

    const firstRun = await indexer.processDecodedEvent(eventInput);
    const secondRun = await indexer.processDecodedEvent(eventInput);

    expect(firstRun).toBe(true);
    expect(secondRun).toBe(false);
    expect(createdCircles.length).toBe(1);
    expect(createdCircles[0].allocationMode).toBe(AllocationMode.BIDDING);
    expect(createdCircles[0].status).toBe(CircleStatus.Recruiting);
    expect(RoundStatus.Open).toBe('OPEN');
    expect(TransactionType.CREATE_CIRCLE).toBe('CREATE_CIRCLE');
  });

  it('creates circle drafts and tracks pending transactions accurately', async () => {
    const dbCircles = new Map<string, any>();
    const dbTxs = new Map<string, any>();

    const mockPrisma: any = {
      circle: {
        create: jest.fn(({ data }) => {
          const record = {
            id: '11111111-2222-3333-4444-555555555555',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            members: [],
            rounds: [],
          };
          dbCircles.set(record.id, record);
          return record;
        }),
        findFirst: jest.fn(({ where }) => {
          if (where.id) return dbCircles.get(where.id) || null;
          return Array.from(dbCircles.values())[0] || null;
        }),
        findUnique: jest.fn(() => Array.from(dbCircles.values())[0] || null),
      },
      wallet: {
        findMany: jest.fn(() => []),
      },
      blockchainTransaction: {
        upsert: jest.fn(({ where, create }) => {
          const item = {
            id: 'tx_1',
            ...create,
            blockNumber: null,
            errorMessage: null,
            createdAt: new Date(),
            confirmedAt: null,
            circle: Array.from(dbCircles.values())[0] || null,
          };
          dbTxs.set(where.txHash, item);
          return item;
        }),
      },
    };

    const circlesService = new CirclesService(mockPrisma);
    const txService = new TransactionsService(mockPrisma);

    const draft = await circlesService.createDraft(
      {
        privyDid: 'did:privy:usr_01HXYZ1',
        walletAddress: '0x71C95911E9a5D330f4D621842EC243EE13432921',
      },
      {
        name: 'Hụi Đầu Tư Avalanche UniHack',
        allocationMode: AllocationMode.BIDDING,
        maxMembers: 5,
        contributionAmount: '100000000',
        collateralAmount: '100000000',
        roundDurationSeconds: 300,
        biddingDurationSeconds: 180,
        gracePeriodSeconds: 60,
        minBid: '2000000',
        maxBid: '40000000',
      },
    );

    expect(draft.metadataId).toMatch(/^meta_/);
    expect(draft.circle.contributionAmountFormatted).toBe('100.00');
    expect(draft.circle.maxMembers).toBe(5);

    const tracked = await txService.trackTransaction(
      {
        privyDid: 'did:privy:usr_01HXYZ1',
        walletAddress: '0x71C95911E9a5D330f4D621842EC243EE13432921',
      },
      {
        txHash: '0x88a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef01',
        txType: TransactionType.CREATE_CIRCLE,
        contractAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        circleId: draft.id,
      },
    );

    expect(tracked.status).toBe('PENDING');
    expect(tracked.txType).toBe('CREATE_CIRCLE');
    expect(tracked.circleName).toBe('Hụi Đầu Tư Avalanche UniHack');
  });
});
