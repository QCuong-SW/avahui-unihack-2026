#!/usr/bin/env node
/**
 * ============================================================================
 * AvaHui V2 — 1-Click EVM & Avalanche Fuji Deployer (solc + viem)
 * - Compiles MockUSDC, AvaHuiYieldVault, Team1AttestationVerifier, AvaHuiCircle, AvaHuiFactory
 * - Deploys & links default V2 modules on Avalanche Fuji or Local EVM Node (chainId 43113)
 * - In Local EVM mode: mints 10,000 mUSDC + issues Team1 attestations for all 5 builder accounts,
 *   and deploys 2 live on-chain ROSCA circles ready for immediate end-to-end interaction.
 * - Updates apps/api/.env and apps/web/.env.local automatically.
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');
const {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  decodeEventLog,
  keccak256,
  encodePacked,
} = require('viem');
const { privateKeyToAccount, generatePrivateKey } = require('viem/accounts');
const { defineChain } = require('viem');
const { compileAvaHuiContracts, getCompilerTag } = require('./solc-config');

const ROOT_DIR = path.resolve(__dirname, '../../..');
const CONTRACTS_SRC = path.join(ROOT_DIR, 'apps/contracts/src');
const ROOT_ENV_PATH = path.join(ROOT_DIR, '.env');
const API_ENV_PATH = path.join(ROOT_DIR, 'apps/api/.env');
const WEB_ENV_PATH = path.join(ROOT_DIR, 'apps/web/.env.local');

const FUJI_RPC =
  process.env.AVALANCHE_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
const IS_LOCAL_RPC =
  FUJI_RPC.includes('127.0.0.1') || FUJI_RPC.includes('localhost');

const activeChain = defineChain({
  id: 43113,
  name: IS_LOCAL_RPC ? 'Avalanche Fuji (Local EVM)' : 'Avalanche Fuji Testnet',
  nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
  rpcUrls: {
    default: { http: [FUJI_RPC] },
    public: { http: [FUJI_RPC] },
  },
});

// Deterministic Ganache builder keys (#0 -> #4) matching seed.ts & MOCK_DEMO_USERS
const LOCAL_BUILDER_KEYS = [
  '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d', // #0 Minh Nguyễn
  '0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1', // #1 Hoàng Lê
  '0x6370fd033278c143179d81c5526140625662b8daa446c22ee2d73db3707e620c', // #2 Tuấn Phạm
  '0x646f1ce2fdad0e6deeeb5c7e8e5543bdde65e86029e2fd9fc169899c440a7913', // #3 An Trần
  '0xadd53f9a7e588d003326d1cbf9e4a43c061aadd9bc938c843a79e7b4fd2ad743', // #4 Bảo Đặng
];

function compileContracts() {
  console.log(
    `1. Compiling AvaHui V2 Smart Contracts with solc ${getCompilerTag()}...`,
  );
  return compileAvaHuiContracts(CONTRACTS_SRC);
}

function getOrInitEnvKey(keyName) {
  let envContent = fs.existsSync(API_ENV_PATH)
    ? fs.readFileSync(API_ENV_PATH, 'utf8')
    : '';
  const match = envContent.match(new RegExp(`^${keyName}=(0x[0-9a-fA-F]{64})`, 'm'));
  if (match && match[1]) {
    return match[1];
  }

  const newKey = generatePrivateKey();
  if (envContent.length > 0 && !envContent.endsWith('\n')) {
    envContent += '\n';
  }
  envContent += `${keyName}=${newKey}\n`;
  fs.writeFileSync(API_ENV_PATH, envContent, 'utf8');
  return newKey;
}

function updateEnvVar(filePath, key, value) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}`;
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

function extractCircleCreatedAddress(receipt, factoryAbi) {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: factoryAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'CircleCreated' && decoded.args?.circleAddress) {
        return decoded.args.circleAddress;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

async function main() {
  const privateKey =
    process.env.DEPLOYER_PRIVATE_KEY ||
    (IS_LOCAL_RPC ? LOCAL_BUILDER_KEYS[0] : getOrInitEnvKey('DEPLOYER_PRIVATE_KEY'));
  const account = privateKeyToAccount(privateKey);

  const keeperKey =
    process.env.KEEPER_PRIVATE_KEY ||
    (IS_LOCAL_RPC ? LOCAL_BUILDER_KEYS[0] : getOrInitEnvKey('KEEPER_PRIVATE_KEY'));
  const keeperAccount = privateKeyToAccount(keeperKey);

  const verifierKey =
    process.env.VERIFIER_ISSUER_PRIVATE_KEY ||
    (IS_LOCAL_RPC ? LOCAL_BUILDER_KEYS[0] : getOrInitEnvKey('VERIFIER_ISSUER_PRIVATE_KEY'));
  const verifierAccount = privateKeyToAccount(verifierKey);

  const publicClient = createPublicClient({
    chain: activeChain,
    transport: http(FUJI_RPC),
  });

  const walletClient = createWalletClient({
    account,
    chain: activeChain,
    transport: http(FUJI_RPC),
  });

  const balanceWei = await publicClient.getBalance({ address: account.address });
  const balanceAvax = formatEther(balanceWei);

  console.log('============================================================');
  console.log(`RPC Endpoint     : ${FUJI_RPC}`);
  console.log(`Deployer Address : ${account.address} (${balanceAvax} AVAX)`);
  console.log(`Keeper Address   : ${keeperAccount.address}`);
  console.log(`Verifier Issuer  : ${verifierAccount.address}`);
  console.log('============================================================');

  if (balanceWei === 0n) {
    console.log('\n[!] Ví Deployer hiện có 0.00 AVAX trên mạng Avalanche Fuji.');
    console.log(`👉 Copy địa chỉ ví: ${account.address}`);
    console.log('👉 Faucet AVAX Testnet tại: https://core.app/tools/testnet-faucet/?subnet=c&token=c');
    console.log('👉 Chạy lại: pnpm deploy:fuji\n');
    process.exit(0);
  }

  const artifacts = compileContracts();

  console.log('2. Deploying MockUSDC...');
  const usdcHash = await walletClient.deployContract({
    abi: artifacts.MockUSDC.abi,
    bytecode: `0x${artifacts.MockUSDC.evm.bytecode.object}`,
  });
  const usdcReceipt = await publicClient.waitForTransactionReceipt({ hash: usdcHash });
  const usdcAddress = usdcReceipt.contractAddress;
  console.log(`   ✓ MockUSDC: ${usdcAddress}`);

  console.log('3. Deploying AvaHuiYieldVault (ERC-4626 6.5% APY)...');
  const vaultHash = await walletClient.deployContract({
    abi: artifacts.AvaHuiYieldVault.abi,
    bytecode: `0x${artifacts.AvaHuiYieldVault.evm.bytecode.object}`,
    args: [usdcAddress],
  });
  const vaultReceipt = await publicClient.waitForTransactionReceipt({ hash: vaultHash });
  const vaultAddress = vaultReceipt.contractAddress;
  console.log(`   ✓ AvaHuiYieldVault: ${vaultAddress}`);

  console.log('4. Deploying Team1AttestationVerifier (Anti-Sybil)...');
  const verifierHash = await walletClient.deployContract({
    abi: artifacts.Team1AttestationVerifier.abi,
    bytecode: `0x${artifacts.Team1AttestationVerifier.evm.bytecode.object}`,
    args: [IS_LOCAL_RPC ? account.address : verifierAccount.address],
  });
  const verifierReceipt = await publicClient.waitForTransactionReceipt({ hash: verifierHash });
  const verifierAddress = verifierReceipt.contractAddress;
  console.log(`   ✓ Team1AttestationVerifier: ${verifierAddress}`);

  console.log('5. Deploying AvaHuiFactory...');
  const factoryHash = await walletClient.deployContract({
    abi: artifacts.AvaHuiFactory.abi,
    bytecode: `0x${artifacts.AvaHuiFactory.evm.bytecode.object}`,
  });
  const factoryReceipt = await publicClient.waitForTransactionReceipt({ hash: factoryHash });
  const factoryAddress = factoryReceipt.contractAddress;
  console.log(`   ✓ AvaHuiFactory: ${factoryAddress}`);

  console.log('6. Linking YieldVault & Team1Verifier into AvaHuiFactory...');
  const linkHash = await walletClient.writeContract({
    address: factoryAddress,
    abi: artifacts.AvaHuiFactory.abi,
    functionName: 'setDefaultModules',
    args: [vaultAddress, verifierAddress],
  });
  await publicClient.waitForTransactionReceipt({ hash: linkHash });
  console.log(`   ✓ Default V2 modules linked`);

  if (!IS_LOCAL_RPC) {
    const minRoleBalance = parseEther('0.03');
    const maxTopUp = parseEther('0.05');
    for (const [roleLabel, roleAddr] of [
      ['Keeper', keeperAccount.address],
      ['VerifierIssuer', verifierAccount.address],
    ]) {
      if (roleAddr.toLowerCase() === account.address.toLowerCase()) continue;
      const roleBal = await publicClient.getBalance({ address: roleAddr });
      if (roleBal < minRoleBalance) {
        const currentDeployerBal = await publicClient.getBalance({ address: account.address });
        const reserve = parseEther('0.02');
        if (currentDeployerBal > reserve + parseEther('0.01')) {
          const available = currentDeployerBal - reserve;
          const amount = available > maxTopUp * 2n ? maxTopUp : available / 2n;
          console.log(`   -> Funding ${roleLabel} (${roleAddr}) with ${formatEther(amount)} AVAX gas...`);
          const txHash = await walletClient.sendTransaction({
            to: roleAddr,
            value: amount,
          });
          await publicClient.waitForTransactionReceipt({ hash: txHash });
        }
      }
    }
  }

  if (IS_LOCAL_RPC) {
    console.log('7. Funding & Issuing Team1 Anti-Sybil Attestations for all 5 Builders...');
    const builderClients = LOCAL_BUILDER_KEYS.map((pk) => {
      const acc = privateKeyToAccount(pk);
      return {
        account: acc,
        wallet: createWalletClient({
          account: acc,
          chain: activeChain,
          transport: http(FUJI_RPC),
        }),
      };
    });

    for (let i = 0; i < builderClients.length; i++) {
      const b = builderClients[i];
      const mHash = await b.wallet.writeContract({
        address: usdcAddress,
        abi: artifacts.MockUSDC.abi,
        functionName: 'faucet',
        args: [10000_000000n], // 10,000 mUSDC
      });
      await publicClient.waitForTransactionReceipt({ hash: mHash });

      const nullifier = `0x999900001111222233334444555566667777888899990000111122223333000${i + 1}`;
      const aHash = await walletClient.writeContract({
        address: verifierAddress,
        abi: artifacts.Team1AttestationVerifier.abi,
        functionName: 'issueAttestation',
        args: [b.account.address, nullifier, 2],
      });
      await publicClient.waitForTransactionReceipt({ hash: aHash });
    }
    console.log('   ✓ Minted 10,000 mUSDC & verified Team1 Attestation for all 5 accounts.');

    console.log('8. Creating 2 Live On-Chain Circles (Active BIDDING + Recruiting FIXED)...');
    // --- Circle 1: ACTIVE BIDDING (Round #1 Open, 5/5 joined, 3/5 contributed, 2 bids placed) ---
    const createC1Tx = await builderClients[0].wallet.writeContract({
      address: factoryAddress,
      abi: artifacts.AvaHuiFactory.abi,
      functionName: 'createCircle',
      args: [
        {
          metadataId: 'meta_live_bidding_01',
          name: 'Hụi Đầu Tư Avalanche Builders — Đấu Giá Kín V2',
          token: usdcAddress,
          allocationMode: 1, // BIDDING
          maxMembers: 5,
          contributionAmount: 100_000000n,
          collateralAmount: 100_000000n,
          roundDuration: 300n,
          biddingDuration: 180n,
          gracePeriod: 60n,
          startDeadline: BigInt(Math.floor(Date.now() / 1000) + 7 * 86400),
          minBid: 2_000000n,
          maxBid: 40_000000n,
        },
      ],
    });
    const c1Receipt = await publicClient.waitForTransactionReceipt({ hash: createC1Tx });
    const c1Address = extractCircleCreatedAddress(c1Receipt, artifacts.AvaHuiFactory.abi);

    for (let i = 0; i < 5; i++) {
      const b = builderClients[i];
      const appTx = await b.wallet.writeContract({
        address: usdcAddress,
        abi: artifacts.MockUSDC.abi,
        functionName: 'approve',
        args: [c1Address, 1000_000000n],
      });
      await publicClient.waitForTransactionReceipt({ hash: appTx });

      const joinTx = await b.wallet.writeContract({
        address: c1Address,
        abi: artifacts.AvaHuiCircle.abi,
        functionName: 'joinCircle',
        gas: 500_000n,
      });
      await publicClient.waitForTransactionReceipt({ hash: joinTx });
    }

    // Builders #1, #2, #3 contribute Round #1 on-chain
    for (const idx of [1, 2, 3]) {
      const cTx = await builderClients[idx].wallet.writeContract({
        address: c1Address,
        abi: artifacts.AvaHuiCircle.abi,
        functionName: 'contribute',
        args: [1],
        gas: 500_000n,
      });
      await publicClient.waitForTransactionReceipt({ hash: cTx });
    }

    // Builder #2 & #3 place Sealed Bid (Commit + Reveal) & Open Bid on-chain
    const saltB2 = `0x${'22'.repeat(32)}`;
    const commitHashB2 = keccak256(
      encodePacked(
        ['address', 'uint8', 'address', 'uint256', 'bytes32'],
        [c1Address, 1, builderClients[2].account.address, 8_000000n, saltB2],
      ),
    );
    await publicClient.waitForTransactionReceipt({
      hash: await builderClients[2].wallet.writeContract({
        address: c1Address,
        abi: artifacts.AvaHuiCircle.abi,
        functionName: 'commitBid',
        args: [1, commitHashB2],
      }),
    });
    await publicClient.waitForTransactionReceipt({
      hash: await builderClients[2].wallet.writeContract({
        address: c1Address,
        abi: artifacts.AvaHuiCircle.abi,
        functionName: 'revealBid',
        args: [1, 8_000000n, saltB2],
      }),
    });
    await publicClient.waitForTransactionReceipt({
      hash: await builderClients[3].wallet.writeContract({
        address: c1Address,
        abi: artifacts.AvaHuiCircle.abi,
        functionName: 'submitBid',
        args: [1, 12_000000n],
      }),
    });
    console.log(`   ✓ Circle #1 (ACTIVE BIDDING) live at: ${c1Address}`);

    // --- Circle 2: RECRUITING FIXED (4/5 Slots Filled -> Slot #5 ready for Builder #0) ---
    const createC2Tx = await builderClients[1].wallet.writeContract({
      address: factoryAddress,
      abi: artifacts.AvaHuiFactory.abi,
      functionName: 'createCircle',
      args: [
        {
          metadataId: 'meta_live_fixed_02',
          name: 'Hụi Xoay Vòng Cố Định — Còn 1 Slot Cuối',
          token: usdcAddress,
          allocationMode: 0, // FIXED
          maxMembers: 5,
          contributionAmount: 50_000000n,
          collateralAmount: 50_000000n,
          roundDuration: 180n,
          biddingDuration: 0n,
          gracePeriod: 60n,
          startDeadline: BigInt(Math.floor(Date.now() / 1000) + 7 * 86400),
          minBid: 0n,
          maxBid: 0n,
        },
      ],
    });
    const c2Receipt = await publicClient.waitForTransactionReceipt({ hash: createC2Tx });
    const c2Address = extractCircleCreatedAddress(c2Receipt, artifacts.AvaHuiFactory.abi);

    for (const idx of [1, 2, 3, 4]) {
      const b = builderClients[idx];
      await publicClient.waitForTransactionReceipt({
        hash: await b.wallet.writeContract({
          address: usdcAddress,
          abi: artifacts.MockUSDC.abi,
          functionName: 'approve',
          args: [c2Address, 500_000000n],
        }),
      });
      await publicClient.waitForTransactionReceipt({
        hash: await b.wallet.writeContract({
          address: c2Address,
          abi: artifacts.AvaHuiCircle.abi,
          functionName: 'joinCircle',
          gas: 500_000n,
        }),
      });
    }
    console.log(`   ✓ Circle #2 (RECRUITING FIXED 4/5) live at: ${c2Address}`);
  } else {
    const mintHash = await walletClient.writeContract({
      address: usdcAddress,
      abi: artifacts.MockUSDC.abi,
      functionName: 'mint',
      args: [account.address, 10000_000000n],
    });
    await publicClient.waitForTransactionReceipt({ hash: mintHash });
  }

  // Auto-update .env files
  updateEnvVar(API_ENV_PATH, 'AVALANCHE_RPC_URL', FUJI_RPC);
  updateEnvVar(API_ENV_PATH, 'USDC_TOKEN_ADDRESS', usdcAddress);
  updateEnvVar(API_ENV_PATH, 'ROSCA_FACTORY_ADDRESS', factoryAddress);
  updateEnvVar(API_ENV_PATH, 'YIELD_VAULT_ADDRESS', vaultAddress);
  updateEnvVar(API_ENV_PATH, 'SYBIL_VERIFIER_ADDRESS', verifierAddress);
  updateEnvVar(API_ENV_PATH, 'KEEPER_ENABLED', 'true');
  updateEnvVar(API_ENV_PATH, 'INDEXER_ENABLED', 'true');
  updateEnvVar(
    API_ENV_PATH,
    'INDEXER_START_BLOCK',
    String(factoryReceipt.blockNumber),
  );
  updateEnvVar(
    API_ENV_PATH,
    'INDEXER_CONFIRMATION_BLOCKS',
    IS_LOCAL_RPC ? '0' : '2',
  );

  updateEnvVar(WEB_ENV_PATH, 'NEXT_PUBLIC_USE_MOCK', 'false');
  updateEnvVar(WEB_ENV_PATH, 'NEXT_PUBLIC_AVALANCHE_RPC_URL', FUJI_RPC);
  updateEnvVar(WEB_ENV_PATH, 'NEXT_PUBLIC_USDC_TOKEN_ADDRESS', usdcAddress);
  updateEnvVar(WEB_ENV_PATH, 'NEXT_PUBLIC_ROSCA_FACTORY_ADDRESS', factoryAddress);
  updateEnvVar(WEB_ENV_PATH, 'NEXT_PUBLIC_YIELD_VAULT_ADDRESS', vaultAddress);
  updateEnvVar(WEB_ENV_PATH, 'NEXT_PUBLIC_SYBIL_VERIFIER_ADDRESS', verifierAddress);

  updateEnvVar(ROOT_ENV_PATH, 'NEXT_PUBLIC_USE_MOCK', 'false');
  updateEnvVar(ROOT_ENV_PATH, 'AVALANCHE_RPC_URL', FUJI_RPC);
  updateEnvVar(ROOT_ENV_PATH, 'NEXT_PUBLIC_AVALANCHE_RPC_URL', FUJI_RPC);
  updateEnvVar(ROOT_ENV_PATH, 'USDC_TOKEN_ADDRESS', usdcAddress);
  updateEnvVar(ROOT_ENV_PATH, 'NEXT_PUBLIC_USDC_TOKEN_ADDRESS', usdcAddress);
  updateEnvVar(ROOT_ENV_PATH, 'ROSCA_FACTORY_ADDRESS', factoryAddress);
  updateEnvVar(ROOT_ENV_PATH, 'NEXT_PUBLIC_ROSCA_FACTORY_ADDRESS', factoryAddress);
  updateEnvVar(ROOT_ENV_PATH, 'YIELD_VAULT_ADDRESS', vaultAddress);
  updateEnvVar(ROOT_ENV_PATH, 'SYBIL_VERIFIER_ADDRESS', verifierAddress);

  console.log('\n============================================================');
  console.log('🎉 AVAHUI V2 DEPLOYMENT & SEEDING COMPLETE!');
  console.log(`- MockUSDC                 : ${usdcAddress}`);
  console.log(`- AvaHuiFactory            : ${factoryAddress}`);
  console.log(`- AvaHuiYieldVault         : ${vaultAddress}`);
  console.log(`- Team1AttestationVerifier : ${verifierAddress}`);
  console.log('============================================================\n');
}

main().catch((err) => {
  console.error('Deployment error:', err);
  process.exit(1);
});
