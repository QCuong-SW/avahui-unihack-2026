// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAvaHuiCircle} from "./interfaces/IAvaHuiCircle.sol";
import {IAvaHuiFactory} from "./interfaces/IAvaHuiFactory.sol";
import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";
import {IYieldVault} from "./interfaces/IYieldVault.sol";
import {ITeam1AttestationVerifier} from "./verifiers/Team1AttestationVerifier.sol";
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

    // --- V2 Extensions: Yield Vault, Commit-Reveal, Invite & Sybil Resistance ---
    IYieldVault public yieldVault;
    uint256 public totalYieldEarned;
    bytes32 public inviteCodeHash;
    bool public requireAttestation;
    address public attestationVerifier;
    bool public override paused;

    mapping(uint8 => address) public slotToMember;
    mapping(address => MemberInfo) public members;
    mapping(uint8 => RoundInfo) public rounds;
    mapping(uint8 => mapping(address => bool)) public hasContributed;
    mapping(uint8 => mapping(address => BidCommitment)) public bidCommitments;
    mapping(bytes32 => bool) public usedIdentityNullifiers;

    error InvalidStatus();
    error InvalidRound();
    error RecruitmentExpired();
    error RecruitmentNotExpired();
    error AlreadyJoined();
    error CircleFull();
    error NotMember();
    error AlreadyContributed();
    error ContributionWindowClosed();
    error BiddingNotEnabled();
    error BiddingWindowClosed();
    error AlreadyReceivedPayout();
    error BidOutOfBounds();
    error BidNotHigherThanCurrent();
    error SettlementConditionsNotMet();
    error InsufficientCollateralToSlash(address member);
    error AlreadyWithdrawn();
    error UnauthorizedCaller();
    error SecurityGateRequired();
    error InvalidInviteCode();
    error InvalidSybilAttestation();
    error DuplicateIdentityNullifier();
    error InvalidCommitment();
    error InvalidBidReveal();
    error ContractPaused();
    error ContractNotPaused();
    error UnauthorizedGuardian();
    error ConfigLockedAfterJoin();
    error InvalidVerifier();
    error BidAlreadyCommitted();

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    modifier onlyGuardian() {
        address g = getGuardian();
        if (g == address(0) || msg.sender != g) revert UnauthorizedGuardian();
        _;
    }

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

    function getGuardian() public view returns (address) {
        (bool ok, bytes memory data) = factory.staticcall(
            abi.encodeWithSignature("guardian()")
        );
        if (ok && data.length == 32) {
            return abi.decode(data, (address));
        }
        return address(0);
    }

    function pause() external override onlyGuardian {
        if (paused) revert ContractPaused();
        paused = true;
        emit CirclePaused(address(this), msg.sender, block.timestamp);
    }

    function unpause() external override onlyGuardian {
        if (!paused) revert ContractNotPaused();
        paused = false;
        emit CircleUnpaused(address(this), msg.sender, block.timestamp);
    }

    function emergencyCancel() external override onlyGuardian nonReentrant {
        if (status != STATUS_RECRUITING) revert InvalidStatus();
        status = STATUS_CANCELLED;
        _harvestAndRecallVault();
        emit CircleCancelled(address(this), block.timestamp);
    }

    function setYieldVault(address _vault) external {
        if (msg.sender != creator && msg.sender != factory) revert UnauthorizedCaller();
        if (status != STATUS_RECRUITING) revert InvalidStatus();
        if (currentMemberCount > 0) revert ConfigLockedAfterJoin();
        yieldVault = IYieldVault(_vault);
    }

    function configureSecurity(
        bytes32 _inviteCodeHash,
        bool _requireAttestation,
        address _attestationVerifier
    ) external {
        if (msg.sender != creator && msg.sender != factory) revert UnauthorizedCaller();
        if (status != STATUS_RECRUITING) revert InvalidStatus();
        if (currentMemberCount > 0) revert ConfigLockedAfterJoin();
        inviteCodeHash = _inviteCodeHash;
        requireAttestation = _requireAttestation;
        attestationVerifier = _attestationVerifier;
    }

    function joinCircle() external override nonReentrant whenNotPaused {
        if (inviteCodeHash != bytes32(0) || requireAttestation) {
            revert SecurityGateRequired();
        }
        _joinMember(msg.sender);
    }

    function joinCircleProtected(
        string calldata inviteCode,
        bytes32 identityNullifier
    ) external override nonReentrant whenNotPaused {
        if (inviteCodeHash != bytes32(0)) {
            if (keccak256(abi.encodePacked(inviteCode)) != inviteCodeHash) {
                revert InvalidInviteCode();
            }
        }

        if (requireAttestation) {
            if (identityNullifier == bytes32(0)) revert InvalidSybilAttestation();
            if (usedIdentityNullifiers[identityNullifier]) revert DuplicateIdentityNullifier();
            if (attestationVerifier == address(0)) revert InvalidVerifier();

            bool valid = ITeam1AttestationVerifier(attestationVerifier).verifyMemberAttestation(
                msg.sender,
                identityNullifier
            );
            if (!valid) revert InvalidSybilAttestation();

            usedIdentityNullifiers[identityNullifier] = true;
            emit SybilAttestationVerified(address(this), msg.sender, identityNullifier);
        }

        _joinMember(msg.sender);
    }

    function _joinMember(address memberAddr) internal {
        if (status != STATUS_RECRUITING) revert InvalidStatus();
        if (block.timestamp > startDeadline) revert RecruitmentExpired();
        if (members[memberAddr].exists) revert AlreadyJoined();
        if (currentMemberCount >= maxMembers) revert CircleFull();

        token.safeTransferFrom(memberAddr, address(this), collateralAmount);
        _depositToYieldVault(collateralAmount);

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

    function contribute(uint8 roundNumber) external override nonReentrant whenNotPaused {
        if (status != STATUS_ACTIVE) revert InvalidStatus();
        if (roundNumber != currentRound) revert InvalidRound();
        if (!members[msg.sender].exists) revert NotMember();
        if (hasContributed[roundNumber][msg.sender]) revert AlreadyContributed();

        RoundInfo storage round = rounds[roundNumber];
        if (round.status != ROUND_OPEN) revert InvalidRound();
        if (block.timestamp > round.graceDeadline) revert ContributionWindowClosed();

        token.safeTransferFrom(msg.sender, address(this), contributionAmount);
        _depositToYieldVault(contributionAmount);

        hasContributed[roundNumber][msg.sender] = true;
        round.contributionsCount += 1;

        emit ContributionMade(address(this), roundNumber, msg.sender, contributionAmount, block.timestamp);
    }

    function submitBid(uint8 roundNumber, uint256 bidAmount) external override nonReentrant whenNotPaused {
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

    function computeBidCommitment(
        uint8 roundNumber,
        address bidder,
        uint256 bidAmount,
        bytes32 salt
    ) public view returns (bytes32) {
        return keccak256(abi.encodePacked(address(this), roundNumber, bidder, bidAmount, salt));
    }

    function commitBid(uint8 roundNumber, bytes32 commitment) external override nonReentrant whenNotPaused {
        if (status != STATUS_ACTIVE) revert InvalidStatus();
        if (allocationMode != MODE_BIDDING) revert BiddingNotEnabled();
        if (roundNumber != currentRound) revert InvalidRound();
        if (commitment == bytes32(0)) revert InvalidCommitment();
        if (bidCommitments[roundNumber][msg.sender].commitment != bytes32(0)) {
            revert BidAlreadyCommitted();
        }

        MemberInfo storage member = members[msg.sender];
        if (!member.exists) revert NotMember();
        if (member.hasReceivedPayout) revert AlreadyReceivedPayout();

        RoundInfo storage round = rounds[roundNumber];
        if (round.status != ROUND_OPEN) revert InvalidRound();
        if (block.timestamp > round.biddingDeadline) revert BiddingWindowClosed();

        bidCommitments[roundNumber][msg.sender] = BidCommitment({
            commitment: commitment,
            committedAt: uint64(block.timestamp),
            revealed: false,
            revealedAmount: 0
        });

        emit BidCommitted(address(this), roundNumber, msg.sender, commitment, block.timestamp);
    }

    function revealBid(
        uint8 roundNumber,
        uint256 bidAmount,
        bytes32 salt
    ) external override nonReentrant whenNotPaused {
        if (status != STATUS_ACTIVE) revert InvalidStatus();
        if (allocationMode != MODE_BIDDING) revert BiddingNotEnabled();
        if (roundNumber != currentRound) revert InvalidRound();

        MemberInfo storage member = members[msg.sender];
        if (!member.exists) revert NotMember();
        if (member.hasReceivedPayout) revert AlreadyReceivedPayout();

        RoundInfo storage round = rounds[roundNumber];
        if (round.status != ROUND_OPEN) revert InvalidRound();
        if (block.timestamp > round.biddingDeadline) revert BiddingWindowClosed();

        BidCommitment storage bc = bidCommitments[roundNumber][msg.sender];
        if (bc.commitment == bytes32(0) || bc.revealed) revert InvalidBidReveal();

        bytes32 expected = computeBidCommitment(roundNumber, msg.sender, bidAmount, salt);
        if (expected != bc.commitment) revert InvalidBidReveal();
        if (bidAmount < minBid || bidAmount > maxBid) revert BidOutOfBounds();

        bc.revealed = true;
        bc.revealedAmount = bidAmount;

        if (bidAmount > round.highestBid) {
            round.highestBidder = msg.sender;
            round.highestBid = bidAmount;
        }

        emit BidRevealed(address(this), roundNumber, msg.sender, bidAmount, block.timestamp);
        emit BidSubmitted(address(this), roundNumber, msg.sender, bidAmount, block.timestamp);
    }

    function settleRound(uint8 roundNumber) external override nonReentrant whenNotPaused {
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

        _withdrawFromYieldVault(netPayout);

        if (status == STATUS_COMPLETED) {
            _harvestAndRecallVault();
            emit CircleCompleted(address(this), totalDiscountPool, block.timestamp);
        }

        token.safeTransfer(recipient, netPayout);
    }

    function withdrawCollateral() external override nonReentrant {
        if (status != STATUS_COMPLETED && status != STATUS_CANCELLED) revert InvalidStatus();

        MemberInfo storage member = members[msg.sender];
        if (!member.exists) revert NotMember();
        if (member.isWithdrawn) revert AlreadyWithdrawn();

        if (status == STATUS_CANCELLED) {
            _harvestAndRecallVault();
        }

        member.isWithdrawn = true;
        uint256 collateralReturned = member.lockedCollateral;
        member.lockedCollateral = 0;

        uint256 discountBonus = 0;
        if (status == STATUS_COMPLETED) {
            uint256 combinedBonusPool = totalDiscountPool + totalYieldEarned;
            if (combinedBonusPool > 0) {
                discountBonus = combinedBonusPool / uint256(maxMembers);
                if (msg.sender == creator) {
                    discountBonus += combinedBonusPool % uint256(maxMembers);
                }
            }
        }

        uint256 totalPayout = collateralReturned + discountBonus;
        token.safeTransfer(msg.sender, totalPayout);

        emit CollateralWithdrawn(address(this), msg.sender, collateralReturned, discountBonus);
    }

    function cancelExpiredCircle() external override nonReentrant {
        if (status != STATUS_RECRUITING) revert InvalidStatus();
        if (block.timestamp <= startDeadline) revert RecruitmentNotExpired();

        status = STATUS_CANCELLED;
        _harvestAndRecallVault();
        emit CircleCancelled(address(this), block.timestamp);
    }

    function getEstimatedPoolYield() external view returns (uint256) {
        if (address(yieldVault) == address(0)) return totalYieldEarned;
        return totalYieldEarned + yieldVault.previewYield(address(this));
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

    function _depositToYieldVault(uint256 amount) internal {
        if (address(yieldVault) != address(0) && amount > 0) {
            token.approve(address(yieldVault), amount);
            try yieldVault.depositPrincipal(amount) {} catch {
                token.approve(address(yieldVault), 0);
            }
        }
    }

    function _withdrawFromYieldVault(uint256 amount) internal {
        if (address(yieldVault) != address(0) && amount > 0) {
            uint256 principalInVault = yieldVault.principalOf(address(this));
            uint256 pullAmount = amount <= principalInVault ? amount : principalInVault;
            if (pullAmount > 0) {
                try yieldVault.withdrawPrincipal(pullAmount, address(this)) {} catch {}
            }
        }
    }

    function _harvestAndRecallVault() internal {
        if (address(yieldVault) != address(0)) {
            uint256 principalInVault = yieldVault.principalOf(address(this));
            if (principalInVault > 0) {
                try yieldVault.withdrawPrincipal(principalInVault, address(this)) {} catch {}
            }
            try yieldVault.harvestYield(address(this)) returns (uint256 harvested) {
                if (harvested > 0) {
                    totalYieldEarned += harvested;
                    emit YieldHarvested(address(this), harvested, block.timestamp);
                }
            } catch {}
        }
    }
}
