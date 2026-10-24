// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {FaraidLib} from "../src/FaraidLib.sol";

/// @dev Fungsi library `internal` disalin ke kontrak pemanggil, sehingga revert-nya tidak bisa ditangkap
///      `vm.expectRevert`. Kontrak pembungkus ini membuatnya menjadi panggilan eksternal.
contract FaraidHarness {
    function compute(FaraidLib.Family memory f, bool raddToSpouse) external pure returns (FaraidLib.Result memory) {
        return FaraidLib.compute(f, raddToSpouse);
    }
}

/// @notice Kasus uji dari docs/faraid-spec.md bagian 8.
contract FaraidLibTest is Test {
    bool constant JUMHUR = false;
    bool constant KHI = true; // KHI harfiah: radd juga ke suami/istri

    uint8 constant AUL = 1;
    uint8 constant RADD = 2;
    uint8 constant RADD_TO_SPOUSE = 4;
    uint8 constant GHARRAWAIN = 8;
    uint8 constant FATHER_ASABAH = 16;

    FaraidHarness h;

    function setUp() public {
        h = new FaraidHarness();
    }

    // ------------------------------------------------------------------
    // 8.1 Kasus yang harus berhasil
    // ------------------------------------------------------------------

    function test_K01_demo() public view {
        FaraidLib.Family memory f = _man();
        f.wives = 1;
        f.sons = 2;
        f.daughters = 1;
        f.father = true;
        f.mother = true;
        _expect(f, h.compute(f, JUMHUR), Z(), F(1, 8), F(13, 60), F(13, 120), F(1, 6), F(1, 6), 0);
    }

    function test_K01_rupiah() public view {
        FaraidLib.Family memory f = _man();
        f.wives = 1;
        f.sons = 2;
        f.daughters = 1;
        f.father = true;
        f.mother = true;
        FaraidLib.Result memory r = h.compute(f, JUMHUR);

        uint256 harta = 120_000_000 ether; // Rp120 jt dalam tIDR (18 desimal)
        assertEq(_amount(harta, r.wifeEach), 15_000_000 ether, "istri");
        assertEq(_amount(harta, r.sonEach), 26_000_000 ether, "anak lk");
        assertEq(_amount(harta, r.daughterEach), 13_000_000 ether, "anak pr");
        assertEq(_amount(harta, r.father), 20_000_000 ether, "ayah");
        assertEq(_amount(harta, r.mother), 20_000_000 ether, "ibu");
    }

    function test_K02_sonAndDaughters() public view {
        FaraidLib.Family memory f = _man();
        f.sons = 1;
        f.daughters = 2;
        _expect(f, h.compute(f, JUMHUR), Z(), Z(), F(1, 2), F(1, 4), Z(), Z(), 0);
    }

    function test_K03_fatherFixedPlusRest() public view {
        FaraidLib.Family memory f = _man();
        f.daughters = 1;
        f.father = true;
        f.mother = true;
        _expect(f, h.compute(f, JUMHUR), Z(), Z(), Z(), F(1, 2), F(1, 3), F(1, 6), FATHER_ASABAH);
    }

    function test_K04_aul12to15() public view {
        FaraidLib.Family memory f = _woman();
        f.husband = 1;
        f.daughters = 2;
        f.father = true;
        f.mother = true;
        _expect(f, h.compute(f, JUMHUR), F(1, 5), Z(), Z(), F(4, 15), F(2, 15), F(2, 15), AUL);
    }

    function test_K05_aul24to27_minbariyyah() public view {
        FaraidLib.Family memory f = _man();
        f.wives = 1;
        f.daughters = 2;
        f.father = true;
        f.mother = true;
        _expect(f, h.compute(f, JUMHUR), Z(), F(1, 9), Z(), F(8, 27), F(4, 27), F(4, 27), AUL);
    }

    function test_K06_radd() public view {
        FaraidLib.Family memory f = _man();
        f.daughters = 1;
        f.mother = true;
        _expect(f, h.compute(f, JUMHUR), Z(), Z(), Z(), F(3, 4), Z(), F(1, 4), RADD);
    }

    function test_K07a_raddJumhur() public view {
        FaraidLib.Family memory f = _man();
        f.wives = 1;
        f.daughters = 1;
        f.mother = true;
        _expect(f, h.compute(f, JUMHUR), Z(), F(1, 8), Z(), F(21, 32), Z(), F(7, 32), RADD);
    }

    function test_K07b_raddKhi() public view {
        FaraidLib.Family memory f = _man();
        f.wives = 1;
        f.daughters = 1;
        f.mother = true;
        _expect(f, h.compute(f, KHI), Z(), F(3, 19), Z(), F(12, 19), Z(), F(4, 19), RADD | RADD_TO_SPOUSE);
    }

    function test_K08_gharrawainHusband() public view {
        FaraidLib.Family memory f = _woman();
        f.husband = 1;
        f.father = true;
        f.mother = true;
        _expect(f, h.compute(f, JUMHUR), F(1, 2), Z(), Z(), Z(), F(1, 3), F(1, 6), GHARRAWAIN | FATHER_ASABAH);
    }

    function test_K09_gharrawainWife() public view {
        FaraidLib.Family memory f = _man();
        f.wives = 1;
        f.father = true;
        f.mother = true;
        _expect(f, h.compute(f, JUMHUR), Z(), F(1, 4), Z(), Z(), F(1, 2), F(1, 4), GHARRAWAIN | FATHER_ASABAH);
    }

    function test_K10_siblingsReduceMother() public view {
        FaraidLib.Family memory f = _man();
        f.father = true;
        f.mother = true;
        f.siblings = 2;
        _expect(f, h.compute(f, JUMHUR), Z(), Z(), Z(), Z(), F(5, 6), F(1, 6), FATHER_ASABAH);
    }

    function test_K11_fatherAsabah() public view {
        FaraidLib.Family memory f = _man();
        f.father = true;
        f.mother = true;
        _expect(f, h.compute(f, JUMHUR), Z(), Z(), Z(), Z(), F(2, 3), F(1, 3), FATHER_ASABAH);
    }

    function test_K12a_raddMotherOnly() public view {
        FaraidLib.Family memory f = _woman();
        f.husband = 1;
        f.mother = true;
        _expect(f, h.compute(f, JUMHUR), F(1, 2), Z(), Z(), Z(), Z(), F(1, 2), RADD);
    }

    function test_K12b_raddIncludingHusband() public view {
        FaraidLib.Family memory f = _woman();
        f.husband = 1;
        f.mother = true;
        _expect(f, h.compute(f, KHI), F(3, 5), Z(), Z(), Z(), Z(), F(2, 5), RADD | RADD_TO_SPOUSE);
    }

    function test_K13_twoWivesShare() public view {
        FaraidLib.Family memory f = _man();
        f.wives = 2;
        f.sons = 1;
        _expect(f, h.compute(f, JUMHUR), Z(), F(1, 16), F(7, 8), Z(), Z(), Z(), 0);
    }

    function test_K14_motherOnly() public view {
        FaraidLib.Family memory f = _man();
        f.mother = true;
        _expect(f, h.compute(f, JUMHUR), Z(), Z(), Z(), Z(), Z(), F(1, 1), RADD);
    }

    function test_K15_twoDaughters() public view {
        FaraidLib.Family memory f = _man();
        f.daughters = 2;
        _expect(f, h.compute(f, JUMHUR), Z(), Z(), Z(), F(1, 2), Z(), Z(), RADD);
    }

    function test_K16_wifeOnlyKhi() public view {
        FaraidLib.Family memory f = _man();
        f.wives = 1;
        _expect(f, h.compute(f, KHI), Z(), F(1, 1), Z(), Z(), Z(), Z(), RADD | RADD_TO_SPOUSE);
    }

    // ------------------------------------------------------------------
    // 8.2 Kasus yang harus ditolak
    // ------------------------------------------------------------------

    function test_X1_wifeOnlyJumhur() public {
        FaraidLib.Family memory f = _man();
        f.wives = 1;
        vm.expectRevert(abi.encodeWithSelector(FaraidLib.UnsupportedCase.selector, uint8(2)));
        h.compute(f, JUMHUR);
    }

    function test_X2_siblingInherits() public {
        FaraidLib.Family memory f = _man();
        f.wives = 1;
        f.siblings = 1;
        vm.expectRevert(abi.encodeWithSelector(FaraidLib.UnsupportedCase.selector, uint8(1)));
        h.compute(f, JUMHUR);
    }

    function test_X3_husbandOfMaleDeceased() public {
        FaraidLib.Family memory f = _man();
        f.husband = 1;
        f.sons = 1;
        vm.expectRevert(abi.encodeWithSelector(FaraidLib.InvalidFamily.selector, uint8(1)));
        h.compute(f, JUMHUR);
    }

    function test_X4_fiveWives() public {
        FaraidLib.Family memory f = _man();
        f.wives = 5;
        f.sons = 1;
        vm.expectRevert(abi.encodeWithSelector(FaraidLib.InvalidFamily.selector, uint8(4)));
        h.compute(f, JUMHUR);
    }

    function test_X5_otherRelatives() public {
        FaraidLib.Family memory f = _man();
        f.wives = 1;
        f.sons = 1;
        f.otherRelatives = true;
        vm.expectRevert(abi.encodeWithSelector(FaraidLib.UnsupportedCase.selector, uint8(3)));
        h.compute(f, JUMHUR);
    }

    function test_X6_onlySiblings() public {
        FaraidLib.Family memory f = _man();
        f.siblings = 2;
        vm.expectRevert(abi.encodeWithSelector(FaraidLib.UnsupportedCase.selector, uint8(4)));
        h.compute(f, JUMHUR);
    }

    // Dua kode validasi yang tidak punya kasus X sendiri di spec.
    function test_invalid_wifeOfFemaleDeceased() public {
        FaraidLib.Family memory f = _woman();
        f.wives = 1;
        vm.expectRevert(abi.encodeWithSelector(FaraidLib.InvalidFamily.selector, uint8(2)));
        h.compute(f, JUMHUR);
    }

    function test_invalid_twoHusbands() public {
        FaraidLib.Family memory f = _woman();
        f.husband = 2;
        vm.expectRevert(abi.encodeWithSelector(FaraidLib.InvalidFamily.selector, uint8(3)));
        h.compute(f, JUMHUR);
    }

    // ------------------------------------------------------------------
    // Invarian: total selalu tepat 1, anak lk = 2 × anak pr
    // ------------------------------------------------------------------

    /// @notice Mencoba semua komposisi keluarga dalam rentang kecil (2.688 kombinasi).
    function test_invariant_exhaustive() public view {
        uint256 ok;
        uint256 rejected;
        for (uint8 male = 0; male < 2; male++) {
            uint8 maxSpouse = male == 1 ? 4 : 1;
            for (uint8 spouse = 0; spouse <= maxSpouse; spouse++) {
                for (uint8 sons = 0; sons <= 3; sons++) {
                    for (uint8 daughters = 0; daughters <= 3; daughters++) {
                        for (uint8 parents = 0; parents < 4; parents++) {
                            for (uint8 siblings = 0; siblings <= 2; siblings++) {
                                for (uint8 mode = 0; mode < 2; mode++) {
                                    FaraidLib.Family memory f = FaraidLib.Family({
                                        deceasedMale: male == 1,
                                        husband: male == 1 ? 0 : spouse,
                                        wives: male == 1 ? spouse : 0,
                                        sons: sons,
                                        daughters: daughters,
                                        father: parents & 1 != 0,
                                        mother: parents & 2 != 0,
                                        siblings: siblings,
                                        otherRelatives: false
                                    });
                                    if (_checkInvariant(f, mode == 1)) ok++;
                                    else rejected++;
                                }
                            }
                        }
                    }
                }
            }
        }
        console2.log("berhasil dihitung:", ok);
        console2.log("ditolak (di luar cakupan):", rejected);
        assertEq(ok + rejected, 2688);
    }

    /// @notice Komposisi acak dengan anak sampai 255 orang.
    function testFuzz_invariant(
        bool male,
        uint8 spouse,
        uint8 sons,
        uint8 daughters,
        bool father,
        bool mother,
        uint8 siblings,
        bool raddToSpouse
    ) public view {
        FaraidLib.Family memory f = FaraidLib.Family({
            deceasedMale: male,
            husband: male ? 0 : spouse % 2,
            wives: male ? spouse % 5 : 0,
            sons: sons,
            daughters: daughters,
            father: father,
            mother: mother,
            siblings: siblings,
            otherRelatives: false
        });
        _checkInvariant(f, raddToSpouse);
    }

    /// @dev Mengembalikan true jika berhasil dihitung, false jika ditolak dengan alasan yang sah.
    function _checkInvariant(FaraidLib.Family memory f, bool raddToSpouse) internal view returns (bool) {
        try h.compute(f, raddToSpouse) returns (FaraidLib.Result memory r) {
            assertTrue(_isOne(_total(f, r)), "total harus 1");
            // Peran yang tidak ada orangnya harus 0, agar UI tidak menampilkan bagian palsu.
            if (f.husband == 0) assertEq(r.husband.num, 0, "suami kosong");
            if (f.wives == 0) assertEq(r.wifeEach.num, 0, "istri kosong");
            if (f.sons == 0) assertEq(r.sonEach.num, 0, "anak lk kosong");
            if (f.daughters == 0) assertEq(r.daughterEach.num, 0, "anak pr kosong");
            if (!f.father) assertEq(r.father.num, 0, "ayah kosong");
            if (!f.mother) assertEq(r.mother.num, 0, "ibu kosong");
            if (f.sons > 0 && f.daughters > 0) {
                assertTrue(_eq(r.sonEach, FaraidLib.mul(r.daughterEach, F(2, 1))), "anak lk = 2 x anak pr");
            }
            return true;
        } catch (bytes memory err) {
            // Keluarga yang valid hanya boleh ditolak sebagai UnsupportedCase(1), (2), atau (4).
            assertEq(bytes4(err), FaraidLib.UnsupportedCase.selector, "jenis error");
            uint8 code = uint8(err[35]);
            assertTrue(code == 1 || code == 2 || code == 4, "kode error");
            return false;
        }
    }

    // ------------------------------------------------------------------
    // Pembantu
    // ------------------------------------------------------------------

    function _man() internal pure returns (FaraidLib.Family memory f) {
        f.deceasedMale = true;
    }

    function _woman() internal pure returns (FaraidLib.Family memory f) {}

    function F(uint256 num, uint256 den) internal pure returns (FaraidLib.Frac memory) {
        return FaraidLib.frac(num, den);
    }

    function Z() internal pure returns (FaraidLib.Frac memory) {
        return FaraidLib.zero();
    }

    /// @dev Bagian per orang harus sama persis (sudah dalam bentuk paling sederhana), flag harus sama,
    ///      dan total semua ahli waris harus 1.
    function _expect(
        FaraidLib.Family memory f,
        FaraidLib.Result memory r,
        FaraidLib.Frac memory husband,
        FaraidLib.Frac memory wifeEach,
        FaraidLib.Frac memory sonEach,
        FaraidLib.Frac memory daughterEach,
        FaraidLib.Frac memory father,
        FaraidLib.Frac memory mother,
        uint8 flags
    ) internal pure {
        _assertFrac(r.husband, husband, "suami");
        _assertFrac(r.wifeEach, wifeEach, "istri");
        _assertFrac(r.sonEach, sonEach, "anak lk");
        _assertFrac(r.daughterEach, daughterEach, "anak pr");
        _assertFrac(r.father, father, "ayah");
        _assertFrac(r.mother, mother, "ibu");
        assertEq(r.flags, flags, "flags");
        assertTrue(_isOne(_total(f, r)), "total harus 1");
    }

    function _assertFrac(FaraidLib.Frac memory got, FaraidLib.Frac memory want, string memory label) internal pure {
        assertEq(got.num, want.num, string.concat(label, " (pembilang)"));
        assertEq(got.den, want.den, string.concat(label, " (penyebut)"));
    }

    function _total(FaraidLib.Family memory f, FaraidLib.Result memory r)
        internal
        pure
        returns (FaraidLib.Frac memory t)
    {
        t = r.husband;
        t = FaraidLib.add(t, FaraidLib.mul(r.wifeEach, F(f.wives, 1)));
        t = FaraidLib.add(t, FaraidLib.mul(r.sonEach, F(f.sons, 1)));
        t = FaraidLib.add(t, FaraidLib.mul(r.daughterEach, F(f.daughters, 1)));
        t = FaraidLib.add(t, r.father);
        t = FaraidLib.add(t, r.mother);
    }

    function _isOne(FaraidLib.Frac memory a) internal pure returns (bool) {
        return a.num == a.den && a.den != 0;
    }

    function _eq(FaraidLib.Frac memory a, FaraidLib.Frac memory b) internal pure returns (bool) {
        return a.num == b.num && a.den == b.den;
    }

    function _amount(uint256 harta, FaraidLib.Frac memory share) internal pure returns (uint256) {
        return harta * share.num / share.den;
    }
}
