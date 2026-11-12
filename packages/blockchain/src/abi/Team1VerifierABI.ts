export const Team1VerifierABI = [
  {
    type: 'function',
    name: 'registerAttestation',
    inputs: [
      { name: 'subject', type: 'address', internalType: 'address' },
      { name: 'identityHash', type: 'bytes32', internalType: 'bytes32' },
      { name: 'trustTier', type: 'uint8', internalType: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'verifyIdentityForSubject',
    inputs: [
      { name: 'subject', type: 'address', internalType: 'address' },
      { name: 'identityHash', type: 'bytes32', internalType: 'bytes32' },
      { name: 'issuerSignature', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [
      { name: 'isValid', type: 'bool', internalType: 'bool' },
      { name: 'trustTier', type: 'uint8', internalType: 'uint8' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'registeredIdentityOf',
    inputs: [{ name: 'subject', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view',
  },
] as const;

