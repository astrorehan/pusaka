// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FaraidLib
/// @notice Menghitung bagian waris faraid (KHI) untuk ahli waris inti: suami/istri, anak, ayah, ibu.
///         Algoritma dan kasus uji: docs/faraid-spec.md. Bukan fatwa dan bukan nasihat hukum.
/// @dev Semua angka adalah pecahan eksak {num, den} yang selalu disederhanakan dengan FPB.
library FaraidLib {
    enum Relation {
        Husband,
        Wife,
        Son,
        Daughter,
        Father,
        Mother
    }

    struct Frac {
        uint256 num;
        uint256 den;
    }

    struct Family {
        bool deceasedMale; // jenis kelamin pewaris
        uint8 husband; // 0..1
        uint8 wives; // 0..4
        uint8 sons;
        uint8 daughters;
        bool father;
        bool mother;
        uint8 siblings; // saudara yang masih hidup (semua jenis)
        bool otherRelatives; // kerabat lain yang mungkin ikut mewarisi
    }

    /// @notice Bagian per orang untuk setiap peran. Peran yang tidak ada bernilai 0/1.
    struct Result {
        Frac husband;
        Frac wifeEach;
        Frac sonEach;
        Frac daughterEach;
        Frac father;
        Frac mother;
        uint8 flags;
    }

    // Bit pada Result.flags, dipakai UI untuk menjelaskan hasil.
    uint8 internal constant AUL = 1;
    uint8 internal constant RADD = 2;
    uint8 internal constant RADD_TO_SPOUSE = 4;
    uint8 internal constant GHARRAWAIN = 8;
    uint8 internal constant FATHER_ASABAH = 16;

    /// @dev 1 suami pada pewaris lk · 2 istri pada pewaris pr · 3 suami > 1 · 4 istri > 4
    error InvalidFamily(uint8 code);
    /// @dev 1 saudara ikut mewarisi · 2 hanya pasangan (jumhur) · 3 kerabat lain · 4 tanpa ahli waris inti
    error UnsupportedCase(uint8 code);

    /// @dev Bagian total per kelompok selama perhitungan (belum dibagi per orang).
    struct Shares {
        Frac spouse;
        Frac mother;
        Frac father;
        Frac daughters; // bagian pasti anak perempuan (hanya jika tidak ada anak laki-laki)
        Frac rest; // sisa setelah bagian pasti
    }

    // ------------------------------------------------------------------
    // Perhitungan utama
    // ------------------------------------------------------------------

    /// @param raddToSpouse false = jumhur (default), true = KHI harfiah. Lihat spec bagian 6.
    function compute(Family memory f, bool raddToSpouse) internal pure returns (Result memory r) {
        // Langkah 1: validasi
        _validate(f);

        // Langkah 2–3: bagian pasti (furud)
        Shares memory s;
        r.flags = _fixedShares(f, s);

        // Langkah 4–5: jumlahkan; jika lebih dari 1, terapkan 'aul
        Frac memory total = add(add(s.spouse, s.mother), add(s.father, s.daughters));
        if (gt(total, one())) {
            s.spouse = div(s.spouse, total);
            s.mother = div(s.mother, total);
            s.father = div(s.father, total);
            s.daughters = div(s.daughters, total);
            s.rest = zero();
            r.flags |= AUL;
        } else {
            s.rest = sub(one(), total);
        }

        // Langkah 6: bagikan sisa
        if (s.rest.num > 0) {
            if (f.sons > 0) {
                // 6a. Anak laki-laki dan perempuan berbagi sisa, 2 : 1
                Frac memory unit = div(s.rest, frac(2 * uint256(f.sons) + f.daughters, 1));
                r.sonEach = mul(unit, frac(2, 1));
                r.daughterEach = f.daughters > 0 ? unit : zero();
            } else if (f.father) {
                // 6b. Tidak ada anak laki-laki: ayah menerima sisa ('ashabah)
                s.father = add(s.father, s.rest);
                r.flags |= FATHER_ASABAH;
            } else if (f.siblings > 0) {
                // 6c. Saudara ikut mewarisi; di luar cakupan MVP
                revert UnsupportedCase(1);
            } else {
                // 6d. Radd
                r.flags |= _radd(s, raddToSpouse);
            }
        }

        // Langkah 7: bagian per orang
        r.husband = f.husband > 0 ? s.spouse : zero();
        r.wifeEach = f.wives > 0 ? div(s.spouse, frac(f.wives, 1)) : zero();
        if (f.sons == 0) {
            r.sonEach = zero();
            r.daughterEach = f.daughters > 0 ? div(s.daughters, frac(f.daughters, 1)) : zero();
        }
        r.father = s.father;
        r.mother = s.mother;
    }

    function _validate(Family memory f) private pure {
        if (f.deceasedMale && f.husband > 0) revert InvalidFamily(1);
        if (!f.deceasedMale && f.wives > 0) revert InvalidFamily(2);
        if (f.husband > 1) revert InvalidFamily(3);
        if (f.wives > 4) revert InvalidFamily(4);
        if (f.otherRelatives) revert UnsupportedCase(3);
        if (f.husband == 0 && f.wives == 0 && f.sons == 0 && f.daughters == 0 && !f.father && !f.mother) {
            revert UnsupportedCase(4);
        }
    }

    /// @dev Mengisi bagian pasti ke `s`. Mengembalikan flag GHARRAWAIN bila berlaku.
    function _fixedShares(Family memory f, Shares memory s) private pure returns (uint8 flags) {
        bool hasChild = f.sons > 0 || f.daughters > 0;
        bool hasSpouse = f.husband > 0 || f.wives > 0;

        // Suami 1/2 atau 1/4 (Pasal 179); istri 1/4 atau 1/8, dibagi rata (Pasal 180)
        if (f.husband > 0) s.spouse = hasChild ? frac(1, 4) : frac(1, 2);
        else if (f.wives > 0) s.spouse = hasChild ? frac(1, 8) : frac(1, 4);
        else s.spouse = zero();

        // Ibu (Pasal 178)
        if (!f.mother) {
            s.mother = zero();
        } else if (hasChild || f.siblings >= 2) {
            s.mother = frac(1, 6);
        } else if (f.father && hasSpouse) {
            // Gharrawain: 1/3 dari sisa setelah bagian suami/istri
            s.mother = mul(sub(one(), s.spouse), frac(1, 3));
            flags = GHARRAWAIN;
        } else {
            s.mother = frac(1, 3);
        }

        // Ayah: 1/6 jika ada anak; sisanya (jika ada) diberikan di langkah 6b
        s.father = f.father && hasChild ? frac(1, 6) : zero();

        // Anak perempuan tanpa anak laki-laki (Pasal 176)
        if (f.sons > 0 || f.daughters == 0) s.daughters = zero();
        else if (f.daughters == 1) s.daughters = frac(1, 2);
        else s.daughters = frac(2, 3);
    }

    /// @dev Sisa dikembalikan ke penerima radd sebanding dengan bagiannya:
    ///      bagian baru = bagian × (pool + sisa) ÷ pool.
    function _radd(Shares memory s, bool raddToSpouse) private pure returns (uint8 flags) {
        bool spouseIn = raddToSpouse && s.spouse.num > 0;
        Frac memory pool = add(add(s.mother, s.father), s.daughters);
        if (spouseIn) pool = add(pool, s.spouse);
        if (pool.num == 0) revert UnsupportedCase(2); // hanya pasangan, mode jumhur

        Frac memory factor = div(add(pool, s.rest), pool);
        s.mother = mul(s.mother, factor);
        s.father = mul(s.father, factor);
        s.daughters = mul(s.daughters, factor);
        flags = RADD;
        if (spouseIn) {
            s.spouse = mul(s.spouse, factor);
            flags |= RADD_TO_SPOUSE;
        }
        s.rest = zero();
    }

    // ------------------------------------------------------------------
    // Aritmetika pecahan
    // ------------------------------------------------------------------

    function frac(uint256 num, uint256 den) internal pure returns (Frac memory) {
        if (num == 0) return Frac(0, 1);
        uint256 g = gcd(num, den);
        return Frac(num / g, den / g);
    }

    function zero() internal pure returns (Frac memory) {
        return Frac(0, 1);
    }

    function one() internal pure returns (Frac memory) {
        return Frac(1, 1);
    }

    function add(Frac memory a, Frac memory b) internal pure returns (Frac memory) {
        return frac(a.num * b.den + b.num * a.den, a.den * b.den);
    }

    /// @dev Mengasumsikan a >= b; jika tidak, transaksi gagal karena underflow.
    function sub(Frac memory a, Frac memory b) internal pure returns (Frac memory) {
        return frac(a.num * b.den - b.num * a.den, a.den * b.den);
    }

    function mul(Frac memory a, Frac memory b) internal pure returns (Frac memory) {
        return frac(a.num * b.num, a.den * b.den);
    }

    function div(Frac memory a, Frac memory b) internal pure returns (Frac memory) {
        return frac(a.num * b.den, a.den * b.num);
    }

    function gt(Frac memory a, Frac memory b) internal pure returns (bool) {
        return a.num * b.den > b.num * a.den;
    }

    function gcd(uint256 a, uint256 b) internal pure returns (uint256) {
        while (b != 0) (a, b) = (b, a % b);
        return a;
    }
}
