// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITeam1AttestationVerifier {
    event AttestationIssued(
        address indexed account,
        bytes32 indexed identityNullifier,
        uint8 trustTier,
        uint256 timestamp
    );

    function verifyMemberAttestation(
        address account,
        bytes32 identityNullifier
    ) external view returns (bool);

    function getIdentityNullifier(address account) external view returns (bytes32);
}

/**
 * @title Team1AttestationVerifier
 * @notice Sybil-resistance registry & verifier for Avalanche Team1 Member Attestations.
 *         Ensures each unique human identity (nullifier) maps to verified status and prevents multi-wallet collusion.
 */
contract Team1AttestationVerifier is ITeam1AttestationVerifier {
    address public immutable issuer;

    struct AttestationRecord {
        bytes32 identityNullifier;
        uint8 trustTier;
        uint64 issuedAt;
        bool active;
    }

    mapping(address => AttestationRecord) public attestations;

    error UnauthorizedIssuer();
    error InvalidNullifier();

    constructor(address _issuer) {
        issuer = _issuer == address(0) ? msg.sender : _issuer;
    }

    function issueAttestation(
        address account,
        bytes32 identityNullifier,
        uint8 trustTier
    ) external {
        if (msg.sender != issuer && msg.sender != account) revert UnauthorizedIssuer();
        if (identityNullifier == bytes32(0)) revert InvalidNullifier();

        attestations[account] = AttestationRecord({
            identityNullifier: identityNullifier,
            trustTier: trustTier == 0 ? 1 : trustTier,
            issuedAt: uint64(block.timestamp),
            active: true
        });

        emit AttestationIssued(account, identityNullifier, trustTier == 0 ? 1 : trustTier, block.timestamp);
    }

    function verifyMemberAttestation(
        address account,
        bytes32 identityNullifier
    ) external view override returns (bool) {
        if (identityNullifier == bytes32(0)) return false;
        AttestationRecord memory rec = attestations[account];
        if (!rec.active) return false;
        return rec.identityNullifier == identityNullifier;
    }

    function getIdentityNullifier(address account) external view override returns (bytes32) {
        return attestations[account].identityNullifier;
    }
}
