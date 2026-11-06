/**
 * Compiles @avahui/contracts using solc 0.8.24 and outputs artifacts to apps/contracts/out/
 */
const fs = require('fs');
const path = require('path');

function main() {
  const solc = require(require.resolve('solc', {
    paths: [path.resolve(__dirname, '../apps/api/node_modules'), __dirname],
  }));

  const contractsSrc = path.resolve(__dirname, '../apps/contracts/src');
  const outDir = path.resolve(__dirname, '../apps/contracts/out');

  const files = [
    'interfaces/IERC20Minimal.sol',
    'interfaces/IAvaHuiFactory.sol',
    'interfaces/IAvaHuiCircle.sol',
    'libraries/SecurityLib.sol',
    'mocks/MockUSDC.sol',
    'AvaHuiCircle.sol',
    'AvaHuiFactory.sol',
  ];

  const sources = {};
  for (const file of files) {
    sources[file] = {
      content: fs.readFileSync(path.join(contractsSrc, file), 'utf8'),
    };
  }

  const input = {
    language: 'Solidity',
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((e) => e.severity === 'error');
  if (errors.length > 0) {
    console.error('Solidity compilation errors:', errors);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  for (const [sourceName, contractsObj] of Object.entries(output.contracts || {})) {
    for (const [contractName, artifact] of Object.entries(contractsObj)) {
      const targetFile = path.join(outDir, `${contractName}.json`);
      fs.writeFileSync(
        targetFile,
        JSON.stringify(
          {
            contractName,
            sourceName,
            abi: artifact.abi,
            bytecode: `0x${artifact.evm.bytecode.object}`,
          },
          null,
          2,
        ),
      );
      console.log(`Compiled ${contractName} -> ${path.relative(process.cwd(), targetFile)}`);
    }
  }
}

main();

