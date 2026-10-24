// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FaraidLib} from "../src/FaraidLib.sol";
import {EstateLib} from "../src/EstateLib.sol";

/// @dev Pembungkus eksternal agar revert dari fungsi library bisa ditangkap vm.expectRevert.
contract EstateHarness {
    function validate(FaraidLib.Frac memory joint, FaraidLib.Frac[] memory bequests, FaraidLib.Family memory f)
        external
        pure
    {
        EstateLib.validate(joint, bequests, f);
    }

    function plan(
        uint256 balance,
        FaraidLib.Frac memory joint,
        FaraidLib.Frac[] memory bequests,
        FaraidLib.Frac[] memory heirShares
    ) external pure returns (EstateLib.Plan memory) {
        return EstateLib.plan(balance, joint, bequests, heirShares);
    }
}

/// @notice Urutan KHI: harta bersama (Pasal 96) → wasiat ≤ 1/3 (Pasal 195) → faraid.
contract EstateLibTest is Test {
    EstateHarness h;

    function setUp() public {
        h = new EstateHarness();
    }

    // ------------------------------------------------------------------
    // plan()
    // ------------------------------------------------------------------

    /// @notice Kasus demo: Rp300 jt seluruhnya harta bersama, wakaf masjid 1/5, keluarga K01.
    function test_plan_demo() public view {
        EstateLib.Plan memory p = h.plan(300_000_000 ether, F(1, 1), _one(F(1, 5)), _sharesK01());
        assertEq(p.jointAmount, 150_000_000 ether, "separuh harta bersama ke istri");
        assertEq(p.bequestAmounts[0], 30_000_000 ether, "1/5 dari 150 jt");
        assertEq(p.faraidPool, 120_000_000 ether);
        assertEq(p.heirAmounts[0], 15_000_000 ether, "istri");
        assertEq(p.heirAmounts[1], 26_000_000 ether, "anak lk");
        assertEq(p.heirAmounts[3], 13_000_000 ether, "anak pr");
        assertEq(p.heirAmounts[4], 20_000_000 ether, "ayah");
    }

    function test_plan_withoutJointOrBequest() public view {
        EstateLib.Plan memory p = h.plan(120_000_000 ether, F(0, 1), new FaraidLib.Frac[](0), _sharesK01());
        assertEq(p.jointAmount, 0);
        assertEq(p.faraidPool, 120_000_000 ether);
        assertEq(p.heirAmounts[1], 26_000_000 ether);
    }

    function test_plan_partialJointProperty() public view {
        // Separuh saldo adalah harta bersama → pasangan menerima 1/4 saldo lebih dulu
        EstateLib.Plan memory p = h.plan(400 ether, F(1, 2), new FaraidLib.Frac[](0), _sharesK01());
        assertEq(p.jointAmount, 100 ether);
        assertEq(p.faraidPool, 300 ether);
    }

    /// @notice Kombinasi apa pun: harta bersama + wasiat + faraid = saldo, tidak ada yang hilang atau berlebih.
    function testFuzz_plan_totalEqualsBalance(uint256 balance, uint8 jointNum, uint8 bequestNum) public view {
        balance = bound(balance, 0, 1e36);
        uint256 jn = bound(jointNum, 0, 7);
        uint256 bn = bound(bequestNum, 1, 10); // 1/30 .. 10/30 = 1/3
        EstateLib.Plan memory p = h.plan(balance, F(jn, 7), _one(F(bn, 30)), _sharesK01());

        uint256 total = p.jointAmount + p.bequestAmounts[0];
        for (uint256 i; i < p.heirAmounts.length; i++) {
            total += p.heirAmounts[i];
        }
        assertEq(total, balance);
        assertEq(p.heirAmounts[1], p.heirAmounts[2], "dua anak lk sama");
    }

    // ------------------------------------------------------------------
    // validate()
    // ------------------------------------------------------------------

    function test_validate_accepts() public view {
        FaraidLib.Frac[] memory wasiat = new FaraidLib.Frac[](2);
        wasiat[0] = F(1, 6);
        wasiat[1] = F(1, 6); // total tepat 1/3: masih boleh
        h.validate(F(1, 1), wasiat, _family(1, 0));
        h.validate(F(1, 1), wasiat, _family(0, 1)); // pewaris perempuan, suami menerima harta bersama
        h.validate(F(0, 1), new FaraidLib.Frac[](0), _family(0, 0)); // tanpa pasangan dan tanpa harta bersama
    }

    function test_validate_badJointFraction() public {
        vm.expectRevert(abi.encodeWithSelector(EstateLib.InvalidEstate.selector, uint8(1)));
        h.validate(F(3, 2), new FaraidLib.Frac[](0), _family(1, 0));

        vm.expectRevert(abi.encodeWithSelector(EstateLib.InvalidEstate.selector, uint8(1)));
        h.validate(FaraidLib.Frac(0, 0), new FaraidLib.Frac[](0), _family(1, 0));
    }

    function test_validate_jointNeedsExactlyOneSpouse() public {
        vm.expectRevert(abi.encodeWithSelector(EstateLib.InvalidEstate.selector, uint8(2)));
        h.validate(F(1, 1), new FaraidLib.Frac[](0), _family(2, 0)); // dua istri

        vm.expectRevert(abi.encodeWithSelector(EstateLib.InvalidEstate.selector, uint8(2)));
        h.validate(F(1, 1), new FaraidLib.Frac[](0), _family(0, 0)); // tidak ada pasangan
    }

    function test_validate_badBequests() public {
        FaraidLib.Frac[] memory four = new FaraidLib.Frac[](4);
        for (uint256 i; i < 4; i++) {
            four[i] = F(1, 100);
        }
        vm.expectRevert(abi.encodeWithSelector(EstateLib.InvalidEstate.selector, uint8(3)));
        h.validate(F(0, 1), four, _family(1, 0));

        vm.expectRevert(abi.encodeWithSelector(EstateLib.InvalidEstate.selector, uint8(3)));
        h.validate(F(0, 1), _one(FaraidLib.Frac(0, 1)), _family(1, 0));

        vm.expectRevert(abi.encodeWithSelector(EstateLib.InvalidEstate.selector, uint8(3)));
        h.validate(F(0, 1), _one(FaraidLib.Frac(1, 0)), _family(1, 0));
    }

    function test_validate_bequestsOverOneThird() public {
        FaraidLib.Frac[] memory wasiat = new FaraidLib.Frac[](2);
        wasiat[0] = F(1, 3);
        wasiat[1] = F(1, 100);
        vm.expectRevert(abi.encodeWithSelector(EstateLib.InvalidEstate.selector, uint8(4)));
        h.validate(F(0, 1), wasiat, _family(1, 0));
    }

    // ------------------------------------------------------------------
    // Pembantu
    // ------------------------------------------------------------------

    function F(uint256 num, uint256 den) internal pure returns (FaraidLib.Frac memory) {
        return FaraidLib.Frac(num, den);
    }

    function _one(FaraidLib.Frac memory f) internal pure returns (FaraidLib.Frac[] memory list) {
        list = new FaraidLib.Frac[](1);
        list[0] = f;
    }

    /// @dev Bagian per orang K01: istri, anak lk ×2, anak pr, ayah, ibu.
    function _sharesK01() internal pure returns (FaraidLib.Frac[] memory s) {
        s = new FaraidLib.Frac[](6);
        s[0] = F(1, 8);
        s[1] = F(13, 60);
        s[2] = F(13, 60);
        s[3] = F(13, 120);
        s[4] = F(1, 6);
        s[5] = F(1, 6);
    }

    function _family(uint8 wives, uint8 husband) internal pure returns (FaraidLib.Family memory f) {
        f.deceasedMale = husband == 0;
        f.wives = wives;
        f.husband = husband;
        f.sons = 1;
    }
}
