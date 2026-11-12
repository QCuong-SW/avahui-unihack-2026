// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITeam1AttestationVerifier {
    struct AttestationPayload {
        address subject;
        bytes32 identityHash;
        uint64 issuedAt;
        uint64 expiresAt;
        uint8 trustTier;
    }

    function verifyAttestation(
        AttestationPayload calldata payload,
        bytes calldata issuerSignature
    ) external view returns (bool isValid);

    function verifyIdentityForSubject(
        address subject,
        bytes32 identityHash,
        bytes calldata issuerSignature
    ) external view returns (bool isValid, uint8 trustTier);

    function registeredIdentityOf(address subject) external view returns (bytes32);
}
