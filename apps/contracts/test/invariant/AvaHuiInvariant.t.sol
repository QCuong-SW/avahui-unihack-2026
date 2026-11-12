// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestBase} from "../TestBase.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {AvaHuiYieldVault} from "../../src/mocks/AvaHuiYieldVault.sol";
import {AvaHuiFactory} from "../../src/AvaHuiFactory.sol";
import {AvaHuiCircle} from "../../src/AvaHuiCircle.sol";
import {IAvaHuiFactory} from "../../src/interfaces/IAvaHuiFactory.sol";

contract AvaHuiInvariantHandler is TestBase {
    MockUSDC public immutable usdc;
    AvaHuiYieldVault public immutable vault;
    AvaHuiFactory public immutable factory;
    AvaHuiCircle public immutable circle;

    address[] public actors;
    uint8 public constant MAX_MEMBERS = 5;
    uint256 public constant CONTRIBUTION = 100 * 1e6;
    uint256 public constant COLLATERAL = 200 * 1e6;

    uint256 public withdrawnBonusTotal;
    uint256 public completedUnwithdrawnSlots;

    constructor(
        MockUSDC _usdc,
        AvaHuiYieldVault _vault,
        AvaHuiFactory _factory,
        AvaHuiCircle _circle,
        address[] memory _actors
    ) {
        usdc = _usdc;
        vault = _vault;
        factory = _factory;
        circle = _circle;
        actors = _actors;
        completedUnwithdrawnSlots = MAX_MEMBERS;
    }

    function joinNext() external {
        if (circle.status() != circle.STATUS_RECRUITING()) return;
        if (circle.paused()) return;

        uint8 count = circle.currentMemberCount();
        if (count >= MAX_MEMBERS) return;

        address actor = actors[count];
        usdc.mint(actor, COLLATERAL + CONTRIBUTION * MAX_MEMBERS);
        vm.prank(actor);
        usdc.approve(address(circle), type(uint256).max);
        vm.prank(actor);
        circle.joinCircle();
    }

    function contributeActor(uint8 actorSeed) external {
        if (circle.status() != circle.STATUS_ACTIVE()) return;
        if (circle.paused()) return;

        uint8 roundNum = circle.currentRound();
        address actor = actors[actorSeed % MAX_MEMBERS];
        if (circle.hasContributed(roundNum, actor)) return;

        vm.prank(actor);
        circle.contribute(roundNum);
    }

    function bidActor(uint8 actorSeed, uint256 rawBid) external {
        if (circle.status() != circle.STATUS_ACTIVE()) return;
        if (circle.paused()) return;

        uint8 roundNum = circle.currentRound();
        (, , , uint256 biddingDeadline, , , uint256 highestBid, , ) = circle.getRoundInfo(roundNum);
        if (block.timestamp > biddingDeadline) return;

        address actor = actors[actorSeed % MAX_MEMBERS];
        (, , bool hasReceivedPayout, , , , bool exists) = circle.members(actor);
        if (!exists || hasReceivedPayout) return;

        uint256 minBid = circle.minBid();
        uint256 maxBid = circle.maxBid();
        uint256 floorBid = highestBid >= minBid ? highestBid + 1e6 : minBid;
        if (floorBid > maxBid) return;

        uint256 bidAmount = floorBid + (rawBid % (maxBid - floorBid + 1));
        vm.prank(actor);
        circle.submitBid(roundNum, bidAmount);
    }

    function warpAndSettle() external {
        if (circle.status() != circle.STATUS_ACTIVE()) return;
        if (circle.paused()) return;

        uint8 roundNum = circle.currentRound();
        (, , , , uint256 graceDeadline, , , , ) = circle.getRoundInfo(roundNum);
        if (block.timestamp <= graceDeadline) {
            vm.warp(graceDeadline + 1);
        }

        circle.settleRound(roundNum);
    }

    function togglePause(bool shouldPause) external {
        address guardian = circle.getGuardian();
        if (shouldPause && !circle.paused()) {
            vm.prank(guardian);
            circle.pause();
        } else if (!shouldPause && circle.paused()) {
            vm.prank(guardian);
            circle.unpause();
        }
    }

    function withdrawActor(uint8 actorSeed) external {
        uint8 st = circle.status();
        if (st != circle.STATUS_COMPLETED() && st != circle.STATUS_CANCELLED()) return;

        address actor = actors[actorSeed % MAX_MEMBERS];
        (, , , , , bool isWithdrawn, bool exists) = circle.members(actor);
        if (!exists || isWithdrawn) return;

        uint256 balBefore = usdc.balanceOf(actor);
        (, uint256 lockedBefore, , , , , ) = circle.members(actor);

        vm.prank(actor);
        circle.withdrawCollateral();

        uint256 received = usdc.balanceOf(actor) - balBefore;
        if (received > lockedBefore) {
            withdrawnBonusTotal += (received - lockedBefore);
        }
        if (completedUnwithdrawnSlots > 0) {
            completedUnwithdrawnSlots -= 1;
        }
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }
}

