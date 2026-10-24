// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {PusakaCore} from "./PusakaCore.sol";

/// @title PusakaWallet
/// @notice Aturan warisan yang dipasang langsung di dompet pewaris lewat EIP-7702. Aset tetap di dompet itu dan
///         pewaris tetap memakainya seperti biasa. Setelah wafat dikonfirmasi saksi dan masa sanggah habis, token
///         dibagikan langsung dari dompet pewaris.
/// @dev Satu kontrak ini dipakai bersama oleh semua dompet yang mendelegasikan kepadanya. Saat berjalan,
///      address(this) adalah alamat dompet pewaris, dan datanya tersimpan di dompet itu (lihat PusakaCore).
///      Fungsi pewaris dipanggil dengan transaksi dari dompet itu ke alamatnya sendiri (msg.sender == address(this)).
///
///      Catatan Monad: dompet yang memakai delegasi EIP-7702 tidak bisa mengirim MON sampai saldonya di bawah 10 MON.
///      Kontrak ini hanya membagikan token ERC-20, jadi aturan itu tidak memengaruhi pembagian.
contract PusakaWallet is PusakaCore, ERC721Holder, ERC1155Holder {
    bytes4 private constant ERC1271_MAGIC = 0x1626ba7e;

    struct Call {
        address to;
        uint256 value;
        bytes data;
    }

    error NotSelf();
    error CallFailed(uint256 index, bytes reason);

    /// @notice Transaksi biasa dari dompet pewaris (transfer, bayar, swap), satu atau beberapa sekaligus. Setiap
    ///         pemakaian dompet lewat fungsi ini otomatis dihitung sebagai bukti hidup, jadi pewaris tidak perlu
    ///         menekan "Saya masih hidup". Selama masa sanggah, aktivitas ini juga membatalkan pemicu.
    /// @dev Hanya dari dompet itu sendiri (transaksi pewaris ke alamatnya sendiri). Panggilan ke alamat sendiri juga
    ///      boleh, mis. memasang aturan (setup) sekaligus mendaftarkan rekening bank ahli waris dalam satu transaksi.
    function execute(Call[] calldata calls) external payable returns (bytes[] memory results) {
        if (msg.sender != address(this)) revert NotSelf();
        _touch();
        results = new bytes[](calls.length);
        for (uint256 i; i < calls.length; i++) {
            // Hanya pemilik dompet yang bisa sampai di sini, dan tujuan bebas memang inti sebuah dompet.
            // forge-lint: disable-next-line(arbitrary-send-eth)
            (bool ok, bytes memory ret) = calls[i].to.call{value: calls[i].value}(calls[i].data);
            if (!ok) revert CallFailed(i, ret);
            results[i] = ret;
        }
    }

    /// @notice Pasang aturan warisan. Dikirim dari dompet pewaris ke alamatnya sendiri, bersama otorisasi EIP-7702,
    ///         dalam satu transaksi sehingga tidak ada celah bagi orang lain untuk memasang lebih dulu.
    /// @param tokens Token yang akan dibagikan (maks. 5), mis. [tIDR].
    function setup(
        address[] calldata tokens,
        Heir[] calldata heirs,
        address[] calldata witnesses,
        Bequest[] calldata bequests,
        Config calldata cfg
    ) external {
        if (msg.sender != address(this)) revert NotSelf();
        _init(address(this), tokens, heirs, witnesses, bequests, cfg);
    }

    /// @notice Hapus aturan warisan, mis. untuk mengganti ahli waris lalu memasang ulang. Hanya saat AKTIF.
    function cancelSetup() external onlyOwner inStatus(Status.Active) {
        _clear();
    }

    /// @notice Dompet tetap bisa menerima MON.
    receive() external payable {}

    /// @notice ERC-1271: aplikasi yang memeriksa tanda tangan lewat kontrak tetap menerima tanda tangan pemilik dompet.
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(hash, signature);
        return err == ECDSA.RecoverError.NoError && signer == address(this) ? ERC1271_MAGIC : bytes4(0xffffffff);
    }

    function _kind() internal pure override returns (uint8) {
        return 2;
    }
}
