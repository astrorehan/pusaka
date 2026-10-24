// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {PusakaCore} from "./PusakaCore.sol";

/// @title PusakaVault
/// @notice Brankas warisan terpisah: pewaris menyetor tIDR ke sini. Dibuat oleh PusakaFactory sebagai klon murah
///         dari satu kontrak cetakan. Model cadangan jika dompet EIP-7702 (PusakaWallet) tidak bisa dipakai.
contract PusakaVault is PusakaCore {
    using SafeERC20 for IERC20;

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(uint256 amount);

    /// @dev Kontrak cetakan ini sendiri dikunci agar tidak bisa dipasang; hanya klonnya yang dipakai.
    constructor() {
        _l().status = Status.Distributed;
    }

    /// @notice Dipanggil factory tepat setelah membuat klon, di transaksi yang sama.
    function initialize(
        address owner_,
        address token,
        Heir[] calldata heirs,
        address[] calldata witnesses,
        Bequest[] calldata bequests,
        Config calldata cfg
    ) external {
        address[] memory tokens = new address[](1);
        tokens[0] = token;
        _init(owner_, tokens, heirs, witnesses, bequests, cfg);
    }

    /// @notice Setor tIDR. Siapa pun boleh menyetor selama brankas AKTIF (butuh approve lebih dulu).
    ///         Setoran dari pewaris sendiri dihitung sebagai bukti hidup.
    function deposit(uint256 amount) external inStatus(Status.Active) {
        if (msg.sender == _l().owner) _touch();
        emit Deposited(msg.sender, amount);
        IERC20(_l().tokens[0]).safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Penarikan oleh pewaris, sekaligus bukti hidup.
    function withdraw(uint256 amount) external onlyOwner inStatus(Status.Active) {
        _touch();
        emit Withdrawn(amount);
        IERC20(_l().tokens[0]).safeTransfer(msg.sender, amount);
    }

    function _kind() internal pure override returns (uint8) {
        return 1;
    }
}
