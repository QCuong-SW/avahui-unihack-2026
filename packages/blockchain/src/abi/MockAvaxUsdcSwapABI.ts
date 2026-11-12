export const MockAvaxUsdcSwapABI = [
  {
    type: 'function',
    name: 'getQuoteAvaxToUsdc',
    inputs: [{ name: 'avaxAmountWei', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: 'usdcOut', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'swapExactAvaxForUsdc',
    inputs: [{ name: 'minUsdcOut', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: 'usdcOut', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'event',
    name: 'SwappedAvaxForUsdc',
    inputs: [
      { name: 'trader', type: 'address', indexed: true, internalType: 'address' },
      { name: 'avaxIn', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'usdcOut', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
] as const;

