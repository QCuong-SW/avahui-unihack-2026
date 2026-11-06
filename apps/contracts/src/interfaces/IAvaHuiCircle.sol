// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAvaHuiCircle {
    // --- EVENTS CHO BACKEND INDEXER ---
    event MemberJoined(
        address indexed circleAddress,
        address indexed member,
        uint8 slotIndex,
        uint256 collateralLocked
    );

    event CircleActivated(
        address indexed circleAddress,
        uint256 startTime,
        uint8 currentRound,
        uint256 contributionDeadline,
        uint256 biddingDeadline
    );

    event ContributionMade(
        address indexed circleAddress,
        uint8 indexed roundNumber,
        address indexed member,
        uint256 amount,
        uint256 timestamp
    );

    event BidSubmitted(
        address indexed circleAddress,
        uint8 indexed roundNumber,
        address indexed bidder,
        uint256 bidAmount,
        uint256 timestamp
    );

    event CollateralSlashed(
        address indexed circleAddress,
        uint8 indexed roundNumber,
        address indexed defaultedMember,
        uint256 slashedAmount,
        uint256 remainingCollateral
    );

    event RoundSettled(
        address indexed circleAddress,
        uint8 indexed roundNumber,
        address indexed recipient,
        uint256 grossPotAmount,
        uint256 winningBidAmount,
        uint256 netPayoutAmount,
        uint8 nextRoundNumber
    );

    event CircleCompleted(
        address indexed circleAddress,
        uint256 totalDiscountPool,
        uint256 timestamp
    );

    event CollateralWithdrawn(
        address indexed circleAddress,
        address indexed member,
        uint256 collateralReturned,
        uint256 discountBonusReturned
    );

    event CircleCancelled(
        address indexed circleAddress,
        uint256 timestamp
    );

    // --- WRITE FUNCTIONS CHO FRONTEND ---
    function joinCircle() external;
    function contribute(uint8 roundNumber) external;
    function submitBid(uint8 roundNumber, uint256 bidAmount) external;
    function settleRound(uint8 roundNumber) external;
    function withdrawCollateral() external;
    function cancelExpiredCircle() external;

    // --- READ FUNCTIONS CHO FRONTEND ---
    function getCircleSummary() external view returns (
        uint8 status,
        uint8 allocationMode,
        uint8 maxMembers,
        uint8 currentMemberCount,
        uint8 currentRound,
        uint256 contributionAmount,
        uint256 collateralAmount,
        uint256 totalDiscountPool
    );
}

