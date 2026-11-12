// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAvaHuiCircle} from "./interfaces/IAvaHuiCircle.sol";
import {IAvaHuiFactory} from "./interfaces/IAvaHuiFactory.sol";
import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";
import {IYieldVault} from "./interfaces/IYieldVault.sol";
import {ITeam1AttestationVerifier} from "./interfaces/ITeam1AttestationVerifier.sol";
import {SafeTransferLib, ReentrancyGuard} from "./libraries/SecurityLib.sol";

contract AvaHuiCircle is IAvaHuiCircle, ReentrancyGuard {
    using SafeTransferLib for IERC20Minimal;

    uint8 public constant STATUS_RECRUITING = 0;
    uint8 public constant STATUS_ACTIVE = 1;
    uint8 public constant STATUS_COMPLETED = 2;
    uint8 public constant STATUS_CANCELLED = 3;

    uint8 public constant MODE_FIXED = 0;
    uint8 public constant MODE_BIDDING = 1;

    uint8 public constant ROUND_PENDING = 0;
    uint8 public constant ROUND_OPEN = 1;
    uint8 public constant ROUND_SETTLED = 2;

    struct MemberInfo {
        uint8 slotIndex;
        uint256 lockedCollateral;
        bool hasReceivedPayout;
        uint8 wonRoundNumber;
        uint8 defaultCount;
        bool isWithdrawn;
        bool exists;
    }

    struct RoundInfo {
        uint8 status;
        uint256 startTime;
        uint256 contributionDeadline;
        uint256 biddingDeadline;
        uint256 graceDeadline;
        address highestBidder;
        uint256 highestBid;
        address winner;
        uint8 contributionsCount;
    }

    struct BidCommitment {
        bytes32 commitment;
        uint64 committedAt;
        bool revealed;
        uint256 revealedAmount;
    }

    string public metadataId;
    string public name;
    address public immutable factory;
    address public immutable creator;
    IERC20Minimal public immutable token;

    uint8 public immutable allocationMode;
    uint8 public immutable maxMembers;
    uint256 public immutable contributionAmount;
    uint256 public immutable collateralAmount;
    uint256 public immutable roundDuration;
    uint256 public immutable biddingDuration;
    uint256 public immutable gracePeriod;
    uint256 public immutable startDeadline;
    uint256 public immutable minBid;
    uint256 public immutable maxBid;

    uint8 public status;
    uint8 public currentMemberCount;
    uint8 public currentRound;
    uint256 public totalDiscountPool;

    // --- V2 SECURITY & DEFI STATE ---
    bool public isSealedBidEnabled;
    bool public isPrivateCircle;
    bool public requiresAttestation;
    address public yieldVault;
    address public attestationVerifier;
    uint256 public totalYieldPool;
    bool public isYieldHarvestedOnCompletion;

    mapping(uint8 => address) public slotToMember;
    mapping(address => MemberInfo) public members;
    mapping(uint8 => RoundInfo) public rounds;
    mapping(uint8 => mapping(address => bool)) public hasContributed;

    // V2 Mappings: Sealed-Bid Commit-Reveal, EIP-712 Invite Nonces, Sybil Nullifiers
    mapping(uint8 => mapping(address => BidCommitment)) public bidCommitments;
    mapping(uint8 => uint64) public roundEarliestCommitTimestamp;
    mapping(uint256 => bool) public usedInviteNonces;
    mapping(bytes32 => bool) public hasIdentityJoined;
    mapping(address => bytes32) public memberIdentityHash;

    error InvalidStatus();
    error InvalidRound();
    error RecruitmentExpired();
    error RecruitmentNotExpired();
    error AlreadyJoined();
    error CircleFull();
    error NotMember();
    error OnlyCreator();
    error AlreadyContributed();
    error ContributionWindowClosed();
    error BiddingNotEnabled();
    error BiddingWindowClosed();
    error CommitWindowClosed();
    error InvalidCommitment();
    error AlreadyRevealed();
    error CommitmentMismatch();
    error AlreadyReceivedPayout();
    error BidOutOfBounds();
    error BidNotHigherThanCurrent();
    error SettlementConditionsNotMet();
    error InsufficientCollateralToSlash(address member);
    error AlreadyWithdrawn();
    error PrivateCircleRequiresInvite();
    error InviteExpired();
    error InviteNonceAlreadyUsed();
    error InvalidInviteSignature();
    error IdentityAlreadyJoined();
    error InvalidAttestation();

    constructor(address _creator, IAvaHuiFactory.CreateCircleParams memory params) {
        factory = msg.sender;
        creator = _creator;
        metadataId = params.metadataId;
        name = params.name;
        token = IERC20Minimal(params.token);
        allocationMode = params.allocationMode;
        maxMembers = params.maxMembers;
        contributionAmount = params.contributionAmount;
        collateralAmount = params.collateralAmount;
        roundDuration = params.roundDuration;
        biddingDuration = params.biddingDuration;
        gracePeriod = params.gracePeriod;
        startDeadline = params.startDeadline;
        minBid = params.minBid;
        maxBid = params.maxBid;
        status = STATUS_RECRUITING;
    }

    /**
     * @notice Configures V2 security & DeFi yield features while circle is still recruiting.
     */
    function configureV2Features(
        bool _isSealedBid,
        bool _isPrivateCircle,
        bool _requiresAttestation,
        address _yieldVault,
        address _attestationVerifier
    ) external {
        if (msg.sender != creator && msg.sender != factory) revert OnlyCreator();
        if (status != STATUS_RECRUITING) revert InvalidStatus();
        isSealedBidEnabled = _isSealedBid;
        isPrivateCircle = _isPrivateCircle;
        requiresAttestation = _requiresAttestation;
        yieldVault = _yieldVault;
        attestationVerifier = _attestationVerifier;
    }

    function joinCircle() external override nonReentrant {
        if (isPrivateCircle && msg.sender != creator) revert PrivateCircleRequiresInvite();
        if (requiresAttestation && attestationVerifier != address(0)) {
            bytes32 defaultIdentity = ITeam1AttestationVerifier(attestationVerifier)
                .registeredIdentityOf(msg.sender);
            if (defaultIdentity == bytes32(0)) revert InvalidAttestation();
            if (hasIdentityJoined[defaultIdentity]) revert IdentityAlreadyJoined();
            hasIdentityJoined[defaultIdentity] = true;
            memberIdentityHash[msg.sender] = defaultIdentity;
            emit AttestationVerified(address(this), msg.sender, defaultIdentity, 2);
        }
        _executeJoin(msg.sender);
    }

    /**
     * @notice V2: Joins a circle using an EIP-712 / creator signed Invite Voucher and Team1 Sybil Attestation.
     */
    function joinCircleWithVoucher(
        uint256 nonce,
        uint256 expiresAt,
        bytes calldata inviteSignature,
        bytes32 identityHash,
        bytes calldata attestationSignature
    ) external override nonReentrant {
        if (isPrivateCircle && msg.sender != creator) {
            if (expiresAt != 0 && block.timestamp > expiresAt) revert InviteExpired();
            if (usedInviteNonces[nonce]) revert InviteNonceAlreadyUsed();

            bytes32 voucherHash = computeInviteVoucherHash(msg.sender, nonce, expiresAt);
            bytes32 openVoucherHash = computeInviteVoucherHash(address(0), nonce, expiresAt);
            address signer1 = _recoverSigner(voucherHash, inviteSignature);
            address signer2 = _recoverSigner(openVoucherHash, inviteSignature);

            if (signer1 != creator && signer2 != creator) revert InvalidInviteSignature();
            usedInviteNonces[nonce] = true;
        }

        if (identityHash != bytes32(0)) {
            if (hasIdentityJoined[identityHash]) revert IdentityAlreadyJoined();
            if (requiresAttestation && attestationVerifier != address(0)) {
                (bool valid, uint8 tier) = ITeam1AttestationVerifier(attestationVerifier)
                    .verifyIdentityForSubject(msg.sender, identityHash, attestationSignature);
                if (!valid) revert InvalidAttestation();
                emit AttestationVerified(address(this), msg.sender, identityHash, tier);
            } else {
                emit AttestationVerified(address(this), msg.sender, identityHash, 1);
            }
            hasIdentityJoined[identityHash] = true;
            memberIdentityHash[msg.sender] = identityHash;
        } else if (requiresAttestation) {
            revert InvalidAttestation();
        }

        _executeJoin(msg.sender);
    }

    function _executeJoin(address memberAddr) internal {
        if (status != STATUS_RECRUITING) revert InvalidStatus();
        if (block.timestamp > startDeadline) revert RecruitmentExpired();
        if (members[memberAddr].exists) revert AlreadyJoined();
        if (currentMemberCount >= maxMembers) revert CircleFull();

        token.safeTransferFrom(memberAddr, address(this), collateralAmount);

        uint8 assignedSlot = ++currentMemberCount;
        slotToMember[assignedSlot] = memberAddr;
        members[memberAddr] = MemberInfo({
            slotIndex: assignedSlot,
            lockedCollateral: collateralAmount,
            hasReceivedPayout: false,
            wonRoundNumber: 0,
            defaultCount: 0,
            isWithdrawn: false,
            exists: true
        });

        emit MemberJoined(address(this), memberAddr, assignedSlot, collateralAmount);

        if (currentMemberCount == maxMembers) {
            status = STATUS_ACTIVE;
            currentRound = 1;
            _openRound(1);
            RoundInfo storage r1 = rounds[1];
            emit CircleActivated(
                address(this),
                r1.startTime,
                1,
                r1.contributionDeadline,
                r1.biddingDeadline
            );
        }
    }

    function contribute(uint8 roundNumber) external override nonReentrant {
        if (status != STATUS_ACTIVE) revert InvalidStatus();
        if (roundNumber != currentRound) revert InvalidRound();
        if (!members[msg.sender].exists) revert NotMember();
        if (hasContributed[roundNumber][msg.sender]) revert AlreadyContributed();

        RoundInfo storage round = rounds[roundNumber];
        if (round.status != ROUND_OPEN) revert InvalidRound();
        if (block.timestamp > round.graceDeadline) revert ContributionWindowClosed();

        token.safeTransferFrom(msg.sender, address(this), contributionAmount);

        hasContributed[roundNumber][msg.sender] = true;
        round.contributionsCount += 1;

        emit ContributionMade(address(this), roundNumber, msg.sender, contributionAmount, block.timestamp);
    }

    function submitBid(uint8 roundNumber, uint256 bidAmount) external override nonReentrant {
        if (status != STATUS_ACTIVE) revert InvalidStatus();
        if (allocationMode != MODE_BIDDING) revert BiddingNotEnabled();
        if (roundNumber != currentRound) revert InvalidRound();

        MemberInfo storage member = members[msg.sender];
        if (!member.exists) revert NotMember();
        if (member.hasReceivedPayout) revert AlreadyReceivedPayout();

        RoundInfo storage round = rounds[roundNumber];
        if (round.status != ROUND_OPEN) revert InvalidRound();
        if (block.timestamp > round.biddingDeadline) revert BiddingWindowClosed();
        if (bidAmount < minBid || bidAmount > maxBid) revert BidOutOfBounds();
        if (bidAmount <= round.highestBid) revert BidNotHigherThanCurrent();

        round.highestBidder = msg.sender;
        round.highestBid = bidAmount;

        emit BidSubmitted(address(this), roundNumber, msg.sender, bidAmount, block.timestamp);
    }

    /**
     * @notice V2 Module A (Phase 1): Submit a sealed commitment hash for a discount bid.
     *         commitment = keccak256(abi.encodePacked(address(this), roundNumber, msg.sender, bidAmount, salt))
     */
    function commitBid(uint8 roundNumber, bytes32 commitment) external override nonReentrant {
        if (status != STATUS_ACTIVE) revert InvalidStatus();
        if (allocationMode != MODE_BIDDING) revert BiddingNotEnabled();
        if (roundNumber != currentRound) revert InvalidRound();
        if (commitment == bytes32(0)) revert InvalidCommitment();

        MemberInfo storage member = members[msg.sender];
        if (!member.exists) revert NotMember();
        if (member.hasReceivedPayout) revert AlreadyReceivedPayout();

        RoundInfo storage round = rounds[roundNumber];
        if (round.status != ROUND_OPEN) revert InvalidRound();
        if (block.timestamp > round.biddingDeadline) revert CommitWindowClosed();

        bidCommitments[roundNumber][msg.sender] = BidCommitment({
            commitment: commitment,
            committedAt: uint64(block.timestamp),
            revealed: false,
            revealedAmount: 0
        });

        emit BidCommitted(address(this), roundNumber, msg.sender, commitment, block.timestamp);
    }

    /**
     * @notice V2 Module A (Phase 2): Reveal a previously committed sealed bid.
     */
    function revealBid(
        uint8 roundNumber,
        uint256 bidAmount,
        bytes32 salt
    ) external override nonReentrant {
        if (status != STATUS_ACTIVE) revert InvalidStatus();
        if (allocationMode != MODE_BIDDING) revert BiddingNotEnabled();
        if (roundNumber != currentRound) revert InvalidRound();

        MemberInfo storage member = members[msg.sender];
        if (!member.exists) revert NotMember();
        if (member.hasReceivedPayout) revert AlreadyReceivedPayout();

        RoundInfo storage round = rounds[roundNumber];
        if (round.status != ROUND_OPEN) revert InvalidRound();
        if (block.timestamp > round.biddingDeadline) revert BiddingWindowClosed();
        if (bidAmount < minBid || bidAmount > maxBid) revert BidOutOfBounds();

        BidCommitment storage comm = bidCommitments[roundNumber][msg.sender];
        if (comm.commitment == bytes32(0)) revert InvalidCommitment();
        if (comm.revealed) revert AlreadyRevealed();

        bytes32 expectedHash = computeBidCommitment(roundNumber, msg.sender, bidAmount, salt);
        if (expectedHash != comm.commitment) revert CommitmentMismatch();

        comm.revealed = true;
        comm.revealedAmount = bidAmount;

        // Deterministic tie-breaker: strictly higher bid wins, OR equal bid with strictly earlier commit timestamp wins
        bool isNewLeader = false;
        if (bidAmount > round.highestBid) {
            isNewLeader = true;
        } else if (
            bidAmount == round.highestBid &&
            round.highestBidder != address(0) &&
            comm.committedAt < bidCommitments[roundNumber][round.highestBidder].committedAt
        ) {
            isNewLeader = true;
        }

        if (isNewLeader) {
            round.highestBidder = msg.sender;
            round.highestBid = bidAmount;
        }

        emit BidRevealed(address(this), roundNumber, msg.sender, bidAmount, block.timestamp);
        emit BidSubmitted(address(this), roundNumber, msg.sender, bidAmount, block.timestamp);
    }

    function computeBidCommitment(
        uint8 roundNumber,
        address bidder,
        uint256 bidAmount,
        bytes32 salt
    ) public view returns (bytes32) {
        return keccak256(abi.encodePacked(address(this), roundNumber, bidder, bidAmount, salt));
    }

    function computeInviteVoucherHash(
        address invitee,
        uint256 nonce,
        uint256 expiresAt
    ) public view returns (bytes32) {
        return keccak256(abi.encodePacked("AVAHUI_INVITE:", address(this), invitee, nonce, expiresAt));
    }

    function settleRound(uint8 roundNumber) external override nonReentrant {
        if (status != STATUS_ACTIVE) revert InvalidStatus();
        if (roundNumber != currentRound) revert InvalidRound();

        RoundInfo storage round = rounds[roundNumber];
        if (round.status != ROUND_OPEN) revert InvalidRound();

        bool allContributed = round.contributionsCount == maxMembers;
        bool biddingFinished = (allocationMode == MODE_FIXED) || (block.timestamp > round.biddingDeadline);
        bool graceExpired = block.timestamp > round.graceDeadline;

        if (!(allContributed && biddingFinished) && !graceExpired) {
            revert SettlementConditionsNotMet();
        }

        // Auto-cover missing contributions by slashing collateral
        if (!allContributed) {
            for (uint8 i = 1; i <= maxMembers; i++) {
                address mAddr = slotToMember[i];
                if (!hasContributed[roundNumber][mAddr]) {
                    MemberInfo storage mInfo = members[mAddr];
                    if (mInfo.lockedCollateral < contributionAmount) {
                        revert InsufficientCollateralToSlash(mAddr);
                    }
                    mInfo.lockedCollateral -= contributionAmount;
                    mInfo.defaultCount += 1;
                    hasContributed[roundNumber][mAddr] = true;
                    round.contributionsCount += 1;

                    emit CollateralSlashed(
                        address(this),
                        roundNumber,
                        mAddr,
                        contributionAmount,
                        mInfo.lockedCollateral
                    );
                }
            }
        }

        // Determine recipient & winningBid
        address recipient;
        uint256 winningBid = 0;

        if (allocationMode == MODE_FIXED) {
            recipient = slotToMember[roundNumber];
        } else {
            if (round.highestBidder != address(0) && !members[round.highestBidder].hasReceivedPayout) {
                recipient = round.highestBidder;
                winningBid = round.highestBid;
            } else {
                for (uint8 i = 1; i <= maxMembers; i++) {
                    address candidate = slotToMember[i];
                    if (!members[candidate].hasReceivedPayout) {
                        recipient = candidate;
                        winningBid = 0;
                        break;
                    }
                }
            }
        }

        uint256 grossPot = uint256(maxMembers) * contributionAmount;
        uint256 netPayout = grossPot - winningBid;

        totalDiscountPool += winningBid;
        members[recipient].hasReceivedPayout = true;
        members[recipient].wonRoundNumber = roundNumber;

        round.status = ROUND_SETTLED;
        round.winner = recipient;
        round.highestBid = winningBid;

        uint8 nextRoundNumber = 0;
        if (roundNumber < maxMembers) {
            nextRoundNumber = roundNumber + 1;
            currentRound = nextRoundNumber;
            _openRound(nextRoundNumber);
        } else {
            status = STATUS_COMPLETED;
            if (yieldVault != address(0) && !isYieldHarvestedOnCompletion) {
                isYieldHarvestedOnCompletion = true;
                try IYieldVault(yieldVault).harvestYieldFor(address(this)) returns (uint256 harvested) {
                    totalYieldPool += harvested;
                } catch {}
            }
        }

        emit RoundSettled(
            address(this),
            roundNumber,
            recipient,
            grossPot,
            winningBid,
            netPayout,
            nextRoundNumber
        );

        if (status == STATUS_COMPLETED) {
            emit CircleCompleted(address(this), totalDiscountPool, block.timestamp);
        }

        token.safeTransfer(recipient, netPayout);
    }

    function withdrawCollateral() external override nonReentrant {
        if (status != STATUS_COMPLETED && status != STATUS_CANCELLED) revert InvalidStatus();

        MemberInfo storage member = members[msg.sender];
        if (!member.exists) revert NotMember();
        if (member.isWithdrawn) revert AlreadyWithdrawn();

        member.isWithdrawn = true;
        uint256 collateralReturned = member.lockedCollateral;
        member.lockedCollateral = 0;

        uint256 discountBonus = 0;
        uint256 yieldBonus = 0;

        if (status == STATUS_COMPLETED) {
            if (totalDiscountPool > 0) {
                discountBonus = totalDiscountPool / uint256(maxMembers);
                if (msg.sender == creator) {
                    discountBonus += totalDiscountPool % uint256(maxMembers);
                }
            }
            if (totalYieldPool > 0) {
                yieldBonus = totalYieldPool / uint256(maxMembers);
                if (msg.sender == creator) {
                    yieldBonus += totalYieldPool % uint256(maxMembers);
                }
                emit YieldHarvested(address(this), msg.sender, yieldBonus);
            }
        }

        uint256 totalPayout = collateralReturned + discountBonus + yieldBonus;
        token.safeTransfer(msg.sender, totalPayout);

        emit CollateralWithdrawn(
            address(this),
            msg.sender,
            collateralReturned,
            discountBonus + yieldBonus
        );
    }

    function cancelExpiredCircle() external override nonReentrant {
        if (status != STATUS_RECRUITING) revert InvalidStatus();
        if (block.timestamp <= startDeadline) revert RecruitmentNotExpired();

        status = STATUS_CANCELLED;
        emit CircleCancelled(address(this), block.timestamp);
    }

    function getCircleSummary()
        external
        view
        override
        returns (
            uint8 _status,
            uint8 _allocationMode,
            uint8 _maxMembers,
            uint8 _currentMemberCount,
            uint8 _currentRound,
            uint256 _contributionAmount,
            uint256 _collateralAmount,
            uint256 _totalDiscountPool
        )
    {
        return (
            status,
            allocationMode,
            maxMembers,
            currentMemberCount,
            currentRound,
            contributionAmount,
            collateralAmount,
            totalDiscountPool
        );
    }

    function getCircleConfig()
        external
        view
        returns (
            string memory _metadataId,
            string memory _name,
            address _creator,
            address _token,
            uint256 _roundDuration,
            uint256 _biddingDuration,
            uint256 _gracePeriod,
            uint256 _startDeadline,
            uint256 _minBid,
            uint256 _maxBid
        )
    {
        return (
            metadataId,
            name,
            creator,
            address(token),
            roundDuration,
            biddingDuration,
            gracePeriod,
            startDeadline,
            minBid,
            maxBid
        );
    }

    function getRoundInfo(uint8 roundNumber)
        external
        view
        returns (
            uint8 _status,
            uint256 _startTime,
            uint256 _contributionDeadline,
            uint256 _biddingDeadline,
            uint256 _graceDeadline,
            address _highestBidder,
            uint256 _highestBid,
            address _winner,
            uint8 _contributionsCount
        )
    {
        RoundInfo storage r = rounds[roundNumber];
        return (
            r.status,
            r.startTime,
            r.contributionDeadline,
            r.biddingDeadline,
            r.graceDeadline,
            r.highestBidder,
            r.highestBid,
            r.winner,
            r.contributionsCount
        );
    }

    function _openRound(uint8 roundNumber) internal {
        uint256 start = block.timestamp;
        uint256 contribDeadline = start + roundDuration;
        uint256 bidDeadline = allocationMode == MODE_BIDDING ? start + biddingDuration : start;
        uint256 graceEnd = contribDeadline + gracePeriod;

        rounds[roundNumber] = RoundInfo({
            status: ROUND_OPEN,
            startTime: start,
            contributionDeadline: contribDeadline,
            biddingDeadline: bidDeadline,
            graceDeadline: graceEnd,
            highestBidder: address(0),
            highestBid: 0,
            winner: address(0),
            contributionsCount: 0
        });
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
