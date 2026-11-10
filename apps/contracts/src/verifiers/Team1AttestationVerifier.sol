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
    address public owner;
    address public issuer;

    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant ATTESTATION_TYPEHASH =
        keccak256(
            "Team1Attestation(address account,bytes32 identityNullifier,uint8 trustTier,uint256 nonce,uint256 deadline)"
        );

    struct AttestationRecord {
        bytes32 identityNullifier;
        uint8 trustTier;
        uint64 issuedAt;
        bool active;
    }

    mapping(address => AttestationRecord) public attestations;
    mapping(bytes32 => address) public nullifierToAccount;
    mapping(address => uint256) public nonces;

    event AttestationRevoked(
        address indexed account,
        bytes32 indexed identityNullifier,
        uint256 timestamp
    );
    event IssuerUpdated(address indexed previousIssuer, address indexed newIssuer);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error UnauthorizedOwner();
    error UnauthorizedIssuer();
    error InvalidAccount();
    error InvalidNullifier();
    error NullifierAlreadyBound();
    error SignatureExpired();
    error InvalidSignature();
    error AttestationNotActive();

    modifier onlyOwner() {
        if (msg.sender != owner) revert UnauthorizedOwner();
        _;
    }

    constructor(address _issuer) {
        owner = msg.sender;
        issuer = _issuer == address(0) ? msg.sender : _issuer;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Team1AttestationVerifier")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
        emit OwnershipTransferred(address(0), msg.sender);
        emit IssuerUpdated(address(0), issuer);
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert InvalidAccount();
        address prev = owner;
        owner = _newOwner;
        emit OwnershipTransferred(prev, _newOwner);
    }

    function setIssuer(address _newIssuer) external onlyOwner {
        if (_newIssuer == address(0)) revert InvalidAccount();
        address prev = issuer;
        issuer = _newIssuer;
        emit IssuerUpdated(prev, _newIssuer);
    }

    function issueAttestation(
        address account,
        bytes32 identityNullifier,
        uint8 trustTier
    ) external {
        if (msg.sender != issuer) revert UnauthorizedIssuer();
        _issue(account, identityNullifier, trustTier);
    }

    function claimAttestationWithSignature(
        address account,
        bytes32 identityNullifier,
        uint8 trustTier,
        uint256 deadline,
        bytes calldata signature
    ) external {
        if (block.timestamp > deadline) revert SignatureExpired();
        uint256 currentNonce = nonces[account];
        unchecked {
            nonces[account] = currentNonce + 1;
        }

        bytes32 structHash = keccak256(
            abi.encode(
                ATTESTATION_TYPEHASH,
                account,
                identityNullifier,
                trustTier,
                currentNonce,
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address signer = _recoverSigner(digest, signature);
        if (signer == address(0) || signer != issuer) revert InvalidSignature();

        _issue(account, identityNullifier, trustTier);
    }

    function revokeAttestation(address account) external {
        if (msg.sender != issuer && msg.sender != owner) revert UnauthorizedIssuer();
        AttestationRecord storage rec = attestations[account];
        if (!rec.active) revert AttestationNotActive();
        rec.active = false;
        emit AttestationRevoked(account, rec.identityNullifier, block.timestamp);
    }

    function _issue(
        address account,
        bytes32 identityNullifier,
        uint8 trustTier
    ) internal {
        if (account == address(0)) revert InvalidAccount();
        if (identityNullifier == bytes32(0)) revert InvalidNullifier();

        address boundAccount = nullifierToAccount[identityNullifier];
        if (boundAccount != address(0) && boundAccount != account) {
            revert NullifierAlreadyBound();
        }
        nullifierToAccount[identityNullifier] = account;

        uint8 resolvedTier = trustTier == 0 ? 1 : trustTier;
        attestations[account] = AttestationRecord({
            identityNullifier: identityNullifier,
            trustTier: resolvedTier,
            issuedAt: uint64(block.timestamp),
            active: true
        });

        emit AttestationIssued(account, identityNullifier, resolvedTier, block.timestamp);
    }

    function _recoverSigner(bytes32 digest, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);
        // Reject malleable upper-half s values per EIP-2
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            return address(0);
        }
        return ecrecover(digest, v, r, s);
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
