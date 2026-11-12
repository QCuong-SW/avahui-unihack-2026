#!/usr/bin/env node
/**
 * Verifies live AvaHui V2 contracts on Avalanche Fuji (`43113`) using the exact
 * Standard JSON Input compiled by `deploy-fuji.js`:
 *  - Primary: Sourcify API v2 (https://sourcify.dev/server) — keyless, open-source exact match.
 *  - Optional (`--routescan` or when `SNOWTRACE_API_KEY` is set): Routescan / Snowtrace Etherscan API.
 */
const fs = require('fs');
const path = require('path');
const {
  createPublicClient,
  http,
  encodeAbiParameters,
  parseAbiParameters,
} = require('viem');
const { avalancheFuji } = require('viem/chains');
const {
  buildSolcInput,
  compileAvaHuiContracts,
  getCompilerTag,
} = require('./solc-config');

const ROOT_DIR = path.resolve(__dirname, '../../..');
const CONTRACTS_SRC = path.join(ROOT_DIR, 'apps/contracts/src');
const API_ENV_PATH = path.join(ROOT_DIR, 'apps/api/.env');
const SOURCIFY_API_BASE = 'https://sourcify.dev/server';
const ROUTESCAN_API_URL =
  process.env.VERIFIER_API_URL ||
  'https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function loadEnvMap(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let val = line.slice(eqIndex + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyOnSourcify({
  label,
  address,
  contractName,
  solcInput,
  compilerVersionNoPrefix,
}) {
  const headers = {
    'User-Agent': 'AvaHui-Verify-Fuji/2.1 (https://github.com/QCuong-SW/avahui-unihack-2026)',
  };

  const checkRes = await fetch(`${SOURCIFY_API_BASE}/v2/contract/43113/${address}`, {
    headers,
  });
  if (checkRes.ok) {
    const existing = await checkRes.json();
    if (existing?.match === 'exact_match' || existing?.match === 'match') {
      console.log(`✓ [Sourcify] ${label} (${address}) already verified (${existing.match})`);
      return { status: existing.match };
    }
  }

  console.log(`→ [Sourcify] Submitting ${label} (${address}) [${contractName}]...`);
  const submitRes = await fetch(`${SOURCIFY_API_BASE}/v2/verify/43113/${address}`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      stdJsonInput: solcInput,
      compilerVersion: compilerVersionNoPrefix,
      contractIdentifier: contractName,
    }),
  });
  const submitJson = await submitRes.json();
  if (!submitRes.ok || !submitJson?.verificationId) {
    throw new Error(
      `[Sourcify] ${label} submit failed (${submitRes.status}): ${JSON.stringify(submitJson)}`,
    );
  }

  const jobId = submitJson.verificationId;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    await sleep(2000);
    const pollRes = await fetch(`${SOURCIFY_API_BASE}/v2/verify/${jobId}`, {
      headers,
    });
    const pollJson = await pollRes.json();
    if (pollJson?.isJobCompleted) {
      if (pollJson?.error) {
        throw new Error(`[Sourcify] ${label} failed: ${JSON.stringify(pollJson.error)}`);
      }
      const matchType = pollJson?.contract?.match || 'verified';
      console.log(`✓ [Sourcify] Verified ${label} (${address}) [${matchType}]`);
      return { status: matchType };
    }
  }
  throw new Error(`[Sourcify] ${label} verification timed out (job=${jobId})`);
}

async function isRoutescanVerified(address, apiKey) {
  const url = `${ROUTESCAN_API_URL}?module=contract&action=getsourcecode&address=${address}${apiKey ? `&apikey=${encodeURIComponent(apiKey)}` : ''}`;
  const res = await fetch(url);
  const data = await res.json();
  const entry = Array.isArray(data?.result) ? data.result[0] : null;
  return Boolean(entry && entry.SourceCode && entry.ContractName);
}

