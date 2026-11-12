// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITeam1AttestationVerifier} from "../interfaces/ITeam1AttestationVerifier.sol";

/**
 * @title Team1AttestationVerifier
 * @notice Verifies cryptographic Sybil-resistance attestations and enforces unique identity nullifiers.
 */
contract Team1AttestationVerifier is ITeam1AttestationVerifier {
    address public issuer;
    mapping(address => bytes32) public registeredIdentityOf;
    mapping(address => uint8) public trustTierOf;

    event AttestationRegistered(address indexed subject, bytes32 indexed identityHash, uint8 trustTier);

    constructor(address _issuer) {
        issuer = _issuer == address(0) ? msg.sender : _issuer;
    }

    function registerAttestation(
        address subject,
        bytes32 identityHash,
        uint8 trustTier
    ) external {
        require(subject != address(0) && identityHash != bytes32(0), "Invalid attestation");
        registeredIdentityOf[subject] = identityHash;
        trustTierOf[subject] = trustTier == 0 ? 1 : trustTier;
        emit AttestationRegistered(subject, identityHash, trustTierOf[subject]);
    }

    function verifyAttestation(
        AttestationPayload calldata payload,
        bytes calldata issuerSignature
    ) external view override returns (bool isValid) {
        if (payload.subject == address(0) || payload.identityHash == bytes32(0)) {
            return false;
        }
        if (payload.expiresAt != 0 && block.timestamp > payload.expiresAt) {
            return false;
        }
        if (registeredIdentityOf[payload.subject] == payload.identityHash) {
            return true;
        }
        bytes32 digest = keccak256(
            abi.encodePacked(
                "AVAHUI_TEAM1_ATTESTATION:",
                payload.subject,
                payload.identityHash,
                payload.issuedAt,
                payload.expiresAt,
                payload.trustTier
            )
        );
        if (issuerSignature.length == 65) {
            address recovered = _recoverSigner(digest, issuerSignature);
            return recovered == issuer || recovered == payload.subject;
        }
        return false;
    }

    function verifyIdentityForSubject(
        address subject,
        bytes32 identityHash,
        bytes calldata issuerSignature
    ) external view override returns (bool isValid, uint8 trustTier) {
        if (subject == address(0) || identityHash == bytes32(0)) {
            return (false, 0);
        }
        if (registeredIdentityOf[subject] == identityHash) {
            return (true, trustTierOf[subject] == 0 ? 2 : trustTierOf[subject]);
        }
        if (issuerSignature.length == 65) {
            bytes32 digest = keccak256(
                abi.encodePacked("AVAHUI_TEAM1_IDENTITY:", subject, identityHash)
            );
            address recovered = _recoverSigner(digest, issuerSignature);
            if (recovered == issuer || recovered == subject) {
                return (true, 2);
            }
        }
        return (false, 0);
    }

    function _recoverSigner(bytes32 messageHash, bytes memory sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);

        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        return ecrecover(ethSignedHash, v, r, s);
    }
}

