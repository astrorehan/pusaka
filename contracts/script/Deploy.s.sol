// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockIDR} from "../src/MockIDR.sol";
import {PusakaVault} from "../src/PusakaVault.sol";
import {PusakaWallet} from "../src/PusakaWallet.sol";
import {PusakaFactory} from "../src/PusakaFactory.sol";
import {MitraCair} from "../src/MitraCair.sol";

/// @notice Deploy MockIDR, cetakan PusakaVault, PusakaFactory, PusakaWallet, dan MitraCair (simulasi mitra pencairan).
///         Pemilik MitraCair adalah akun yang men-deploy (dompet induk demo); ia bisa menambah operator.
///         BRANKAS=false melewati PusakaVault + PusakaFactory (model brankas cadangan, tidak dipakai web demo) dan
///         menghemat ±43% gas deploy.
///         Simulasi saja:    forge script script/Deploy.s.sol
///         Ke Monad testnet: forge script script/Deploy.s.sol --rpc-url monad_testnet --account <nama> --broadcast \n///                           --code-size-limit 131072   (PusakaWallet ±28 KB; Monad mengizinkan 128 KB)
contract Deploy is Script {
    function run() external returns (MockIDR token, PusakaFactory factory, PusakaWallet wallet, MitraCair mitra) {
        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();
        token = new MockIDR();
        if (vm.envOr("BRANKAS", true)) {
            PusakaVault vaultImplementation = new PusakaVault();
            factory = new PusakaFactory(token, address(vaultImplementation));
        }
        wallet = new PusakaWallet();
        mitra = new MitraCair(token, deployer);
        vm.stopBroadcast();

        console2.log("VITE_TOKEN=%s", address(token));
        console2.log("VITE_FACTORY=%s", address(factory));
        console2.log("VITE_WALLET=%s", address(wallet));
        console2.log("VITE_MITRA=%s", address(mitra));
    }
}
