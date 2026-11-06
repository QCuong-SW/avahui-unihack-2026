// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "../test/TestBase.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {AvaHuiFactory} from "../src/AvaHuiFactory.sol";
import {AvaHuiCircle} from "../src/AvaHuiCircle.sol";
import {IAvaHuiFactory} from "../src/interfaces/IAvaHuiFactory.sol";

contract SimulateLifecycleScript {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run(address usdcAddr, address factoryAddr) external returns (address circleAddr) {
        uint256 deployerKey = vm.envOr(
            "DEPLOYER_PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );

        vm.startBroadcast(deployerKey);

        MockUSDC usdc = MockUSDC(usdcAddr);
        AvaHuiFactory factory = AvaHuiFactory(factoryAddr);

        IAvaHuiFactory.CreateCircleParams memory params = IAvaHuiFactory.CreateCircleParams({
            metadataId: "meta_demo_fuji_01",
            name: "Hui Dau Tu Avalanche Builders",
            token: address(usdc),
            allocationMode: 1,
            maxMembers: 5,
            contributionAmount: 100 * 1e6,
            collateralAmount: 100 * 1e6,
            roundDuration: 300,
            biddingDuration: 180,
            gracePeriod: 60,
            startDeadline: block.timestamp + 86400,
            minBid: 2 * 1e6,
            maxBid: 40 * 1e6
        });

        circleAddr = factory.createCircle(params);
        AvaHuiCircle circle = AvaHuiCircle(circleAddr);

        usdc.faucet(1000 * 1e6);
        usdc.approve(circleAddr, type(uint256).max);
        circle.joinCircle();

        vm.stopBroadcast();
    }
}

