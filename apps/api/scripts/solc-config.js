/**
 * Shared solc 0.8.x compiler input & compilation helper for @avahui/api scripts.
 * Keeps deployment (`deploy-fuji.js`) and Routescan/Snowtrace verification (`verify-fuji.js`)
 * on identical Standard JSON Input and EVM compiler settings.
 */
const fs = require('fs');
const path = require('path');
const solc = require('solc');

const CONTRACT_FILES = [
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

function buildSolcInput(contractsSrcDir) {
  const sources = {};
  for (const rel of CONTRACT_FILES) {
    sources[rel] = {
      content: fs.readFileSync(path.join(contractsSrcDir, rel), 'utf8'),
    };
  }

  return {
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
}

function compileAvaHuiContracts(contractsSrcDir) {
  const input = buildSolcInput(contractsSrcDir);
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((e) => e.severity === 'error');
  if (errors.length > 0) {
    throw new Error(
      `Solc compilation failed: ${errors.map((e) => e.formattedMessage || e.message).join('\n')}`,
    );
  }

  return {
    MockUSDC: output.contracts['mocks/MockUSDC.sol'].MockUSDC,
    AvaHuiYieldVault:
      output.contracts['mocks/AvaHuiYieldVault.sol'].AvaHuiYieldVault,
    Team1AttestationVerifier:
      output.contracts['verifiers/Team1AttestationVerifier.sol']
        .Team1AttestationVerifier,
    AvaHuiCircle: output.contracts['AvaHuiCircle.sol'].AvaHuiCircle,
    AvaHuiFactory: output.contracts['AvaHuiFactory.sol'].AvaHuiFactory,
  };
}

function getCompilerTag() {
  const raw = typeof solc.version === 'function' ? solc.version() : '0.8.24';
  const base = raw.split('.Emscripten')[0];
  return base.startsWith('v') ? base : `v${base}`;
}

module.exports = {
  CONTRACT_FILES,
  buildSolcInput,
  compileAvaHuiContracts,
  getCompilerTag,
};

