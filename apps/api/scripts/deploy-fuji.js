#!/usr/bin/env node
/**
 * ============================================================================
 * AvaHui V2 — 1-Click Avalanche Fuji Testnet Deployer (solc + viem)
 * Compiles MockUSDC, AvaHuiYieldVault, Team1AttestationVerifier, AvaHuiFactory
 * and deploys them to Avalanche Fuji (Chain ID: 43113), then updates .env files.
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');
const solc = require('solc');
const {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
} = require('viem');
const { privateKeyToAccount, generatePrivateKey } = require('viem/accounts');
const { avalancheFuji } = require('viem/chains');

const ROOT_DIR = path.resolve(__dirname, '../../..');
const CONTRACTS_SRC = path.join(ROOT_DIR, 'apps/contracts/src');
const API_ENV_PATH = path.join(ROOT_DIR, 'apps/api/.env');
const WEB_ENV_PATH = path.join(ROOT_DIR, 'apps/web/.env.local');
const ADDRESSES_TS_PATH = path.join(
  ROOT_DIR,
  'packages/blockchain/src/addresses/index.ts',
);

const FUJI_RPC =
  process.env.AVALANCHE_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';

function compileContracts() {
  console.log('1. Compiling AvaHui V2 Smart Contracts with solc 0.8.24...');
  const files = [
    'interfaces/IERC20Minimal.sol',
    'interfaces/IYieldVault.sol',
    'interfaces/IAvaHuiFactory.sol',
    'interfaces/IAvaHuiCircle.sol',
    'libraries/SecurityLib.sol',
    'mocks/MockUSDC.sol',
    'mocks/AvaHuiYieldVault.sol',
    'verifiers/Team1AttestationVerifier.sol',
    'AvaHuiCircle.sol',
    'AvaHuiFactory.sol',
  ];

  const sources = {};
  for (const rel of files) {
    sources[rel] = {
      content: fs.readFileSync(path.join(CONTRACTS_SRC, rel), 'utf8'),
    };
  }

  const input = {
    language: 'Solidity',
    sources,
    settings: {
      evmVersion: 'paris',
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object'],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((e) => e.severity === 'error');
  if (errors.length > 0) {
    console.error('Solc compilation errors:', errors);
    process.exit(1);
  }

  return {
    MockUSDC: output.contracts['mocks/MockUSDC.sol'].MockUSDC,
    AvaHuiYieldVault:
      output.contracts['mocks/AvaHuiYieldVault.sol'].AvaHuiYieldVault,
    Team1AttestationVerifier:
      output.contracts['verifiers/Team1AttestationVerifier.sol']
        .Team1AttestationVerifier,
    AvaHuiFactory: output.contracts['AvaHuiFactory.sol'].AvaHuiFactory,
  };
}

function getOrInitDeployerKey() {
  let envContent = fs.existsSync(API_ENV_PATH)
    ? fs.readFileSync(API_ENV_PATH, 'utf8')
    : '';
  const match = envContent.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m);
  if (match && match[1]) {
    return match[1];
  }

  const newKey = generatePrivateKey();
  envContent += `\n# --- Auto-generated Avalanche Fuji Deployer Key ---\nDEPLOYER_PRIVATE_KEY=${newKey}\n`;
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

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || getOrInitDeployerKey();
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: avalancheFuji,
    transport: http(FUJI_RPC),
  });

  const walletClient = createWalletClient({
    account,
    chain: avalancheFuji,
    transport: http(FUJI_RPC),
  });

  const balanceWei = await publicClient.getBalance({ address: account.address });
  const balanceAvax = formatEther(balanceWei);

  console.log('============================================================');
  console.log(`Deployer Address : ${account.address}`);
  console.log(`Avalanche Fuji   : ${balanceAvax} AVAX`);
  console.log('============================================================');

  if (balanceWei === 0n) {
    console.log('\n[!] Ví Deployer hiện có 0.00 AVAX trên mạng Avalanche Fuji.');
    console.log('👉 Bước 1: Copy địa chỉ ví Deployer ở trên:');
    console.log(`   ${account.address}`);
    console.log('👉 Bước 2: Nhận AVAX Testnet miễn phí tại Faucet chính thức:');
    console.log('   https://core.app/tools/testnet-faucet/?subnet=c&token=c');
    console.log('   (hoặc https://faucet.avax.network/)');
    console.log('👉 Bước 3: Chạy lại lệnh: pnpm --filter @avahui/api run deploy:fuji\n');
    process.exit(0);
  }

  const artifacts = compileContracts();

  console.log('2. Deploying MockUSDC to Avalanche Fuji...');
  const usdcHash = await walletClient.deployContract({
    abi: artifacts.MockUSDC.abi,
    bytecode: `0x${artifacts.MockUSDC.evm.bytecode.object}`,
  });
  const usdcReceipt = await publicClient.waitForTransactionReceipt({
    hash: usdcHash,
  });
  const usdcAddress = usdcReceipt.contractAddress;
  console.log(`   ✓ MockUSDC deployed at: ${usdcAddress}`);

  console.log('3. Deploying AvaHuiYieldVault (ERC-4626 6.5% APY)...');
  const vaultHash = await walletClient.deployContract({
    abi: artifacts.AvaHuiYieldVault.abi,
    bytecode: `0x${artifacts.AvaHuiYieldVault.evm.bytecode.object}`,
    args: [usdcAddress],
  });
  const vaultReceipt = await publicClient.waitForTransactionReceipt({
    hash: vaultHash,
  });
  const vaultAddress = vaultReceipt.contractAddress;
  console.log(`   ✓ AvaHuiYieldVault deployed at: ${vaultAddress}`);

  console.log('4. Deploying Team1AttestationVerifier (Anti-Sybil)...');
  const verifierHash = await walletClient.deployContract({
    abi: artifacts.Team1AttestationVerifier.abi,
    bytecode: `0x${artifacts.Team1AttestationVerifier.evm.bytecode.object}`,
    args: [account.address],
  });
  const verifierReceipt = await publicClient.waitForTransactionReceipt({
    hash: verifierHash,
  });
  const verifierAddress = verifierReceipt.contractAddress;
  console.log(`   ✓ Team1AttestationVerifier deployed at: ${verifierAddress}`);

  console.log('5. Deploying AvaHuiFactory...');
  const factoryHash = await walletClient.deployContract({
    abi: artifacts.AvaHuiFactory.abi,
    bytecode: `0x${artifacts.AvaHuiFactory.evm.bytecode.object}`,
  });
  const factoryReceipt = await publicClient.waitForTransactionReceipt({
    hash: factoryHash,
  });
  const factoryAddress = factoryReceipt.contractAddress;
  console.log(`   ✓ AvaHuiFactory deployed at: ${factoryAddress}`);

  console.log('6. Linking YieldVault & Team1Verifier into AvaHuiFactory...');
  const linkHash = await walletClient.writeContract({
    address: factoryAddress,
    abi: artifacts.AvaHuiFactory.abi,
    functionName: 'setDefaultModules',
    args: [vaultAddress, verifierAddress],
  });
  await publicClient.waitForTransactionReceipt({ hash: linkHash });
  console.log(`   ✓ Default V2 modules linked (tx=${linkHash})`);

  console.log('7. Minting 10,000 mUSDC & Seeding Live On-Chain Circle...');
  const mintHash = await walletClient.writeContract({
    address: usdcAddress,
    abi: artifacts.MockUSDC.abi,
    functionName: 'mint',
    args: [account.address, 10000000000n], // 10,000 mUSDC
  });
  await publicClient.waitForTransactionReceipt({ hash: mintHash });

  const createCircleHash = await walletClient.writeContract({
    address: factoryAddress,
    abi: artifacts.AvaHuiFactory.abi,
    functionName: 'createCircle',
    args: [
      {
        metadataId: 'meta_live_onchain_01',
        name: 'Hụi Builders UniHack 2026 — Live On-Chain',
        token: usdcAddress,
        allocationMode: 1, // BIDDING
        maxMembers: 5,
        contributionAmount: 100000000n, // 100 mUSDC
        collateralAmount: 100000000n,   // 100 mUSDC
        roundDuration: 180n,
        biddingDuration: 120n,
        gracePeriod: 60n,
        startDeadline: BigInt(Math.floor(Date.now() / 1000) + 7 * 86400),
        minBid: 2000000n,
        maxBid: 40000000n,
      },
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash: createCircleHash });
  console.log(`   ✓ Initial Live Circle deployed on-chain (tx=${createCircleHash})`);

  // Auto-update .env files
  updateEnvVar(API_ENV_PATH, 'AVALANCHE_RPC_URL', FUJI_RPC);
  updateEnvVar(API_ENV_PATH, 'USDC_TOKEN_ADDRESS', usdcAddress);
  updateEnvVar(API_ENV_PATH, 'ROSCA_FACTORY_ADDRESS', factoryAddress);
  updateEnvVar(API_ENV_PATH, 'YIELD_VAULT_ADDRESS', vaultAddress);
  updateEnvVar(API_ENV_PATH, 'SYBIL_VERIFIER_ADDRESS', verifierAddress);
  updateEnvVar(API_ENV_PATH, 'INDEXER_START_BLOCK', '0');

  updateEnvVar(WEB_ENV_PATH, 'NEXT_PUBLIC_AVALANCHE_RPC_URL', FUJI_RPC);
  updateEnvVar(WEB_ENV_PATH, 'NEXT_PUBLIC_USDC_TOKEN_ADDRESS', usdcAddress);
  updateEnvVar(WEB_ENV_PATH, 'NEXT_PUBLIC_ROSCA_FACTORY_ADDRESS', factoryAddress);
  updateEnvVar(WEB_ENV_PATH, 'NEXT_PUBLIC_YIELD_VAULT_ADDRESS', vaultAddress);
  updateEnvVar(WEB_ENV_PATH, 'NEXT_PUBLIC_SYBIL_VERIFIER_ADDRESS', verifierAddress);

  console.log('\n============================================================');
  console.log('🎉 DEPLOYMENT COMPLETE ON AVALANCHE FUJI (43113)!');
  console.log(`- MockUSDC                 : https://testnet.snowtrace.io/address/${usdcAddress}`);
  console.log(`- AvaHuiFactory            : https://testnet.snowtrace.io/address/${factoryAddress}`);
  console.log(`- AvaHuiYieldVault         : https://testnet.snowtrace.io/address/${vaultAddress}`);
  console.log(`- Team1AttestationVerifier : https://testnet.snowtrace.io/address/${verifierAddress}`);
  console.log('============================================================\n');
}

main().catch((err) => {
  console.error('Deployment error:', err);
  process.exit(1);
});
