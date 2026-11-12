// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAvaHuiFactory} from "./interfaces/IAvaHuiFactory.sol";
import {AvaHuiCircle} from "./AvaHuiCircle.sol";

contract AvaHuiFactory is IAvaHuiFactory {
    address[] private _allCircles;
    mapping(address => bool) public override isCircle;

    address public override owner;
    address public override guardian;
    address public defaultYieldVault;
    address public defaultAttestationVerifier;
    uint16 public protocolFeeBps;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event GuardianUpdated(address indexed previousGuardian, address indexed newGuardian);
    event DefaultModulesUpdated(address indexed yieldVault, address indexed attestationVerifier);
    event ProtocolFeeUpdated(uint16 feeBps);

    error Unauthorized();
    error InvalidAddress();
    error InvalidTokenAddress();
    error InvalidAllocationMode();
    error InvalidMemberCount();
    error InvalidContributionAmount();
    error InsufficientCollateralConfig();
    error InvalidDurations();
    error InvalidStartDeadline();
    error InvalidBidBounds();
    error InvalidProtocolFee();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
        guardian = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
        emit GuardianUpdated(address(0), msg.sender);
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert InvalidAddress();
        address prev = owner;
        owner = _newOwner;
        emit OwnershipTransferred(prev, _newOwner);
    }

    function setGuardian(address _newGuardian) external onlyOwner {
        if (_newGuardian == address(0)) revert InvalidAddress();
        address prev = guardian;
        guardian = _newGuardian;
        emit GuardianUpdated(prev, _newGuardian);
    }

    function setDefaultModules(address _yieldVault, address _attestationVerifier) external onlyOwner {
        defaultYieldVault = _yieldVault;
        defaultAttestationVerifier = _attestationVerifier;
        emit DefaultModulesUpdated(_yieldVault, _attestationVerifier);
    }

    function setProtocolFeeBps(uint16 _protocolFeeBps) external onlyOwner {
        if (_protocolFeeBps > 500) revert InvalidProtocolFee();
        protocolFeeBps = _protocolFeeBps;
        emit ProtocolFeeUpdated(_protocolFeeBps);
    }

    function getProtocolFeeConfig() external view returns (address treasury, uint16 feeBps) {
        return (owner, protocolFeeBps);
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