async function submitRoutescanVerification({
  label,
  address,
  contractName,
  constructorArguments,
  sourceCodeJson,
  compilerVersion,
  apiKey,
}) {
  if (await isRoutescanVerified(address, apiKey)) {
    console.log(`✓ [Routescan] ${label} (${address}) already verified`);
    return { status: 'already_verified' };
  }

  console.log(`→ [Routescan] Submitting ${label} (${address}) [${contractName}]...`);
  const body = new URLSearchParams({
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: address,
    sourceCode: sourceCodeJson,
    codeformat: 'solidity-standard-json-input',
    contractname: contractName,
    compilerversion: compilerVersion,
    constructorArguements: constructorArguments,
    licenseType: '3',
  });
  if (apiKey) {
    body.set('apikey', apiKey);
  }

  const submitRes = await fetch(ROUTESCAN_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const submitJson = await submitRes.json();
  if (String(submitJson.status) !== '1' || !submitJson.result) {
    const msg = String(submitJson.result || submitJson.message || 'Unknown error');
    if (msg.toLowerCase().includes('already verified')) {
      console.log(`✓ [Routescan] ${label} (${address}) already verified`);
      return { status: 'already_verified' };
    }
    throw new Error(`[Routescan] ${label} submit failed: ${msg}`);
  }

  const guid = String(submitJson.result);
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    await sleep(3000);
    const statusUrl = `${ROUTESCAN_API_URL}?module=contract&action=checkverifystatus&guid=${encodeURIComponent(guid)}${apiKey ? `&apikey=${encodeURIComponent(apiKey)}` : ''}`;
    const checkRes = await fetch(statusUrl);
    const checkJson = await checkRes.json();
    const detail = String(checkJson.result || '');
    if (
      String(checkJson.status) === '1' ||
      detail.toLowerCase().includes('pass - verified') ||
      detail.toLowerCase().includes('already verified')
    ) {
      console.log(`✓ [Routescan] Verified ${label} (${address}): ${detail}`);
      return { status: 'verified', detail };
    }
    if (!detail.toLowerCase().includes('pending')) {
      throw new Error(`[Routescan] ${label} check failed: ${detail}`);
    }
  }

  console.log(
    `⏳ [Routescan] ${label} still queued on Routescan (guid=${guid}); Sourcify verification remains active.`,
  );
  return { status: 'queued', guid };
}

async function encodeCircleConstructorArgs(publicClient, circleAbi, circleAddr) {
  const [
    creator,
    metadataId,
    name,
    token,
    allocationMode,
    maxMembers,
    contributionAmount,
    collateralAmount,
    roundDuration,
    biddingDuration,
    gracePeriod,
    startDeadline,
    minBid,
    maxBid,
  ] = await Promise.all(
    [
      'creator',
      'metadataId',
      'name',
      'token',
      'allocationMode',
      'maxMembers',
      'contributionAmount',
      'collateralAmount',
      'roundDuration',
      'biddingDuration',
      'gracePeriod',
      'startDeadline',
      'minBid',
      'maxBid',
    ].map((functionName) =>
      publicClient.readContract({
        address: circleAddr,
        abi: circleAbi,
        functionName,
      }),
    ),
  );

  return encodeAbiParameters(
    parseAbiParameters(
      'address _creator, (string metadataId, string name, address token, uint8 allocationMode, uint8 maxMembers, uint256 contributionAmount, uint256 collateralAmount, uint256 roundDuration, uint256 biddingDuration, uint256 gracePeriod, uint256 startDeadline, uint256 minBid, uint256 maxBid) params',
    ),
    [
      creator,
      {
        metadataId,
        name,
        token,
        allocationMode: Number(allocationMode),
        maxMembers: Number(maxMembers),
        contributionAmount,
        collateralAmount,
        roundDuration,
        biddingDuration,
        gracePeriod,
        startDeadline,
        minBid,
        maxBid,
      },
    ],
  ).slice(2);
}

