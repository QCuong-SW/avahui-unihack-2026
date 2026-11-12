// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMintableToken {
    function mint(address to, uint256 amount) external;
}

/**
 * @title MockAvaxUsdcSwap
 * @notice On-chain AVAX -> mUSDC Swap Adapter on Avalanche Fuji Testnet.
 *         Default rate: 1 AVAX (1e18 wei) = 25 mUSDC (25 * 1e6 base units).
 */
contract MockAvaxUsdcSwap {
    address public immutable usdcToken;
    uint256 public usdcPerAvax = 25 * 1e6; // 25.00 mUSDC per 1 AVAX

    event AvaxSwappedToUsdc(
        address indexed user,
        uint256 avaxAmountIn,
        uint256 usdcAmountOut,
        uint256 timestamp
    );

    error ZeroAvaxInput();
    error SlippageExceeded(uint256 usdcOut, uint256 minUsdcOut);

    constructor(address _usdcToken) {
        usdcToken = _usdcToken;
    }

    function getQuoteAvaxToUsdc(uint256 avaxAmountWei) public view returns (uint256 usdcOut) {
        return (avaxAmountWei * usdcPerAvax) / 1e18;
    }

    function swapExactAvaxForUsdc(uint256 minUsdcOut) external payable returns (uint256 usdcOut) {
        if (msg.value == 0) revert ZeroAvaxInput();
        usdcOut = getQuoteAvaxToUsdc(msg.value);
        if (usdcOut < minUsdcOut) revert SlippageExceeded(usdcOut, minUsdcOut);

        IMintableToken(usdcToken).mint(msg.sender, usdcOut);
        emit AvaxSwappedToUsdc(msg.sender, msg.value, usdcOut, block.timestamp);
    }
}

