// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {P256} from "@openzeppelin/contracts/utils/cryptography/P256.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// @title WebAuthnLib
/// @notice Memeriksa tanda tangan passkey (WebAuthn, kurva P-256), mis. sidik jari atau wajah di HP. Di Monad, P-256
///         diperiksa precompile 0x0100 (EIP-7951) sehingga murah; di jaringan tanpa precompile, OpenZeppelin memakai
///         perhitungan Solidity.
/// @dev Bagian yang diperiksa (WebAuthn Level 2, 7.2): `type` = "webauthn.get", `challenge` = data yang diharapkan
///      (base64url tanpa padding), flag User Present dan User Verified, lalu tanda tangan atas
///      sha256(authenticatorData || sha256(clientDataJSON)). Origin dan rpIdHash tidak diperiksa: kunci publiknya
///      sendiri sudah terikat pada satu situs saat passkey dibuat, dan hanya pemilik dompet yang bisa mendaftarkannya.
///      Tanda tangan dengan s tinggi ditolak (P256.verify); klien harus menormalkannya menjadi n - s.
library WebAuthnLib {
    struct Auth {
        bytes authenticatorData;
        string clientDataJSON;
        /// @dev Posisi `"challenge":"` di clientDataJSON.
        uint256 challengeIndex;
        /// @dev Posisi `"type":"webauthn.get"` di clientDataJSON.
        uint256 typeIndex;
        bytes32 r;
        bytes32 s;
    }

    bytes1 private constant FLAG_USER_PRESENT = 0x01;
    bytes1 private constant FLAG_USER_VERIFIED = 0x04;

    function verify(bytes memory challenge, Auth calldata auth, bytes32 qx, bytes32 qy) internal view returns (bool) {
        bytes calldata data = auth.authenticatorData;
        // 32 byte rpIdHash, 1 byte flag, 4 byte penghitung tanda tangan
        if (data.length < 37) return false;
        bytes1 flags = data[32];
        if (flags & FLAG_USER_PRESENT == 0 || flags & FLAG_USER_VERIFIED == 0) return false;

        bytes memory json = bytes(auth.clientDataJSON);
        if (!_ada(json, auth.typeIndex, bytes('"type":"webauthn.get"'))) return false;
        if (!_ada(json, auth.challengeIndex, abi.encodePacked('"challenge":"', Base64.encodeURL(challenge), '"'))) {
            return false;
        }
        bytes32 h = sha256(abi.encodePacked(data, sha256(json)));
        return P256.verify(h, auth.r, auth.s, qx, qy);
    }

    /// @dev `cari` ada persis di posisi `i` dalam `teks`.
    function _ada(bytes memory teks, uint256 i, bytes memory cari) private pure returns (bool) {
        if (i > teks.length || cari.length > teks.length - i) return false;
        for (uint256 k; k < cari.length; k++) {
            if (teks[i + k] != cari[k]) return false;
        }
        return true;
    }
}
