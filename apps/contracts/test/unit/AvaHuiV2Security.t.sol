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

    function testFactoryAccessControlOnlyOwner() public {
        vm.prank(users[1]);
        vm.expectRevert(AvaHuiFactory.Unauthorized.selector);
        factory.setDefaultModules(address(vault), address(verifier));

        vm.prank(users[1]);
        vm.expectRevert(AvaHuiFactory.Unauthorized.selector);
        factory.setGuardian(users[1]);

        vm.prank(users[1]);
        vm.expectRevert(AvaHuiFactory.Unauthorized.selector);
        factory.transferOwnership(users[1]);
    }

    function testAttestationSelfIssuanceBlockedAndRevocable() public {
        bytes32 fakeNullifier = keccak256("SELF_FAKE_ID");

        // Attacker cannot self-issue attestation
        vm.prank(users[1]);
        vm.expectRevert(Team1AttestationVerifier.UnauthorizedIssuer.selector);
        verifier.issueAttestation(users[1], fakeNullifier, 2);

        // Issuer issues attestation to users[1]
        verifier.issueAttestation(users[1], fakeNullifier, 2);
        assertTrue(
            verifier.verifyMemberAttestation(users[1], fakeNullifier),
            "Issued attestation must verify"
        );

        // Same nullifier cannot be bound to another address
        vm.expectRevert(Team1AttestationVerifier.NullifierAlreadyBound.selector);
        verifier.issueAttestation(users[2], fakeNullifier, 2);

        // Issuer can revoke compromised attestation
        verifier.revokeAttestation(users[1]);
        assertTrue(
            !verifier.verifyMemberAttestation(users[1], fakeNullifier),
            "Revoked attestation must fail verification"
        );
    }

    function testCircleConfigLockedAfterFirstMemberAndSealedBidSingleCommit() public {
        bytes32 nullifier0 = keccak256("TEAM1_LOCK_0");
        verifier.issueAttestation(users[0], nullifier0, 2);
        usdc.mint(users[0], 1_000 * 1e6);
        vm.prank(users[0]);
        usdc.approve(address(circle), type(uint256).max);
        vm.prank(users[0]);
        circle.joinCircleProtected(INVITE_CODE, nullifier0);

        // Creator cannot swap vault or security gates after member joined
        vm.prank(users[0]);
        vm.expectRevert(AvaHuiCircle.ConfigLockedAfterJoin.selector);
        circle.setYieldVault(address(0x9999));

        vm.prank(users[0]);
        vm.expectRevert(AvaHuiCircle.ConfigLockedAfterJoin.selector);
        circle.configureSecurity(bytes32(0), false, address(0));

        // Join remaining 4 members to activate circle
        for (uint256 i = 1; i < 5; i++) {
            bytes32 nullifier = keccak256(abi.encodePacked("TEAM1_LOCK_", i));
            verifier.issueAttestation(users[i], nullifier, 2);
            usdc.mint(users[i], 1_000 * 1e6);
            vm.prank(users[i]);
            usdc.approve(address(circle), type(uint256).max);
            vm.prank(users[i]);
            circle.joinCircleProtected(INVITE_CODE, nullifier);
        }

        // Single-shot commitment: cannot overwrite commitBid in the same round
        bytes32 commit1 = circle.computeBidCommitment(1, users[1], 10 * 1e6, keccak256("salt_a"));
        bytes32 commit2 = circle.computeBidCommitment(1, users[1], 20 * 1e6, keccak256("salt_b"));
        vm.prank(users[1]);
        circle.commitBid(1, commit1);

        vm.prank(users[1]);
        vm.expectRevert(AvaHuiCircle.BidAlreadyCommitted.selector);
        circle.commitBid(1, commit2);
    }

    function testGuardianPauseAndEmergencyCancelAllowsWithdrawal() public {
        bytes32 nullifier0 = keccak256("TEAM1_GUARD_0");
        verifier.issueAttestation(users[0], nullifier0, 2);
        usdc.mint(users[0], 1_000 * 1e6);
        vm.prank(users[0]);
        usdc.approve(address(circle), type(uint256).max);
        vm.prank(users[0]);
        circle.joinCircleProtected(INVITE_CODE, nullifier0);

        // Non-guardian cannot pause
        vm.prank(users[1]);
        vm.expectRevert(AvaHuiCircle.UnauthorizedGuardian.selector);
        circle.pause();

        // Guardian pauses circle
        circle.pause();
        assertTrue(circle.paused(), "Circle must be paused");

        // Joining while paused reverts
        bytes32 nullifier1 = keccak256("TEAM1_GUARD_1");
        verifier.issueAttestation(users[1], nullifier1, 2);
        usdc.mint(users[1], 1_000 * 1e6);
        vm.prank(users[1]);
        usdc.approve(address(circle), type(uint256).max);
        vm.prank(users[1]);
        vm.expectRevert(AvaHuiCircle.ContractPaused.selector);
        circle.joinCircleProtected(INVITE_CODE, nullifier1);

        // Guardian triggers emergencyCancel during recruiting and member can still withdraw even while paused
        circle.emergencyCancel();
        vm.prank(users[0]);
        circle.withdrawCollateral();
        assertEq(usdc.balanceOf(users[0]), 1_000 * 1e6, "Member must recover full collateral while paused");
    }

    function testSealedBidLockCommitWindowAndProtocolYieldFee() public {
        // Configure sealedBidOnly + 5% (500 bps) fee strictly on yield
        vm.expectRevert(AvaHuiFactory.InvalidProtocolFee.selector);
        factory.setProtocolFeeBps(501);
        factory.setProtocolFeeBps(500);

        vm.prank(users[0]);
        circle.setSealedBidOnly(true);

        for (uint256 i = 0; i < 5; i++) {
            bytes32 nullifier = keccak256(abi.encodePacked("TEAM1_V21_", i));
            verifier.issueAttestation(users[i], nullifier, 2);
            usdc.mint(users[i], 1_000 * 1e6);
            vm.prank(users[i]);
            usdc.approve(address(circle), type(uint256).max);
            vm.prank(users[i]);
            circle.joinCircleProtected(INVITE_CODE, nullifier);
        }

        // Open submitBid is blocked when sealedBidOnly is enabled
        vm.prank(users[1]);
        vm.expectRevert(AvaHuiCircle.SealedBidOnly.selector);
        circle.submitBid(1, 10 * 1e6);

        // users[1] commits inside the first 2/3 commit window (biddingDuration=180 => commitDeadline=+120s)
        bytes32 salt1 = keccak256("v21_salt_1");
        bytes32 commit1 = circle.computeBidCommitment(1, users[1], 15 * 1e6, salt1);
        vm.prank(users[1]);
        circle.commitBid(1, commit1);

        // Move into the final 1/3 reveal-only window (+130s > +120s commitDeadline, <= +180s biddingDeadline)
        vm.warp(block.timestamp + 130);

        bytes32 commit2 = circle.computeBidCommitment(1, users[2], 20 * 1e6, keccak256("v21_salt_2"));
        vm.prank(users[2]);
        vm.expectRevert(AvaHuiCircle.CommitWindowClosed.selector);
        circle.commitBid(1, commit2);

        // users[1] reveals inside the reveal-only window
        vm.prank(users[1]);
        circle.revealBid(1, 15 * 1e6, salt1);

        // Complete all 5 rounds over 30 days to accrue yield and collect 5% fee on yield only
        uint256 treasuryBefore = usdc.balanceOf(address(this));
        for (uint8 r = 1; r <= 5; r++) {
            for (uint256 i = 0; i < 5; i++) {
                vm.prank(users[i]);
                circle.contribute(r);
            }
            vm.warp(block.timestamp + 6 days);
            circle.settleRound(r);
        }

        uint256 treasuryEarned = usdc.balanceOf(address(this)) - treasuryBefore;
        assertTrue(treasuryEarned > 0, "Treasury receives 5% fee on harvested yield");
        assertTrue(circle.totalYieldEarned() > treasuryEarned, "Members keep 95% of harvested yield");
    }
}
