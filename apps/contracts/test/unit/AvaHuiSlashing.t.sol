// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestBase} from "../TestBase.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {AvaHuiFactory} from "../../src/AvaHuiFactory.sol";
import {AvaHuiCircle} from "../../src/AvaHuiCircle.sol";
import {IAvaHuiFactory} from "../../src/interfaces/IAvaHuiFactory.sol";

contract AvaHuiSlashingTest is TestBase {
    MockUSDC internal usdc;
    AvaHuiFactory internal factory;
    AvaHuiCircle internal circle;

    address[5] internal users = [
        address(0x3001),
        address(0x3002),
        address(0x3003),
        address(0x3004),
        address(0x3005)
    ];

    uint256 internal constant CONTRIBUTION = 100 * 1e6;
    uint256 internal constant COLLATERAL = 200 * 1e6; // 2x collateral

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new MockUSDC();
        factory = new AvaHuiFactory();

        IAvaHuiFactory.CreateCircleParams memory params = IAvaHuiFactory.CreateCircleParams({
            metadataId: "meta_slash_01",
            name: "Slashing Protection Circle",
            token: address(usdc),
            allocationMode: 0, // FIXED
            maxMembers: 5,
            contributionAmount: CONTRIBUTION,
            collateralAmount: COLLATERAL,
            roundDuration: 300,
            biddingDuration: 0,
            gracePeriod: 60,
            startDeadline: block.timestamp + 3600,
            minBid: 0,
            maxBid: 0
        });

        vm.prank(users[0]);
        circle = AvaHuiCircle(factory.createCircle(params));

        for (uint256 i = 0; i < 5; i++) {
            usdc.mint(users[i], 1_000 * 1e6);
            vm.prank(users[i]);
            usdc.approve(address(circle), type(uint256).max);
            vm.prank(users[i]);
            circle.joinCircle();
        }
    }

    function testSlashingCoversDefaultAndProtectsPayout() public {
        // In Round 1, users[0..3] contribute, but users[4] defaults!
        for (uint256 i = 0; i < 4; i++) {
            vm.prank(users[i]);
            circle.contribute(1);
        }

        // Cannot settle before grace period expires if someone hasn't contributed
        vm.expectRevert(AvaHuiCircle.SettlementConditionsNotMet.selector);
        circle.settleRound(1);

        // Warp past contributionDeadline (300s) + gracePeriod (60s)
        vm.warp(block.timestamp + 361);

        uint256 winnerBefore = usdc.balanceOf(users[0]);
        circle.settleRound(1);
        uint256 winnerAfter = usdc.balanceOf(users[0]);

        // Winner still receives full 500 mUSDC!
        assertEq(winnerAfter - winnerBefore, 500 * 1e6, "Winner must receive full 500 mUSDC even when member 5 defaulted");

        // Check defaulted member's remaining collateral and defaultCount
        (, uint256 remainingCollat, , , uint8 defaultCount, , ) = circle.members(users[4]);
        assertEq(remainingCollat, 100 * 1e6, "Defaulted member collateral slashed from 200 to 100 mUSDC");
        assertEq(defaultCount, 1, "Default count incremented to 1");
    }
}

