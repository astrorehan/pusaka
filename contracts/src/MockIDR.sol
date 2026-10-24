// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title MockIDR
/// @notice Token "Testnet Rupiah" (tIDR), 18 desimal. Khusus testnet: siapa pun boleh mencetak.
///         Seperti stablecoin rupiah sungguhan, token ini bisa dibakar saat ditukar kembali ke rupiah (lihat MitraCair),
///         dan mendukung izin bertanda tangan (EIP-2612): ahli waris cukup menandatangani, tanpa transaksi approve.
contract MockIDR is ERC20, ERC20Burnable, ERC20Permit {
    uint256 public constant FAUCET_LIMIT = 1_000_000_000 ether; // Rp1 miliar per panggilan

    error FaucetLimit(uint256 max);

    constructor() ERC20("Testnet Rupiah", "tIDR") ERC20Permit("Testnet Rupiah") {}

    function faucet(address to, uint256 amount) external {
        if (amount > FAUCET_LIMIT) revert FaucetLimit(FAUCET_LIMIT);
        _mint(to, amount);
    }
}