async function main() {
  const envMap = loadEnvMap(API_ENV_PATH);
  const rpcUrl =
    process.env.AVALANCHE_RPC_URL ||
    envMap.AVALANCHE_RPC_URL ||
    'https://avalanche-fuji-c-chain-rpc.publicnode.com';
  const apiKey = process.env.SNOWTRACE_API_KEY || envMap.SNOWTRACE_API_KEY || '';
  const runRoutescan =
    process.argv.includes('--routescan') || Boolean(apiKey);

  const usdcAddress =
    process.env.USDC_TOKEN_ADDRESS || envMap.USDC_TOKEN_ADDRESS;
  const yieldVaultAddress =
    process.env.YIELD_VAULT_ADDRESS || envMap.YIELD_VAULT_ADDRESS;
  const verifierAddress =
    process.env.SYBIL_VERIFIER_ADDRESS || envMap.SYBIL_VERIFIER_ADDRESS;
  const factoryAddress =
    process.env.ROSCA_FACTORY_ADDRESS || envMap.ROSCA_FACTORY_ADDRESS;

  const solcInput = buildSolcInput(CONTRACTS_SRC);
  const sourceCodeJson = JSON.stringify(solcInput);
  const compilerVersion = getCompilerTag();
  const compilerVersionNoPrefix = compilerVersion.replace(/^v/, '');
  const artifacts = compileAvaHuiContracts(CONTRACTS_SRC);

  console.log(`Verifying Fuji contracts (compiler=${compilerVersion})...`);

  const publicClient = createPublicClient({
    chain: avalancheFuji,
    transport: http(rpcUrl),
  });

  const verifierIssuer =
    verifierAddress && verifierAddress !== ZERO_ADDRESS
      ? await publicClient.readContract({
          address: verifierAddress,
          abi: artifacts.Team1AttestationVerifier.abi,
          functionName: 'issuer',
        })
      : null;

  const targets = [
    {
      label: 'MockUSDC',
      address: usdcAddress,
      contractName: 'mocks/MockUSDC.sol:MockUSDC',
      constructorArguments: '',
    },
    {
      label: 'AvaHuiYieldVault',
      address: yieldVaultAddress,
      contractName: 'mocks/AvaHuiYieldVault.sol:AvaHuiYieldVault',
      constructorArguments: usdcAddress
        ? encodeAbiParameters(parseAbiParameters('address'), [usdcAddress]).slice(2)
        : '',
    },
    {
      label: 'Team1AttestationVerifier',
      address: verifierAddress,
      contractName: 'verifiers/Team1AttestationVerifier.sol:Team1AttestationVerifier',
      constructorArguments: verifierIssuer
        ? encodeAbiParameters(parseAbiParameters('address'), [verifierIssuer]).slice(2)
        : '',
    },
    {
      label: 'AvaHuiFactory',
      address: factoryAddress,
      contractName: 'AvaHuiFactory.sol:AvaHuiFactory',
      constructorArguments: '',
    },
  ];

  if (factoryAddress && factoryAddress !== ZERO_ADDRESS) {
    const deployedCircles = await publicClient.readContract({
      address: factoryAddress,
      abi: artifacts.AvaHuiFactory.abi,
      functionName: 'getAllCircles',
    });
    for (let i = 0; i < deployedCircles.length; i += 1) {
      const circleAddr = deployedCircles[i];
      const constructorArguments = await encodeCircleConstructorArgs(
        publicClient,
        artifacts.AvaHuiCircle.abi,
        circleAddr,
      );
      targets.push({
        label: `AvaHuiCircle #${i + 1}`,
        address: circleAddr,
        contractName: 'AvaHuiCircle.sol:AvaHuiCircle',
        constructorArguments,
      });
    }
  }

  for (const target of targets) {
    if (!target.address || target.address === ZERO_ADDRESS) {
      console.log(`- Skip ${target.label}: address not configured`);
      continue;
    }

    await verifyOnSourcify({
      label: target.label,
      address: target.address,
      contractName: target.contractName,
      solcInput,
      compilerVersionNoPrefix,
    });

    if (runRoutescan) {
      await submitRoutescanVerification({
        label: target.label,
        address: target.address,
        contractName: target.contractName,
        constructorArguments: target.constructorArguments,
        sourceCodeJson,
        compilerVersion,
        apiKey,
      });
    }
  }

  console.log('\nAll Fuji contract verifications completed!');
}

main().catch((err) => {
  console.error('Verification failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
