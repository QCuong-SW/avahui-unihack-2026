// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestBase} from "../TestBase.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {AvaHuiFactory} from "../../src/AvaHuiFactory.sol";
import {AvaHuiCircle} from "../../src/AvaHuiCircle.sol";
import {IAvaHuiFactory} from "../../src/interfaces/IAvaHuiFactory.sol";

contract AvaHuiCircleBiddingTest is TestBase {
    MockUSDC internal usdc;
    AvaHuiFactory internal factory;
    AvaHuiCircle internal circle;

    address[5] internal users = [
        address(0x2001),
        address(0x2002),
        address(0x2003),
        address(0x2004),
        address(0x2005)
    ];

    uint256 internal constant CONTRIBUTION = 100 * 1e6;
    uint256 internal constant COLLATERAL = 100 * 1e6;

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new MockUSDC();
        factory = new AvaHuiFactory();

        IAvaHuiFactory.CreateCircleParams memory params = IAvaHuiFactory.CreateCircleParams({
            metadataId: "meta_bidding_01",
            name: "Bidding Circle 5 Members",
            token: address(usdc),
            allocationMode: 1, // BIDDING
            maxMembers: 5,
            contributionAmount: CONTRIBUTION,
            collateralAmount: COLLATERAL,
            roundDuration: 300,
            biddingDuration: 180,
            gracePeriod: 60,
            startDeadline: block.timestamp + 3600,
            minBid: 2 * 1e6,
            maxBid: 40 * 1e6
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

    function testBiddingTieBreakerAndRemainderDistribution() public {
        // Round 1: users[1] bids 10 mUSDC, users[2] tries to bid 10 mUSDC (reverts), then bids 15 mUSDC + 3 base units (to test remainder!)
        vm.prank(users[1]);
        circle.submitBid(1, 10 * 1e6);

        vm.prank(users[2]);
        vm.expectRevert(AvaHuiCircle.BidNotHigherThanCurrent.selector);
        circle.submitBid(1, 10 * 1e6);

        uint256 winningBidR1 = 15 * 1e6 + 3; // 15.000003 mUSDC -> remainder 3 when divided by 5
        vm.prank(users[2]);
        circle.submitBid(1, winningBidR1);

        for (uint256 i = 0; i < 5; i++) {
            vm.prank(users[i]);
            circle.contribute(1);
        }

        // Warp past biddingDeadline
        vm.warp(block.timestamp + 181);
        uint256 balBefore = usdc.balanceOf(users[2]);
        circle.settleRound(1);
        uint256 balAfter = usdc.balanceOf(users[2]);

        assertEq(balAfter - balBefore, 500 * 1e6 - winningBidR1, "Winner receives BasePot - winningBid");

        // Winner of Round 1 cannot bid in Round 2
        vm.prank(users[2]);
        vm.expectRevert(AvaHuiCircle.AlreadyReceivedPayout.selector);
        circle.submitBid(2, 10 * 1e6);

        // Complete Rounds 2..5 with no bids (auto-assigns first eligible member by slotIndex)
        for (uint8 r = 2; r <= 5; r++) {
            for (uint256 i = 0; i < 5; i++) {
                vm.prank(users[i]);
                circle.contribute(r);
            }
            vm.warp(block.timestamp + 181);
            circle.settleRound(r);
        }

        // Withdraw collateral + discount bonus for all 5 members
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(users[i]);
            circle.withdrawCollateral();
        }

        // Remainder of 3 base units went to creator (users[0]), so contract balance is strictly 0
        assertEq(usdc.balanceOf(address(circle)), 0, "Zero rounding dust left in contract");
    }
}

