// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestBase} from "../TestBase.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {AvaHuiFactory} from "../../src/AvaHuiFactory.sol";
import {AvaHuiCircle} from "../../src/AvaHuiCircle.sol";
import {IAvaHuiFactory} from "../../src/interfaces/IAvaHuiFactory.sol";

contract AvaHuiAccountingFuzzTest is TestBase {
    MockUSDC internal usdc;
    AvaHuiFactory internal factory;

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new MockUSDC();
        factory = new AvaHuiFactory();
    }

    function testFuzz_ZeroDustAfterCompletion(
        uint8 rawMembers,
        uint64 rawContrib,
        uint64 rawBidSeed
    ) public {
        uint8 maxMembers = uint8(5 + (rawMembers % 6)); // 5..10
        uint256 contributionAmount = uint256(10 * 1e6) + (uint256(rawContrib) % (1_000 * 1e6));
        uint256 collateralAmount = contributionAmount * 2;
        uint256 basePot = uint256(maxMembers) * contributionAmount;
        uint256 maxBid = basePot / 3;
        uint256 minBid = 1e6;

        IAvaHuiFactory.CreateCircleParams memory params = IAvaHuiFactory.CreateCircleParams({
            metadataId: "fuzz_meta",
            name: "Fuzz Circle",
            token: address(usdc),
            allocationMode: 1,
            maxMembers: maxMembers,
            contributionAmount: contributionAmount,
            collateralAmount: collateralAmount,
            roundDuration: 300,
            biddingDuration: 180,
            gracePeriod: 60,
            startDeadline: block.timestamp + 3600,
            minBid: minBid,
            maxBid: maxBid
        });

        address creator = address(uint160(0x5000));
        vm.prank(creator);
        AvaHuiCircle circle = AvaHuiCircle(factory.createCircle(params));

        for (uint8 i = 0; i < maxMembers; i++) {
            address member = address(uint160(0x5000 + i));
            usdc.mint(member, collateralAmount + basePot * 2);
            vm.prank(member);
            usdc.approve(address(circle), type(uint256).max);
            vm.prank(member);
            circle.joinCircle();
        }

        for (uint8 r = 1; r <= maxMembers; r++) {
            address bidder = address(uint160(0x5000 + r - 1));
            uint256 bidAmount = minBid + (uint256(rawBidSeed) * r) % (maxBid - minBid + 1);
            vm.prank(bidder);
            circle.submitBid(r, bidAmount);

            for (uint8 m = 0; m < maxMembers; m++) {
                address member = address(uint160(0x5000 + m));
                vm.prank(member);
                circle.contribute(r);
            }

            vm.warp(block.timestamp + 200);
            circle.settleRound(r);
        }

        for (uint8 i = 0; i < maxMembers; i++) {
            address member = address(uint160(0x5000 + i));
            vm.prank(member);
            circle.withdrawCollateral();
        }

        assertEq(usdc.balanceOf(address(circle)), 0, "Fuzz: Contract balance must always be 0 after all withdrawals");
    }
}

