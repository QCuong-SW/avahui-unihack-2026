// ============================================================================
// @avahui/blockchain — Typed ABIs for Frontend wagmi/viem Integration
// Matches Section 2.2 of AVAHUI_MASTER_SPEC_AND_MOCK.md
// ============================================================================

export const MOCK_USDC_ABI = [
  {
    type: 'function',
    name: 'faucet',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const AVAHUI_FACTORY_ABI = [
  {
    type: 'function',
    name: 'createCircle',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'metadataId', type: 'string' },
          { name: 'name', type: 'string' },
          { name: 'token', type: 'address' },
          { name: 'allocationMode', type: 'uint8' },
          { name: 'maxMembers', type: 'uint8' },
          { name: 'contributionAmount', type: 'uint256' },
          { name: 'collateralAmount', type: 'uint256' },
          { name: 'roundDuration', type: 'uint256' },
          { name: 'biddingDuration', type: 'uint256' },
          { name: 'gracePeriod', type: 'uint256' },
          { name: 'startDeadline', type: 'uint256' },
          { name: 'minBid', type: 'uint256' },
          { name: 'maxBid', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'circleAddress', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getAllCircles',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
] as const;

export const AVAHUI_CIRCLE_ABI = [
  {
    type: 'function',
    name: 'joinCircle',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'contribute',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'roundNumber', type: 'uint8' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'submitBid',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'roundNumber', type: 'uint8' },
      { name: 'bidAmount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'settleRound',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'roundNumber', type: 'uint8' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdrawCollateral',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancelExpiredCircle',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const;
