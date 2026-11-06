// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "../test/TestBase.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {AvaHuiFactory} from "../src/AvaHuiFactory.sol";

contract DeployFujiScript {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (address usdcAddress, address factoryAddress) {
        uint256 deployerPrivateKey = vm.envOr(
            "DEPLOYER_PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );

        vm.startBroadcast(deployerPrivateKey);
        MockUSDC usdc = new MockUSDC();
        AvaHuiFactory factory = new AvaHuiFactory();
        vm.stopBroadcast();

        return (address(usdc), address(factory));
    }
}

