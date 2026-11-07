// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestBase} from "../TestBase.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {AvaHuiFactory} from "../../src/AvaHuiFactory.sol";
import {AvaHuiCircle} from "../../src/AvaHuiCircle.sol";
import {IAvaHuiFactory} from "../../src/interfaces/IAvaHuiFactory.sol";

contract AvaHuiCircleFixedTest is TestBase {
    MockUSDC internal usdc;
    AvaHuiFactory internal factory;
    AvaHuiCircle internal circle;

    address[5] internal users = [
        address(0x1001),
        address(0x1002),
        address(0x1003),
        address(0x1004),
        address(0x1005)
    ];

    uint256 internal constant CONTRIBUTION = 100 * 1e6; // 100 mUSDC
    uint256 internal constant COLLATERAL = 100 * 1e6;   // 100 mUSDC

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new MockUSDC();
        factory = new AvaHuiFactory();

        IAvaHuiFactory.CreateCircleParams memory params = IAvaHuiFactory.CreateCircleParams({
            metadataId: "meta_fixed_01",
            name: "Fixed Circle 5 Members",
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
        address circleAddr = factory.createCircle(params);
        circle = AvaHuiCircle(circleAddr);

        for (uint256 i = 0; i < 5; i++) {
            usdc.mint(users[i], 1_000 * 1e6);
            vm.prank(users[i]);
            usdc.approve(address(circle), type(uint256).max);
        }
    }

    function testFullFixedLifecycle() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(users[i]);
            circle.joinCircle();
        }

        (uint8 status, , , uint8 memberCount, uint8 currentRound, , , ) = circle.getCircleSummary();
        assertEq(status, 1, "Circle should be ACTIVE after 5th member joins");
        assertEq(memberCount, 5, "Member count should be 5");
        assertEq(currentRound, 1, "Current round should be 1");

        // Run all 5 rounds
        for (uint8 r = 1; r <= 5; r++) {
            uint256 recipientBefore = usdc.balanceOf(users[r - 1]);

            for (uint256 m = 0; m < 5; m++) {
                vm.prank(users[m]);
                circle.contribute(r);
            }

            circle.settleRound(r);

            uint256 recipientAfter = usdc.balanceOf(users[r - 1]);
            // Recipient contributed 100 and received 500 -> net +400 mUSDC
            assertEq(recipientAfter - recipientBefore, 400 * 1e6, "Recipient net gain should be 400 mUSDC");
        }

        (uint8 finalStatus, , , , , , , ) = circle.getCircleSummary();
        assertEq(finalStatus, 2, "Circle should be COMPLETED after 5 rounds");

        // Withdraw collateral for all 5 members
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(users[i]);
            circle.withdrawCollateral();
        }

        assertEq(usdc.balanceOf(address(circle)), 0, "Contract balance must be 0 after all withdrawals");
    }

    function testCancelExpiredRecruitingCircle() public {
        // Only 2 members join
        vm.prank(users[0]);
        circle.joinCircle();
        vm.prank(users[1]);
        circle.joinCircle();

        // Warp past startDeadline
        vm.warp(block.timestamp + 7200);
        circle.cancelExpiredCircle();

        (uint8 status, , , , , , , ) = circle.getCircleSummary();
        assertEq(status, 3, "Circle should be CANCELLED");

        vm.prank(users[0]);
        circle.withdrawCollateral();
        vm.prank(users[1]);
        circle.withdrawCollateral();

        assertEq(usdc.balanceOf(address(circle)), 0, "Contract balance must be 0 after cancelled withdrawals");
    }
}

