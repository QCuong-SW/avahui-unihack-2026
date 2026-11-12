// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestBase} from "../TestBase.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {AvaHuiYieldVault} from "../../src/mocks/AvaHuiYieldVault.sol";
import {MockAvaxUsdcSwap} from "../../src/mocks/MockAvaxUsdcSwap.sol";
import {Team1AttestationVerifier} from "../../src/verifiers/Team1AttestationVerifier.sol";
import {AvaHuiFactory} from "../../src/AvaHuiFactory.sol";
import {AvaHuiCircle} from "../../src/AvaHuiCircle.sol";
import {IAvaHuiFactory} from "../../src/interfaces/IAvaHuiFactory.sol";

contract AvaHuiV2SecurityTest is TestBase {
    MockUSDC internal usdc;
    AvaHuiYieldVault internal vault;
    Team1AttestationVerifier internal verifier;
    MockAvaxUsdcSwap internal swapAdapter;
    AvaHuiFactory internal factory;
    AvaHuiCircle internal circle;

    address[5] internal users = [
        address(0x4001),
        address(0x4002),
        address(0x4003),
        address(0x4004),
        address(0x4005)
    ];

    uint256 internal constant CONTRIBUTION = 100 * 1e6;
    uint256 internal constant COLLATERAL = 100 * 1e6;

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new MockUSDC();
        vault = new AvaHuiYieldVault(address(usdc));
        verifier = new Team1AttestationVerifier(address(this));
        swapAdapter = new MockAvaxUsdcSwap(address(usdc));
        factory = new AvaHuiFactory();

        IAvaHuiFactory.CreateCircleParams memory params = IAvaHuiFactory.CreateCircleParams({
            metadataId: "meta_v2_sec_01",
            name: "AvaHui V2 Sealed Bid + Yield + Sybil Guard",
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

        vm.prank(users[0]);
        circle.configureV2Features(true, false, true, address(vault), address(verifier));

        for (uint256 i = 0; i < 5; i++) {
            usdc.mint(users[i], 1_000 * 1e6);
            vm.prank(users[i]);
            usdc.approve(address(circle), type(uint256).max);
            bytes32 uniqueId = keccak256(abi.encodePacked("IDENTITY_USER_", i));
            verifier.registerAttestation(users[i], uniqueId, 2);
        }
    }

    function testSybilNullifierRejectsDuplicateIdentity() public {
        bytes32 sharedIdentity = keccak256("DUPLICATE_HUMAN_IDENTITY");
        verifier.registerAttestation(users[0], sharedIdentity, 2);
        verifier.registerAttestation(users[1], sharedIdentity, 2);

        vm.prank(users[0]);
        circle.joinCircle();

        // Second wallet belonging to the same human identity must be rejected
        vm.prank(users[1]);
        vm.expectRevert(AvaHuiCircle.IdentityAlreadyJoined.selector);
        circle.joinCircle();
    }

    function testSealedBidCommitRevealAndYieldHarvest() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(users[i]);
            circle.joinCircle();
        }

        // Round 1: users[1] commits 12 mUSDC, users[2] commits 20 mUSDC
        bytes32 salt1 = keccak256("secret_salt_1");
        bytes32 salt2 = keccak256("secret_salt_2");

        bytes32 comm1 = circle.computeBidCommitment(1, users[1], 12 * 1e6, salt1);
        bytes32 comm2 = circle.computeBidCommitment(1, users[2], 20 * 1e6, salt2);

        vm.prank(users[1]);
        circle.commitBid(1, comm1);

        vm.prank(users[2]);
        circle.commitBid(1, comm2);

        // Reveal phase
        vm.prank(users[1]);
        circle.revealBid(1, 12 * 1e6, salt1);

        // Wrong salt must revert
        vm.prank(users[2]);
        vm.expectRevert(AvaHuiCircle.CommitmentMismatch.selector);
        circle.revealBid(1, 20 * 1e6, salt1);

        vm.prank(users[2]);
        circle.revealBid(1, 20 * 1e6, salt2);

        for (uint256 i = 0; i < 5; i++) {
            vm.prank(users[i]);
            circle.contribute(1);
        }

        vm.warp(block.timestamp + 181);
        circle.settleRound(1);

        // Simulate DeFi yield accrued in vault for this circle (e.g. 25 mUSDC total yield)
        vault.simulateYieldBoost(address(circle), 25 * 1e6);

        // Finish rounds 2..5
        for (uint8 r = 2; r <= 5; r++) {
            for (uint256 i = 0; i < 5; i++) {
                vm.prank(users[i]);
                circle.contribute(r);
            }
            vm.warp(block.timestamp + 181);
            circle.settleRound(r);
        }

        // Withdraw collateral + discount bonus (20/5 = 4 mUSDC) + yield bonus (25/5 = 5 mUSDC) = 109 mUSDC each
        uint256 balBefore = usdc.balanceOf(users[0]);
        vm.prank(users[0]);
        circle.withdrawCollateral();
        uint256 balAfter = usdc.balanceOf(users[0]);

        assertEq(balAfter - balBefore, 109 * 1e6, "Each member receives 100 collateral + 4 discount + 5 yield");
    }
}

