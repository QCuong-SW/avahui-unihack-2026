// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestBase} from "../TestBase.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {AvaHuiYieldVault} from "../../src/mocks/AvaHuiYieldVault.sol";
import {Team1AttestationVerifier} from "../../src/verifiers/Team1AttestationVerifier.sol";
import {AvaHuiFactory} from "../../src/AvaHuiFactory.sol";
import {AvaHuiCircle} from "../../src/AvaHuiCircle.sol";
import {IAvaHuiFactory} from "../../src/interfaces/IAvaHuiFactory.sol";

contract AvaHuiV2SecurityTest is TestBase {
    MockUSDC internal usdc;
    AvaHuiYieldVault internal vault;
    Team1AttestationVerifier internal verifier;
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
    uint256 internal constant COLLATERAL = 100 * 1e6;
    string internal constant INVITE_CODE = "AVAHUI-UNIHACK-VIP";

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new MockUSDC();
        vault = new AvaHuiYieldVault(address(usdc));
        verifier = new Team1AttestationVerifier(address(this));
        factory = new AvaHuiFactory();

        IAvaHuiFactory.CreateCircleParams memory params = IAvaHuiFactory.CreateCircleParams({
            metadataId: "meta_v2_sec_01",
            name: "Sealed Bid + Yield + Sybil Protected Circle",
            token: address(usdc),
            allocationMode: 1,
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
        circle.setYieldVault(address(vault));

        vm.prank(users[0]);
        circle.configureSecurity(
            keccak256(abi.encodePacked(INVITE_CODE)),
            true,
            address(verifier)
        );
    }

    function testSybilResistanceInviteLinkAndCommitRevealYield() public {
        // 1. Issue Team1 Attestations to 5 unique human identities
        for (uint256 i = 0; i < 5; i++) {
            bytes32 nullifier = keccak256(abi.encodePacked("TEAM1_ID_", i));
            verifier.issueAttestation(users[i], nullifier, 2);
            usdc.mint(users[i], 1_000 * 1e6);
            vm.prank(users[i]);
            usdc.approve(address(circle), type(uint256).max);
            vm.prank(users[i]);
            circle.joinCircleProtected(INVITE_CODE, nullifier);
        }

        // 2. Round 1 Sealed-Bid Commit-Reveal
        bytes32 salt1 = keccak256("secret_salt_user_1");
        uint256 bid1 = 12 * 1e6;
        bytes32 commit1 = circle.computeBidCommitment(1, users[1], bid1, salt1);

        vm.prank(users[1]);
        circle.commitBid(1, commit1);

        bytes32 salt2 = keccak256("secret_salt_user_2");
        uint256 bid2 = 20 * 1e6;
        bytes32 commit2 = circle.computeBidCommitment(1, users[2], bid2, salt2);

        vm.prank(users[2]);
        circle.commitBid(1, commit2);

        // Reveal phase
        vm.prank(users[1]);
        circle.revealBid(1, bid1, salt1);

        vm.prank(users[2]);
        circle.revealBid(1, bid2, salt2);

        for (uint256 i = 0; i < 5; i++) {
            vm.prank(users[i]);
            circle.contribute(1);
        }

        vm.warp(block.timestamp + 30 days);
        uint256 estimatedYield = circle.getEstimatedPoolYield();
        assertTrue(estimatedYield > 0, "Pool accrues DeFi yield on undisbursed funds");

        circle.settleRound(1);
    }
}
