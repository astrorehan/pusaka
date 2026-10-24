// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {FaraidLib} from "./FaraidLib.sol";

/// @title EstateLib
/// @notice Urutan pembagian harta menurut KHI:
///         1. separuh harta bersama untuk pasangan yang masih hidup (Pasal 96),
///         2. wasiat untuk bukan ahli waris, paling banyak 1/3 harta warisan (Pasal 195),
///         3. sisanya dibagi faraid (FaraidLib).
///         Utang dan biaya jenazah belum didukung.
library EstateLib {
    uint256 internal constant MAX_BEQUESTS = 3;

    /// @dev 1 pecahan harta bersama tidak valid · 2 ada harta bersama tetapi pasangan bukan tepat satu orang
    ///      3 wasiat lebih dari 3 atau ada bagian 0 · 4 total wasiat lebih dari 1/3
    error InvalidEstate(uint8 code);

    struct Plan {
        uint256 jointAmount; // ke pasangan, dari harta bersama
        uint256[] bequestAmounts; // wasiat, sesuai urutan
        uint256 faraidPool; // harta yang dibagi faraid
        uint256[] heirAmounts; // bagian faraid per ahli waris; sisa pembulatan ke indeks 0
    }

    /// @param joint Bagian saldo yang merupakan harta bersama (0/1 = tidak ada, 1/1 = seluruhnya).
    /// @param bequests Bagian tiap wasiat, dihitung dari harta warisan (setelah harta bersama dipisah).
    function validate(FaraidLib.Frac memory joint, FaraidLib.Frac[] memory bequests, FaraidLib.Family memory f)
        internal
        pure
    {
        if (joint.den == 0 || joint.num > joint.den) revert InvalidEstate(1);
        // Dengan lebih dari satu istri, harta bersama tiap perkawinan terpisah (KHI Pasal 94); belum didukung.
        if (joint.num > 0 && uint256(f.husband) + f.wives != 1) revert InvalidEstate(2);

        if (bequests.length > MAX_BEQUESTS) revert InvalidEstate(3);
        FaraidLib.Frac memory total = FaraidLib.zero();
        for (uint256 i; i < bequests.length; i++) {
            if (bequests[i].num == 0 || bequests[i].den == 0) revert InvalidEstate(3);
            total = FaraidLib.add(total, bequests[i]);
        }
        if (FaraidLib.gt(total, FaraidLib.frac(1, 3))) revert InvalidEstate(4);
    }

    /// @notice Jumlah token untuk setiap penerima. Total semuanya selalu sama dengan `balance`.
    /// @param heirShares Bagian faraid tiap ahli waris (per orang); jumlahnya harus 1.
    function plan(
        uint256 balance,
        FaraidLib.Frac memory joint,
        FaraidLib.Frac[] memory bequests,
        FaraidLib.Frac[] memory heirShares
    ) internal pure returns (Plan memory p) {
        p.jointAmount = Math.mulDiv(balance, joint.num, joint.den * 2);
        uint256 estate = balance - p.jointAmount; // harta warisan (tirkah)

        p.faraidPool = estate;
        p.bequestAmounts = new uint256[](bequests.length);
        for (uint256 i; i < bequests.length; i++) {
            p.bequestAmounts[i] = Math.mulDiv(estate, bequests[i].num, bequests[i].den);
            p.faraidPool -= p.bequestAmounts[i];
        }

        p.heirAmounts = new uint256[](heirShares.length);
        uint256 sent;
        for (uint256 i; i < heirShares.length; i++) {
            p.heirAmounts[i] = Math.mulDiv(p.faraidPool, heirShares[i].num, heirShares[i].den);
            sent += p.heirAmounts[i];
        }
        if (heirShares.length > 0) p.heirAmounts[0] += p.faraidPool - sent;
    }
}
