// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IYieldVault} from "../interfaces/IYieldVault.sol";
import {IERC20Minimal} from "../interfaces/IERC20Minimal.sol";
import {SafeTransferLib, ReentrancyGuard} from "../libraries/SecurityLib.sol";

interface IMintableToken is IERC20Minimal {
    function mint(address to, uint256 amount) external;
}

/**
 * @title AvaHuiYieldVault
 * @notice ERC-4626 inspired Lending/Yield Vault for undisbursed ROSCA collateral and round pots.
 *         Accrues 6.50% APY (650 bps) continuously on locked principal.
 */
contract AvaHuiYieldVault is IYieldVault, ReentrancyGuard {
    using SafeTransferLib for IERC20Minimal;

    uint256 public constant APY_BPS = 650; // 6.50% APY
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    IERC20Minimal public immutable asset;

    struct VaultPosition {
        uint256 principal;
        uint256 accruedYield;
        uint256 lastUpdated;
    }

    mapping(address => VaultPosition) internal _positions;

    error ZeroAmount();
    error InsufficientPrincipal();

    constructor(address _asset) {
        asset = IERC20Minimal(_asset);
    }

    function depositPrincipal(uint256 amount) external override nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _accrue(msg.sender);

        asset.safeTransferFrom(msg.sender, address(this), amount);
        _positions[msg.sender].principal += amount;

        emit YieldDeposited(msg.sender, amount, block.timestamp);
    }

    function withdrawPrincipal(uint256 amount, address receiver) external override nonReentrant {
        VaultPosition storage pos = _positions[msg.sender];
        if (pos.principal < amount) revert InsufficientPrincipal();

        _accrue(msg.sender);
        pos.principal -= amount;

        asset.safeTransfer(receiver, amount);
        emit YieldWithdrawn(msg.sender, amount, 0, block.timestamp);
    }

    function harvestYield(address receiver) external override nonReentrant returns (uint256 yieldAmount) {
        _accrue(msg.sender);
        VaultPosition storage pos = _positions[msg.sender];
        yieldAmount = pos.accruedYield;

        if (yieldAmount > 0) {
            pos.accruedYield = 0;
            // Mint simulated DeFi lending yield from MockUSDC for deterministic testnet demonstration
            try IMintableToken(address(asset)).mint(receiver, yieldAmount) {} catch {
                uint256 vaultBal = asset.balanceOf(address(this));
                if (vaultBal >= pos.principal + yieldAmount) {
                    asset.safeTransfer(receiver, yieldAmount);
                } else {
                    yieldAmount = 0;
                }
            }
            emit YieldWithdrawn(msg.sender, 0, yieldAmount, block.timestamp);
        }
    }

    function previewYield(address circle) external view override returns (uint256 yieldAmount) {
        VaultPosition storage pos = _positions[circle];
        yieldAmount = pos.accruedYield + _pendingDelta(pos);
    }

    function principalOf(address circle) external view override returns (uint256) {
        return _positions[circle].principal;
    }

    function _accrue(address circle) internal {
        VaultPosition storage pos = _positions[circle];
        if (pos.lastUpdated > 0 && pos.principal > 0) {
            pos.accruedYield += _pendingDelta(pos);
        }
        pos.lastUpdated = block.timestamp;
    }

    function _pendingDelta(VaultPosition storage pos) internal view returns (uint256) {
        if (pos.principal == 0 || pos.lastUpdated == 0 || block.timestamp <= pos.lastUpdated) {
            return 0;
        }
        uint256 elapsed = block.timestamp - pos.lastUpdated;
        return (pos.principal * APY_BPS * elapsed) / (10_000 * SECONDS_PER_YEAR);
    }
}
