// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IYieldVault {
    function asset() external view returns (address);
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
    function previewRedeem(uint256 shares) external view returns (uint256 assets);
    function harvestYieldFor(address account) external returns (uint256 yieldAmount);
    function pendingYieldOf(address account) external view returns (uint256 yieldAmount);
}

