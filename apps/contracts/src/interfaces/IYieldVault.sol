// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IYieldVault {
    event YieldDeposited(address indexed circle, uint256 amount, uint256 timestamp);
    event YieldWithdrawn(address indexed circle, uint256 principal, uint256 yieldAmount, uint256 timestamp);

    function depositPrincipal(uint256 amount) external;
    function withdrawPrincipal(uint256 amount, address receiver) external;
    function harvestYield(address receiver) external returns (uint256 yieldAmount);
    function previewYield(address circle) external view returns (uint256 yieldAmount);
    function principalOf(address circle) external view returns (uint256);
}
