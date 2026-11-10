// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "../test/TestBase.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {AvaHuiYieldVault} from "../src/mocks/AvaHuiYieldVault.sol";
import {Team1AttestationVerifier} from "../src/verifiers/Team1AttestationVerifier.sol";
import {AvaHuiFactory} from "../src/AvaHuiFactory.sol";

contract DeployFujiScript {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run()
        external
        returns (
            address usdcAddress,
            address factoryAddress,
            address yieldVaultAddress,
            address sybilVerifierAddress
        )
    {
        uint256 deployerPrivateKey = vm.envOr(
            "DEPLOYER_PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );

        vm.startBroadcast(deployerPrivateKey);
        MockUSDC usdc = new MockUSDC();
        AvaHuiYieldVault yieldVault = new AvaHuiYieldVault(address(usdc));
        Team1AttestationVerifier sybilVerifier = new Team1AttestationVerifier(msg.sender);
        AvaHuiFactory factory = new AvaHuiFactory();
        factory.setDefaultModules(address(yieldVault), address(sybilVerifier));
        vm.stopBroadcast();

        return (
            address(usdc),
            address(factory),
            address(yieldVault),
            address(sybilVerifier)
        );
    }
}
