// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IYieldVault} from "../interfaces/IYieldVault.sol";
import {IERC20Minimal} from "../interfaces/IERC20Minimal.sol";
import {SafeTransferLib} from "../libraries/SecurityLib.sol";

interface IMintableERC20 is IERC20Minimal {
    function mint(address to, uint256 amount) external;
}

/**
 * @title AvaHuiYieldVault
 * @notice ERC-4626 style Lending/Yield Adapter for AvaHui Undisbursed Pool & Locked Collateral.
 *         Accrues continuous yield (default 800 bps = 8% APY) on deposited mUSDC.
 */
contract AvaHuiYieldVault is IYieldVault {
    using SafeTransferLib for IERC20Minimal;

    address public immutable override asset;
    uint256 public apyBps = 800; // 8.00% APY
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    uint256 public totalShares;
    mapping(address => uint256) public sharesOf;
    mapping(address => uint256) public lastAccruedAt;
    mapping(address => uint256) public accruedYieldBalance;

    event VaultDeposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    event VaultWithdraw(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    event YieldAccrued(address indexed account, uint256 yieldAdded, uint256 totalAccrued);

    constructor(address _asset) {
        asset = _asset;
    }

    function deposit(uint256 assets, address receiver) external override returns (uint256 shares) {
        _accrue(receiver);
        if (assets > 0) {
            IERC20Minimal(asset).safeTransferFrom(msg.sender, address(this), assets);
        }
        shares = assets;
        sharesOf[receiver] += shares;
        totalShares += shares;
        emit VaultDeposit(msg.sender, receiver, assets, shares);
    }

    function withdraw(uint256 assets, address receiver, address owner) external override returns (uint256 shares) {
        require(msg.sender == owner, "Not owner");
        _accrue(owner);
        shares = assets;
        require(sharesOf[owner] >= shares, "Insufficient vault shares");
        sharesOf[owner] -= shares;
        totalShares -= shares;
        IERC20Minimal(asset).safeTransfer(receiver, assets);
        emit VaultWithdraw(msg.sender, receiver, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) external override returns (uint256 assets) {
        require(msg.sender == owner, "Not owner");
        _accrue(owner);
        require(sharesOf[owner] >= shares, "Insufficient vault shares");
        sharesOf[owner] -= shares;
        totalShares -= shares;
        uint256 yieldPart = accruedYieldBalance[owner];
        accruedYieldBalance[owner] = 0;

        if (yieldPart > 0) {
            try IMintableERC20(asset).mint(address(this), yieldPart) {} catch {}
        }

        assets = shares + yieldPart;
        IERC20Minimal(asset).safeTransfer(receiver, assets);
        emit VaultWithdraw(msg.sender, receiver, assets, shares);
    }

    function harvestYieldFor(address account) external override returns (uint256 yieldAmount) {
        _accrue(account);
        yieldAmount = accruedYieldBalance[account];
        if (yieldAmount > 0) {
            accruedYieldBalance[account] = 0;
            try IMintableERC20(asset).mint(account, yieldAmount) {} catch {
                yieldAmount = 0;
            }
        }
    }

    function pendingYieldOf(address account) public view override returns (uint256 yieldAmount) {
        uint256 principal = sharesOf[account];
        uint256 lastTs = lastAccruedAt[account];
        uint256 deltaYield = 0;
        if (principal > 0 && lastTs > 0 && block.timestamp > lastTs) {
            uint256 elapsed = block.timestamp - lastTs;
            deltaYield = (principal * apyBps * elapsed) / (10_000 * SECONDS_PER_YEAR);
        }
        return accruedYieldBalance[account] + deltaYield;
    }

    function simulateYieldBoost(address account, uint256 bonusYield) external {
        _accrue(account);
        accruedYieldBalance[account] += bonusYield;
        emit YieldAccrued(account, bonusYield, accruedYieldBalance[account]);
    }

    function convertToAssets(uint256 shares) external pure override returns (uint256 assets) {
        return shares;
    }

    function previewRedeem(uint256 shares) external pure override returns (uint256 assets) {
        return shares;
    }

    function _accrue(address account) internal {
        uint256 principal = sharesOf[account];
        uint256 lastTs = lastAccruedAt[account];
        if (principal > 0 && lastTs > 0 && block.timestamp > lastTs) {
            uint256 elapsed = block.timestamp - lastTs;
            uint256 added = (principal * apyBps * elapsed) / (10_000 * SECONDS_PER_YEAR);
            if (added > 0) {
                accruedYieldBalance[account] += added;
                emit YieldAccrued(account, added, accruedYieldBalance[account]);
            }
        }
        lastAccruedAt[account] = block.timestamp;
    }
}