contract AvaHuiInvariantTest is TestBase {
    MockUSDC internal usdc;
    AvaHuiYieldVault internal vault;
    AvaHuiFactory internal factory;
    AvaHuiCircle internal circle;
    AvaHuiInvariantHandler internal handler;

    address[] internal actors;
    address[] internal _targeted;

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new MockUSDC();
        vault = new AvaHuiYieldVault(address(usdc));
        factory = new AvaHuiFactory();
        factory.setDefaultModules(address(vault), address(0));

        actors = new address[](5);
        for (uint256 i = 0; i < 5; i++) {
            actors[i] = address(uint160(0xA100 + i));
        }

        vm.prank(actors[0]);
        address circleAddr = factory.createCircle(
            IAvaHuiFactory.CreateCircleParams({
                metadataId: "invariant_meta_1",
                name: "AvaHui Invariant Circle",
                token: address(usdc),
                allocationMode: 1, // BIDDING
                maxMembers: 5,
                contributionAmount: 100 * 1e6,
                collateralAmount: 200 * 1e6,
                roundDuration: 300,
                biddingDuration: 180,
                gracePeriod: 60,
                startDeadline: block.timestamp + 7 days,
                minBid: 2 * 1e6,
                maxBid: 100 * 1e6
            })
        );
        circle = AvaHuiCircle(circleAddr);

        handler = new AvaHuiInvariantHandler(usdc, vault, factory, circle, actors);
        _targeted.push(address(handler));
    }

    function targetContracts() public view returns (address[] memory) {
        return _targeted;
    }

    function invariant_PoolCoversRemainingObligations() public view {
        uint256 totalCollateralLocked = 0;
        for (uint256 i = 0; i < actors.length; i++) {
            (, uint256 locked, , , , bool isWithdrawn, bool exists) = circle.members(actors[i]);
            if (exists && !isWithdrawn) {
                totalCollateralLocked += locked;
            }
        }

        uint256 roundPendingContrib = 0;
        if (circle.status() == circle.STATUS_ACTIVE()) {
            uint8 roundNum = circle.currentRound();
            (, , , , , , , , uint8 contribCount) = circle.getRoundInfo(roundNum);
            roundPendingContrib = uint256(contribCount) * circle.contributionAmount();
        }

        uint256 totalBonusPool = circle.totalDiscountPool() + circle.totalYieldEarned();
        uint256 remainingBonus =
            totalBonusPool > handler.withdrawnBonusTotal()
                ? totalBonusPool - handler.withdrawnBonusTotal()
                : 0;

        uint256 poolHeld = usdc.balanceOf(address(circle)) + vault.principalOf(address(circle));
        uint256 minRequired =
            circle.status() == circle.STATUS_COMPLETED()
                ? totalCollateralLocked + remainingBonus
                : totalCollateralLocked + roundPendingContrib;

        assertTrue(
            poolHeld >= minRequired,
            "Invariant violated: poolHeld < remaining obligations"
        );
    }

    function invariant_RoundAndPayoutBounds() public view {
        uint8 maxM = circle.maxMembers();
        uint8 currM = circle.currentMemberCount();
        uint8 currR = circle.currentRound();

        assertTrue(currM <= maxM, "currentMemberCount > maxMembers");
        assertTrue(currR <= maxM, "currentRound > maxMembers");

        uint256 payouts = 0;
        for (uint256 i = 0; i < actors.length; i++) {
            (, , bool hasReceivedPayout, uint8 wonRound, , bool isWithdrawn, bool exists) =
                circle.members(actors[i]);
            if (hasReceivedPayout) {
                payouts += 1;
                assertTrue(exists, "Non-member cannot have payout");
                assertTrue(wonRound >= 1 && wonRound <= maxM, "Invalid wonRoundNumber");
            }
            if (isWithdrawn) {
                assertTrue(
                    circle.status() == circle.STATUS_COMPLETED() ||
                        circle.status() == circle.STATUS_CANCELLED(),
                    "Withdrawn before terminal state"
                );
            }
        }

        assertTrue(payouts <= maxM, "Total payouts exceed maxMembers");
        if (circle.status() == circle.STATUS_COMPLETED()) {
            assertEq(payouts, maxM, "Completed circle must pay every member once");
        }
    }
}

