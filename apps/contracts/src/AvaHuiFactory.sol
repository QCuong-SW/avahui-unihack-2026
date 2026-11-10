// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAvaHuiFactory} from "./interfaces/IAvaHuiFactory.sol";
import {AvaHuiCircle} from "./AvaHuiCircle.sol";

contract AvaHuiFactory is IAvaHuiFactory {
    address[] private _allCircles;
    mapping(address => bool) public override isCircle;

    address public defaultYieldVault;
    address public defaultAttestationVerifier;

    error InvalidTokenAddress();
    error InvalidAllocationMode();
    error InvalidMemberCount();
    error InvalidContributionAmount();
    error InsufficientCollateralConfig();
    error InvalidDurations();
    error InvalidStartDeadline();
    error InvalidBidBounds();

    function setDefaultModules(address _yieldVault, address _attestationVerifier) external {
        defaultYieldVault = _yieldVault;
        defaultAttestationVerifier = _attestationVerifier;
    }

    function createCircle(CreateCircleParams calldata params)
        external
        override
        returns (address circleAddress)
    {
        if (params.token == address(0)) revert InvalidTokenAddress();
        if (params.allocationMode > 1) revert InvalidAllocationMode();
        if (params.maxMembers < 5 || params.maxMembers > 10) revert InvalidMemberCount();
        if (params.contributionAmount == 0) revert InvalidContributionAmount();
        if (params.collateralAmount < params.contributionAmount) revert InsufficientCollateralConfig();
        if (params.roundDuration == 0) revert InvalidDurations();
        if (params.startDeadline <= block.timestamp) revert InvalidStartDeadline();

        if (params.allocationMode == 1) {
            uint256 basePot = uint256(params.maxMembers) * params.contributionAmount;
            if (params.biddingDuration == 0 || params.biddingDuration > params.roundDuration) {
                revert InvalidDurations();
            }
            if (params.maxBid == 0 || params.minBid > params.maxBid || params.maxBid > basePot / 2) {
                revert InvalidBidBounds();
            }
        }

        AvaHuiCircle newCircle = new AvaHuiCircle(msg.sender, params);
        circleAddress = address(newCircle);

        if (defaultYieldVault != address(0)) {
            newCircle.setYieldVault(defaultYieldVault);
        }
        if (defaultAttestationVerifier != address(0)) {
            newCircle.configureSecurity(bytes32(0), false, defaultAttestationVerifier);
        }

        _allCircles.push(circleAddress);
        isCircle[circleAddress] = true;

        emit CircleCreated(
            circleAddress,
            msg.sender,
            params.metadataId,
            params.name,
            params.token,
            params.allocationMode,
            params.maxMembers,
            params.contributionAmount,
            params.collateralAmount
        );
    }

    function getAllCircles() external view override returns (address[] memory) {
        return _allCircles;
    }
}

