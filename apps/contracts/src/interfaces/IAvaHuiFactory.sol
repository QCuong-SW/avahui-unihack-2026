// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAvaHuiFactory {
    struct CreateCircleParams {
        string metadataId;            // UUID từ Backend hoặc chuỗi định danh ngắn
        string name;                  // Tên dây hụi
        address token;                // Địa chỉ MockUSDC trên Fuji
        uint8 allocationMode;         // 0 = FIXED, 1 = BIDDING
        uint8 maxMembers;             // 5..10
        uint256 contributionAmount;   // Số tiền đóng mỗi vòng (base units, 6 decimals)
        uint256 collateralAmount;     // Số tiền thế chấp phải khóa khi join
        uint256 roundDuration;        // Thời gian đóng tiền mỗi vòng (giây)
        uint256 biddingDuration;      // Thời gian đấu giá trong vòng (giây, <= roundDuration)
        uint256 gracePeriod;          // Thời gian ân hạn trước khi bị slash (giây)
        uint256 startDeadline;        // Hạn chót phải gom đủ thành viên (unix timestamp)
        uint256 minBid;               // Mức bid tối thiểu (0 nếu FIXED)
        uint256 maxBid;               // Mức bid tối đa (0 nếu FIXED)
    }

    event CircleCreated(
        address indexed circleAddress,
        address indexed creator,
        string metadataId,
        string name,
        address token,
        uint8 allocationMode,
        uint8 maxMembers,
        uint256 contributionAmount,
        uint256 collateralAmount
    );

    function createCircle(CreateCircleParams calldata params) external returns (address circleAddress);
    function getAllCircles() external view returns (address[] memory);
    function isCircle(address circle) external view returns (bool);
}

