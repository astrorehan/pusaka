// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Test, stdError} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {MitraCair, RekeningVirtual} from "../src/MitraCair.sol";
import {MockIDR} from "../src/MockIDR.sol";

/// @notice Tes MitraCair, simulasi mitra pencairan rupiah (off-ramp): rekening virtual (klon CREATE2), sapu, pencairan
///         dengan izin EIP-2612, penyelesaian oleh operator (token dibakar), pengembalian, dan antrean.
contract MitraCairTest is Test {
    bytes32 constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 constant SIDIK = keccak256("rekening-1");
    bytes32 constant BUKTI = keccak256("referensi-bank-1");

    MockIDR token;
    MitraCair mitra;

    address pemilik = makeAddr("pemilik");
    address operator = makeAddr("operator");
    address pendaftar = makeAddr("pendaftar"); // mis. dompet pewaris yang mendaftarkan rekening ahli waris
    address orangLain = makeAddr("orangLain");
    address cadangan = makeAddr("cadangan"); // mis. amplop digital ahli waris
    address anak; // pemegang tIDR yang mencairkan sendiri
    uint256 anakKey;

    function setUp() public {
        token = new MockIDR();
        mitra = new MitraCair(token, pemilik);
        vm.prank(pemilik);
        mitra.aturOperator(operator, true);
        (anak, anakKey) = makeAddrAndKey("anak");
    }

    // ------------------------------------------------------------------
    // Pembentukan, pemilik, dan operator
    // ------------------------------------------------------------------

    function test_constructor_setsOwnerOperatorAndImplementation() public view {
        assertEq(address(mitra.token()), address(token));
        assertEq(mitra.pemilik(), pemilik);
        assertTrue(mitra.isOperator(pemilik), "pemilik otomatis operator");
        assertFalse(mitra.isOperator(orangLain));
        assertGt(mitra.rekeningImpl().code.length, 0);
        assertEq(RekeningVirtual(mitra.rekeningImpl()).mitra(), address(mitra));
        assertEq(mitra.MAKS_BATCH(), 20);
        assertEq(mitra.antreanMulai(), 0);
        assertEq(mitra.jumlahRekening(), 0);
        assertEq(mitra.jumlahPencairan(), 0);
    }

    function test_constructor_emitsOperatorDiatur() public {
        address prediksi = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        vm.expectEmit(address(prediksi));
        emit MitraCair.OperatorDiatur(pemilik, true);
        MitraCair baru = new MitraCair(token, pemilik);
        assertEq(address(baru), prediksi);
    }

    function test_constructor_rejectsZeroAddress() public {
        vm.expectRevert(MitraCair.DataTidakValid.selector);
        new MitraCair(MockIDR(address(0)), pemilik);
        vm.expectRevert(MitraCair.DataTidakValid.selector);
        new MitraCair(token, address(0));
    }

    function test_aturOperator_onlyPemilik() public {
        vm.prank(orangLain);
        vm.expectRevert(MitraCair.BukanPemilik.selector);
        mitra.aturOperator(orangLain, true);
        // Operator biasa pun tidak boleh mengatur operator
        vm.prank(operator);
        vm.expectRevert(MitraCair.BukanPemilik.selector);
        mitra.aturOperator(orangLain, true);
        assertFalse(mitra.isOperator(orangLain));

        vm.expectEmit(address(mitra));
        emit MitraCair.OperatorDiatur(orangLain, true);
        vm.prank(pemilik);
        mitra.aturOperator(orangLain, true);
        assertTrue(mitra.isOperator(orangLain));

        vm.expectEmit(address(mitra));
        emit MitraCair.OperatorDiatur(orangLain, false);
        vm.prank(pemilik);
        mitra.aturOperator(orangLain, false);
        assertFalse(mitra.isOperator(orangLain));
    }

    function test_aturOperator_revokedOperatorLosesPowers() public {
        (,, uint256[] memory nos) = _buatPencairan(2, 1 ether);
        vm.prank(pemilik);
        mitra.aturOperator(operator, false);

        uint256[] memory satu = new uint256[](1);
        bytes32[] memory bukti = new bytes32[](1);
        vm.prank(operator);
        vm.expectRevert(MitraCair.BukanOperator.selector);
        mitra.selesaikan(satu, bukti);
        vm.prank(operator);
        vm.expectRevert(MitraCair.BukanOperator.selector);
        mitra.kembalikan(nos[0]);

        // Pemilik tetap bisa mengaktifkannya lagi
        vm.prank(pemilik);
        mitra.aturOperator(operator, true);
        _selesaikan1(nos[0], BUKTI);
        assertEq(uint8(mitra.getPencairan(nos[0]).tahap), uint8(MitraCair.Tahap.Selesai));
    }

    /// @notice Hak mengatur operator melekat pada `pemilik`, bukan pada status operator: pemilik yang mencabut dirinya
    ///         sendiri sebagai operator tetap bisa mengaktifkannya lagi.
    function test_aturOperator_pemilikKeepsControlAfterRevokingItself() public {
        vm.startPrank(pemilik);
        mitra.aturOperator(pemilik, false);
        assertFalse(mitra.isOperator(pemilik));
        mitra.aturOperator(pemilik, true);
        vm.stopPrank();
        assertTrue(mitra.isOperator(pemilik));
    }

    // ------------------------------------------------------------------
    // Pendaftaran rekening
    // ------------------------------------------------------------------

    function test_daftar_storesAccountAndEmits() public {
        bytes32 id = mitra.idRekening(pendaftar, SIDIK);
        address va = mitra.alamatVA(id);
        assertEq(id, keccak256(abi.encode(pendaftar, SIDIK)), "id = hash(pendaftar, sidik)");

        vm.expectEmit(address(mitra));
        emit MitraCair.RekeningDidaftarkan(id, va, "BRI", "7781", cadangan);
        (bytes32 idHasil, address vaHasil) = _daftar(SIDIK, cadangan);

        assertEq(idHasil, id);
        assertEq(vaHasil, va);
        MitraCair.Rekening memory r = mitra.getRekening(id);
        assertEq(r.bank, "BRI");
        assertEq(r.akhiran, "7781");
        assertEq(r.va, va);
        assertEq(r.cadangan, cadangan);
        assertEq(r.dibuat, _now());
        assertEq(mitra.rekeningDariVA(va), id);
        assertEq(mitra.jumlahRekening(), 1);
        assertEq(va.code.length, 0, "VA baru alamat; kontraknya dibuat saat sapu pertama");
    }

    function test_daftar_reRegisterIsIdempotent() public {
        (bytes32 id, address va) = _daftar(SIDIK, cadangan);

        vm.recordLogs();
        vm.prank(pendaftar);
        (bytes32 id2, address va2) = mitra.daftar(SIDIK, "BCA", "9999", orangLain); // data lain
        assertEq(vm.getRecordedLogs().length, 0, "tidak ada event");

        assertEq(id2, id);
        assertEq(va2, va);
        MitraCair.Rekening memory r = mitra.getRekening(id);
        assertEq(r.bank, "BRI", "data pertama tidak berubah");
        assertEq(r.akhiran, "7781");
        assertEq(r.cadangan, cadangan);
        assertEq(mitra.jumlahRekening(), 1);
    }

    /// @notice Id terikat pada pendaftar: yang memakai sidik yang sama (mis. menyalip transaksi pendaftaran) hanya
    ///         mendapat id dan VA miliknya sendiri; rekening pendaftar asli tidak tersentuh.
    function test_daftar_idIsBoundToRegistrant() public {
        vm.prank(orangLain);
        (bytes32 idB, address vaB) = mitra.daftar(SIDIK, "BCA", "0000", orangLain); // penyerobot lebih dulu
        (bytes32 idA, address vaA) = _daftar(SIDIK, cadangan);

        assertTrue(idA != idB);
        assertTrue(vaA != vaB);
        assertEq(idB, mitra.idRekening(orangLain, SIDIK));
        assertEq(idA, mitra.idRekening(pendaftar, SIDIK));
        MitraCair.Rekening memory a = mitra.getRekening(idA);
        assertEq(a.bank, "BRI");
        assertEq(a.cadangan, cadangan);
        assertEq(a.va, vaA);
        assertEq(mitra.getRekening(idB).cadangan, orangLain);
        assertEq(mitra.jumlahRekening(), 2);

        // Dana di VA pendaftar asli tercatat untuk rekeningnya, bukan rekening penyerobot
        token.faucet(vaA, 5 ether);
        uint256 no = mitra.sapu(idA);
        assertEq(mitra.getPencairan(no).rekening, idA);
        assertEq(mitra.statusPenerima(vaA).bankTujuan, "BRI");
    }

    function test_daftar_validation() public {
        vm.startPrank(pendaftar);
        vm.expectRevert(MitraCair.DataTidakValid.selector);
        mitra.daftar(bytes32(0), "BRI", "7781", cadangan); // sidik nol
        vm.expectRevert(MitraCair.DataTidakValid.selector);
        mitra.daftar(SIDIK, "", "7781", cadangan); // nama bank kosong
        vm.expectRevert(MitraCair.DataTidakValid.selector);
        mitra.daftar(SIDIK, "ABCDEFGHIJKLMNOPQRSTUVWXY", "7781", cadangan); // nama bank 25 karakter
        vm.expectRevert(MitraCair.DataTidakValid.selector);
        mitra.daftar(SIDIK, "BRI", "123456789", cadangan); // akhiran 9 karakter
        assertEq(mitra.jumlahRekening(), 0);

        // Batas yang masih sah: nama bank 24 karakter, akhiran 8 karakter, tanpa cadangan
        mitra.daftar(SIDIK, "ABCDEFGHIJKLMNOPQRSTUVWX", "12345678", address(0));
        // Akhiran boleh kosong (mis. e-wallet)
        mitra.daftar(keccak256("rekening-2"), "GoPay", "", address(0));
        vm.stopPrank();
        assertEq(mitra.jumlahRekening(), 2);
    }

    function test_daftarBanyak_registersAll() public {
        (bytes32[] memory sidik, string[] memory bank, string[] memory akhiran, address[] memory cad) = _batch(4);
        address[] memory prediksi = mitra.alamatVAUntuk(pendaftar, sidik);

        vm.recordLogs();
        vm.prank(pendaftar);
        address[] memory va = mitra.daftarBanyak(sidik, bank, akhiran, cad);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        assertEq(va.length, 4);
        assertEq(logs.length, 4);
        assertEq(mitra.jumlahRekening(), 4);
        for (uint256 i; i < 4; i++) {
            bytes32 id = mitra.idRekening(pendaftar, sidik[i]);
            assertEq(va[i], prediksi[i], "alamatVAUntuk sama dengan hasil pendaftaran");
            assertEq(va[i], mitra.alamatVA(id));
            assertEq(mitra.getRekening(id).va, va[i]);
            assertEq(mitra.getRekening(id).cadangan, cad[i]);
            assertEq(mitra.rekeningDariVA(va[i]), id);
            assertEq(logs[i].topics[0], MitraCair.RekeningDidaftarkan.selector);
            assertEq(logs[i].topics[1], id);
        }
    }

    function test_daftarBanyak_batchLimit() public {
        (bytes32[] memory sidik, string[] memory bank, string[] memory akhiran, address[] memory cad) = _batch(21);
        vm.prank(pendaftar);
        vm.expectRevert(MitraCair.DataTidakValid.selector);
        mitra.daftarBanyak(sidik, bank, akhiran, cad);

        (sidik, bank, akhiran, cad) = _batch(20); // tepat di batas
        vm.prank(pendaftar);
        mitra.daftarBanyak(sidik, bank, akhiran, cad);
        assertEq(mitra.jumlahRekening(), 20);
    }

    function test_daftarBanyak_lengthMismatch_reverts() public {
        (bytes32[] memory sidik, string[] memory bank, string[] memory akhiran, address[] memory cad) = _batch(3);
        (, string[] memory bankPendek,,) = _batch(2);
        (,, string[] memory akhiranPendek,) = _batch(2);
        (,,, address[] memory cadPendek) = _batch(2);

        vm.startPrank(pendaftar);
        vm.expectRevert(MitraCair.DataTidakValid.selector);
        mitra.daftarBanyak(sidik, bankPendek, akhiran, cad);
        vm.expectRevert(MitraCair.DataTidakValid.selector);
        mitra.daftarBanyak(sidik, bank, akhiranPendek, cad);
        vm.expectRevert(MitraCair.DataTidakValid.selector);
        mitra.daftarBanyak(sidik, bank, akhiran, cadPendek);
        vm.stopPrank();
        assertEq(mitra.jumlahRekening(), 0);
    }

    /// @notice Satu data yang tidak valid membatalkan seluruh batch: tidak ada pendaftaran setengah jalan.
    function test_daftarBanyak_oneInvalid_revertsAll() public {
        (bytes32[] memory sidik, string[] memory bank, string[] memory akhiran, address[] memory cad) = _batch(4);
        bank[2] = "";
        vm.prank(pendaftar);
        vm.expectRevert(MitraCair.DataTidakValid.selector);
        mitra.daftarBanyak(sidik, bank, akhiran, cad);
        assertEq(mitra.jumlahRekening(), 0);
    }

    function test_daftarBanyak_alreadyRegisteredReturnsSameVa() public {
        (bytes32[] memory sidik, string[] memory bank, string[] memory akhiran, address[] memory cad) = _batch(3);
        vm.prank(pendaftar);
        (, address vaTengah) = mitra.daftar(sidik[1], "Mandiri", "1111", cadangan);

        vm.prank(pendaftar);
        address[] memory va = mitra.daftarBanyak(sidik, bank, akhiran, cad);

        assertEq(va[1], vaTengah);
        assertEq(mitra.jumlahRekening(), 3, "yang sudah terdaftar tidak dobel");
        assertEq(mitra.getRekening(mitra.idRekening(pendaftar, sidik[1])).bank, "Mandiri", "data lama tetap");
    }

    function test_batchFunctions_emptyInput_areNoops() public {
        vm.prank(pendaftar);
        address[] memory va = mitra.daftarBanyak(new bytes32[](0), new string[](0), new string[](0), new address[](0));
        assertEq(va.length, 0);
        assertEq(mitra.alamatVAUntuk(pendaftar, new bytes32[](0)).length, 0);
        assertEq(mitra.sapuBanyak(new bytes32[](0)), 0);
        assertEq(mitra.statusBanyak(new address[](0)).length, 0);
        assertEq(mitra.jumlahRekening(), 0);
        assertEq(mitra.jumlahPencairan(), 0);
    }

    function test_getters_unknownIds_returnEmpty() public {
        MitraCair.Rekening memory r = mitra.getRekening(keccak256("tidak-ada"));
        assertEq(r.va, address(0));
        assertEq(r.bank, "");
        assertEq(r.akhiran, "");
        assertEq(r.cadangan, address(0));
        assertEq(r.dibuat, 0);
        assertEq(mitra.rekeningDariVA(orangLain), bytes32(0));
        vm.expectRevert(stdError.indexOOBError);
        mitra.getPencairan(0);
    }

    // ------------------------------------------------------------------
    // Alamat rekening virtual (CREATE2)
    // ------------------------------------------------------------------

    /// @notice Alamat yang dihitung sebelum pendaftaran sama dengan alamat tempat klonnya benar-benar dibuat pada
    ///         sapu pertama. Itu yang membuat alamat ini sah dipakai sebagai alamat ahli waris sebelum kontraknya ada.
    function test_alamatVA_equalsAddressDeployedOnFirstSweep() public {
        bytes32 id = mitra.idRekening(pendaftar, SIDIK);
        address prediksi = mitra.alamatVA(id);

        // Rumus CREATE2 dihitung ulang tanpa library: klon EIP-1167 dari rekeningImpl, salt = id, deployer = mitra
        bytes memory initcode = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73", mitra.rekeningImpl(), hex"5af43d82803e903d91602b57fd5bf3"
        );
        assertEq(computeCreate2Address(id, keccak256(initcode), address(mitra)), prediksi);

        (, address va) = _daftar(SIDIK, cadangan);
        assertEq(va, prediksi);
        token.faucet(va, 1_000 ether); // dana masuk ke alamat yang kontraknya belum ada
        assertEq(va.code.length, 0);

        assertEq(mitra.sapu(id), 0); // sapu pertama membuat klonnya
        assertEq(
            va.code,
            abi.encodePacked(hex"363d3d373d3d3d363d73", mitra.rekeningImpl(), hex"5af43d82803e903d91602b57fd5bf3"),
            "klon EIP-1167 menunjuk ke rekeningImpl"
        );
        assertEq(RekeningVirtual(va).mitra(), address(mitra));
        assertEq(token.balanceOf(address(mitra)), 1_000 ether);
    }

    function testFuzz_alamatVA_matchesCreate2(address siapa, bytes32 sidik) public view {
        bytes32 id = mitra.idRekening(siapa, sidik);
        bytes memory initcode = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73", mitra.rekeningImpl(), hex"5af43d82803e903d91602b57fd5bf3"
        );
        assertEq(mitra.alamatVA(id), computeCreate2Address(id, keccak256(initcode), address(mitra)));
    }

    function testFuzz_idRekening_isolatedPerRegistrant(address a, address b, bytes32 sidik) public view {
        vm.assume(a != b);
        assertTrue(mitra.idRekening(a, sidik) != mitra.idRekening(b, sidik));
        assertTrue(mitra.alamatVA(mitra.idRekening(a, sidik)) != mitra.alamatVA(mitra.idRekening(b, sidik)));
    }

    // ------------------------------------------------------------------
    // Sapu: isi rekening virtual → permintaan pencairan
    // ------------------------------------------------------------------

    function test_sapu_createsPencairanFromVA() public {
        (bytes32 id, address va) = _daftar(SIDIK, cadangan);
        token.faucet(va, 165_000_000 ether);

        vm.expectEmit(address(mitra));
        emit MitraCair.PencairanDiminta(0, id, va, 165_000_000 ether);
        vm.prank(orangLain); // siapa pun boleh menyapu
        uint256 no = mitra.sapu(id);

        assertEq(no, 0);
        MitraCair.Pencairan memory p = mitra.getPencairan(0);
        assertEq(p.rekening, id);
        assertEq(p.dari, va, "dari = rekening virtual");
        assertEq(p.diminta, _now());
        assertEq(p.jumlah, 165_000_000 ether);
        assertEq(p.selesai, 0);
        assertEq(uint8(p.tahap), uint8(MitraCair.Tahap.Diproses));
        assertEq(p.bukti, bytes32(0));
        assertEq(token.balanceOf(va), 0);
        assertEq(token.balanceOf(address(mitra)), 165_000_000 ether);
        assertEq(mitra.jumlahPencairan(), 1);
    }

    function test_sapu_emptyVa_isSkipped() public {
        (bytes32 id, address va) = _daftar(SIDIK, cadangan);

        assertEq(mitra.sapu(id), type(uint256).max);
        assertEq(mitra.jumlahPencairan(), 0);
        assertEq(va.code.length, 0, "tidak membuat klon yang tidak perlu");
    }

    function test_sapu_unknownAccount_reverts() public {
        bytes32 id = mitra.idRekening(pendaftar, SIDIK); // belum didaftarkan
        vm.expectRevert(abi.encodeWithSelector(MitraCair.RekeningTidakAda.selector, id));
        mitra.sapu(id);
    }

    function test_sapu_accumulatesDepositsIntoOnePencairan() public {
        (bytes32 id, address va) = _daftar(SIDIK, cadangan);
        token.faucet(va, 10 ether);
        token.faucet(va, 5 ether);
        assertEq(mitra.sapu(id), 0);
        assertEq(mitra.getPencairan(0).jumlah, 15 ether);
        assertEq(mitra.jumlahPencairan(), 1);
    }

    function test_sapu_secondSweepReusesClone() public {
        (bytes32 id, address va) = _daftar(SIDIK, cadangan);
        token.faucet(va, 10 ether);
        assertEq(mitra.sapu(id), 0);
        uint256 panjangKode = va.code.length;
        assertGt(panjangKode, 0);

        token.faucet(va, 5 ether); // setoran baru ke VA yang sudah ada kontraknya
        assertEq(mitra.sapu(id), 1);
        assertEq(mitra.getPencairan(1).jumlah, 5 ether);
        assertEq(mitra.getPencairan(1).dari, va);
        assertEq(va.code.length, panjangKode);
        assertEq(mitra.sapu(id), type(uint256).max, "kosong lagi -> dilewati");
    }

    function test_sapuBanyak_countsOnlyNonEmpty() public {
        (bytes32[] memory ids, address[] memory vas) = _daftarVa(4);
        token.faucet(vas[0], 1 ether);
        token.faucet(vas[2], 3 ether);
        token.faucet(vas[3], 4 ether);

        vm.prank(orangLain);
        uint256 dibuat = mitra.sapuBanyak(ids);

        assertEq(dibuat, 3);
        assertEq(mitra.jumlahPencairan(), 3);
        assertEq(mitra.getPencairan(0).dari, vas[0]);
        assertEq(mitra.getPencairan(1).dari, vas[2]);
        assertEq(mitra.getPencairan(2).dari, vas[3]);
        assertEq(vas[1].code.length, 0, "VA kosong tidak dibuatkan klon");
        assertEq(token.balanceOf(address(mitra)), 8 ether);
    }

    function test_sapuBanyak_batchLimit() public {
        (bytes32[] memory ids21,) = _daftarVa(21);
        vm.expectRevert(MitraCair.DataTidakValid.selector);
        mitra.sapuBanyak(ids21);

        bytes32[] memory ids20 = new bytes32[](20);
        for (uint256 i; i < 20; i++) {
            ids20[i] = ids21[i];
            token.faucet(mitra.getRekening(ids21[i]).va, 1 ether);
        }
        assertEq(mitra.sapuBanyak(ids20), 20, "tepat di batas");
    }

    function test_sapuBanyak_unknownAccount_revertsAll() public {
        (bytes32[] memory ids, address[] memory vas) = _daftarVa(2);
        token.faucet(vas[0], 1 ether);
        bytes32[] memory campur = new bytes32[](3);
        campur[0] = ids[0];
        campur[1] = ids[1];
        campur[2] = mitra.idRekening(orangLain, SIDIK); // tidak terdaftar

        vm.expectRevert(abi.encodeWithSelector(MitraCair.RekeningTidakAda.selector, campur[2]));
        mitra.sapuBanyak(campur);
        assertEq(mitra.jumlahPencairan(), 0, "sapuan sebelumnya ikut batal");
        assertEq(token.balanceOf(vas[0]), 1 ether);
    }

    function test_rekeningVirtual_sapu_onlyMitra() public {
        (bytes32 id, address va) = _daftar(SIDIK, cadangan);
        token.faucet(va, 1 ether);
        mitra.sapu(id); // klonnya dibuat
        token.faucet(va, 1 ether);
        address cetakan = mitra.rekeningImpl(); // dibaca sebelum expectRevert agar tidak ikut "panggilan berikutnya"

        vm.prank(orangLain);
        vm.expectRevert(RekeningVirtual.BukanMitra.selector);
        RekeningVirtual(va).sapu(token);
        vm.prank(pendaftar); // pendaftar rekening pun tidak bisa menarik
        vm.expectRevert(RekeningVirtual.BukanMitra.selector);
        RekeningVirtual(va).sapu(token);
        // Kontrak cetakannya juga
        vm.expectRevert(RekeningVirtual.BukanMitra.selector);
        RekeningVirtual(cetakan).sapu(token);

        assertEq(token.balanceOf(va), 1 ether, "dana tetap aman");
    }

    function test_rekeningVirtual_standalone() public {
        RekeningVirtual rv = new RekeningVirtual();
        assertEq(rv.mitra(), address(this), "mitra = pembuatnya");
        assertEq(rv.sapu(token), 0, "kosong -> 0, tidak revert");
        token.faucet(address(rv), 7 ether);
        assertEq(rv.sapu(token), 7 ether);
        assertEq(token.balanceOf(address(this)), 7 ether);
        assertEq(token.balanceOf(address(rv)), 0);
    }

    // ------------------------------------------------------------------
    // Cairkan: izin EIP-2612 + pencairan dalam satu transaksi
    // ------------------------------------------------------------------

    function test_cairkan_permitInOneTx_noPriorApprove() public {
        token.faucet(anak, 26_000_000 ether);
        (uint256 deadline, uint8 v, bytes32 r, bytes32 s) = _permit(26_000_000 ether);
        bytes32 id = mitra.idRekening(anak, SIDIK);
        address va = mitra.alamatVA(id);
        assertEq(token.allowance(anak, address(mitra)), 0, "belum ada approve");

        vm.expectEmit(address(mitra));
        emit MitraCair.RekeningDidaftarkan(id, va, "BRI", "7781", anak);
        vm.expectEmit(address(mitra));
        emit MitraCair.PencairanDiminta(0, id, anak, 26_000_000 ether);
        vm.prank(anak);
        uint256 no = mitra.cairkan(SIDIK, "BRI", "7781", 26_000_000 ether, deadline, v, r, s);

        assertEq(no, 0);
        assertEq(token.balanceOf(anak), 0);
        assertEq(token.balanceOf(address(mitra)), 26_000_000 ether);
        assertEq(token.allowance(anak, address(mitra)), 0, "izin terpakai habis");
        assertEq(token.nonces(anak), 1);
        MitraCair.Pencairan memory p = mitra.getPencairan(0);
        assertEq(p.rekening, id);
        assertEq(p.dari, anak, "dari = pemegang token");
        assertEq(p.jumlah, 26_000_000 ether);
        assertEq(uint8(p.tahap), uint8(MitraCair.Tahap.Diproses));
        assertEq(mitra.getRekening(id).cadangan, anak, "dana kembali ke pengirim jika bank gagal");
    }

    /// @notice Izin yang disalip orang lain (dikirim langsung ke token lebih dulu) tidak menggagalkan pencairan,
    ///         karena allowance-nya sudah cukup.
    function test_cairkan_permitFrontRun_stillWorks() public {
        token.faucet(anak, 26 ether);
        (uint256 deadline, uint8 v, bytes32 r, bytes32 s) = _permit(26 ether);

        vm.prank(orangLain);
        token.permit(anak, address(mitra), 26 ether, deadline, v, r, s);
        assertEq(token.allowance(anak, address(mitra)), 26 ether);

        vm.prank(anak);
        uint256 no = mitra.cairkan(SIDIK, "BRI", "7781", 26 ether, deadline, v, r, s);

        assertEq(no, 0);
        assertEq(token.balanceOf(address(mitra)), 26 ether);
        assertEq(token.balanceOf(anak), 0);
        assertEq(token.nonces(anak), 1, "izin hanya terpakai sekali");
    }

    function test_cairkan_standingAllowance_needsNoPermit() public {
        token.faucet(anak, 26 ether);
        vm.prank(anak);
        token.approve(address(mitra), 26 ether);

        // Tanda tangan sampah diabaikan selama allowance cukup
        vm.prank(anak);
        uint256 no = mitra.cairkan(SIDIK, "GoPay", "", 26 ether, 0, 0, bytes32(0), bytes32(0));

        assertEq(no, 0);
        assertEq(token.balanceOf(address(mitra)), 26 ether);
        assertEq(mitra.statusPenerima(anak).bankTujuan, "GoPay");
    }

    function test_cairkan_badPermitAndNoAllowance_reverts() public {
        token.faucet(anak, 26 ether);
        (, uint256 penipuKey) = makeAddrAndKey("penipu");
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(penipuKey, anak, address(mitra), 26 ether, deadline);

        vm.prank(anak);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(mitra), 0, 26 ether)
        );
        mitra.cairkan(SIDIK, "BRI", "7781", 26 ether, deadline, v, r, s);

        assertEq(token.balanceOf(anak), 26 ether);
        assertEq(mitra.jumlahRekening(), 0, "pendaftaran ikut batal");
        assertEq(mitra.jumlahPencairan(), 0);
    }

    function test_cairkan_expiredPermit_reverts() public {
        token.faucet(anak, 26 ether);
        vm.warp(1 days);
        (uint256 deadline, uint8 v, bytes32 r, bytes32 s) = _permitUntil(26 ether, block.timestamp - 1);
        assertLt(deadline, block.timestamp);

        vm.prank(anak);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(mitra), 0, 26 ether)
        );
        mitra.cairkan(SIDIK, "BRI", "7781", 26 ether, deadline, v, r, s);
        assertEq(token.balanceOf(anak), 26 ether);
    }

    /// @notice Izin yang ditandatangani untuk jumlah lain tidak berlaku untuk jumlah yang diminta.
    function test_cairkan_permitForOtherAmount_reverts() public {
        token.faucet(anak, 26 ether);
        (uint256 deadline, uint8 v, bytes32 r, bytes32 s) = _permit(10 ether);

        vm.prank(anak);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(mitra), 0, 26 ether)
        );
        mitra.cairkan(SIDIK, "BRI", "7781", 26 ether, deadline, v, r, s);
    }

    function test_cairkan_insufficientBalance_reverts() public {
        token.faucet(anak, 10 ether);
        (uint256 deadline, uint8 v, bytes32 r, bytes32 s) = _permit(26 ether);

        vm.prank(anak);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, anak, 10 ether, 26 ether)
        );
        mitra.cairkan(SIDIK, "BRI", "7781", 26 ether, deadline, v, r, s);
    }

    function test_cairkan_zeroAmount_reverts() public {
        vm.prank(anak);
        vm.expectRevert(MitraCair.JumlahNol.selector);
        mitra.cairkan(SIDIK, "BRI", "7781", 0, 0, 0, bytes32(0), bytes32(0));
    }

    /// @notice Jumlah pencairan disimpan sebagai uint128; yang lebih besar ditolak, tidak dipotong diam-diam.
    function test_cairkan_amountAboveUint128_reverts() public {
        uint256 terlaluBesar = uint256(type(uint128).max) + 1;
        deal(address(token), anak, terlaluBesar);
        vm.startPrank(anak);
        token.approve(address(mitra), terlaluBesar);
        vm.expectRevert(abi.encodeWithSelector(SafeCast.SafeCastOverflowedUintDowncast.selector, 128, terlaluBesar));
        mitra.cairkan(SIDIK, "BRI", "7781", terlaluBesar, 0, 0, bytes32(0), bytes32(0));
        vm.stopPrank();
        assertEq(token.balanceOf(anak), terlaluBesar);
        assertEq(mitra.jumlahPencairan(), 0);
    }

    function test_cairkan_invalidNewAccount_reverts() public {
        token.faucet(anak, 26 ether);
        (uint256 deadline, uint8 v, bytes32 r, bytes32 s) = _permit(26 ether);

        vm.startPrank(anak);
        vm.expectRevert(MitraCair.DataTidakValid.selector);
        mitra.cairkan(SIDIK, "", "7781", 26 ether, deadline, v, r, s); // nama bank kosong
        vm.expectRevert(MitraCair.DataTidakValid.selector);
        mitra.cairkan(bytes32(0), "BRI", "7781", 26 ether, deadline, v, r, s); // sidik nol
        vm.stopPrank();
        assertEq(token.balanceOf(anak), 26 ether);
        assertEq(token.nonces(anak), 0, "izin tidak terpakai");
    }

    function test_cairkan_secondTimeReusesAccount() public {
        token.faucet(anak, 30 ether);
        (uint256 d1, uint8 v1, bytes32 r1, bytes32 s1) = _permit(10 ether);
        vm.prank(anak);
        assertEq(mitra.cairkan(SIDIK, "BRI", "7781", 10 ether, d1, v1, r1, s1), 0);

        (uint256 d2, uint8 v2, bytes32 r2, bytes32 s2) = _permit(20 ether); // izin baru: nonce berikutnya
        vm.recordLogs();
        vm.prank(anak);
        uint256 no = mitra.cairkan(SIDIK, "BRI", "7781", 20 ether, d2, v2, r2, s2);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        assertEq(no, 1);
        assertEq(mitra.jumlahRekening(), 1, "rekening yang sama dipakai lagi");
        assertEq(mitra.getPencairan(1).rekening, mitra.getPencairan(0).rekening);
        assertEq(mitra.statusPenerima(anak).no, 1, "yang ditampilkan pencairan terakhir");
        assertEq(mitra.statusPenerima(anak).pencairan.jumlah, 20 ether);
        for (uint256 i; i < logs.length; i++) {
            assertTrue(logs[i].topics[0] != MitraCair.RekeningDidaftarkan.selector, "tidak mendaftar ulang");
        }
    }

    function testFuzz_cairkan_anyAmount(uint96 jumlah) public {
        jumlah = uint96(bound(jumlah, 1, 1_000_000_000 ether));
        token.faucet(anak, jumlah);
        (uint256 deadline, uint8 v, bytes32 r, bytes32 s) = _permit(jumlah);

        vm.prank(anak);
        uint256 no = mitra.cairkan(SIDIK, "BRI", "7781", jumlah, deadline, v, r, s);

        assertEq(mitra.getPencairan(no).jumlah, jumlah);
        assertEq(token.balanceOf(anak), 0);
        assertEq(token.balanceOf(address(mitra)), jumlah);
    }

    // ------------------------------------------------------------------
    // Setor ke rekening yang sudah terdaftar
    // ------------------------------------------------------------------

    function test_setor_withApprove() public {
        (bytes32 id,) = _daftar(SIDIK, cadangan);
        token.faucet(anak, 40 ether);

        vm.startPrank(anak);
        token.approve(address(mitra), 40 ether);
        vm.expectEmit(address(mitra));
        emit MitraCair.PencairanDiminta(0, id, anak, 40 ether);
        uint256 no = mitra.setor(id, 40 ether);
        vm.stopPrank();

        assertEq(no, 0);
        MitraCair.Pencairan memory p = mitra.getPencairan(0);
        assertEq(p.rekening, id);
        assertEq(p.dari, anak);
        assertEq(p.jumlah, 40 ether);
        assertEq(uint8(p.tahap), uint8(MitraCair.Tahap.Diproses));
        assertEq(token.balanceOf(anak), 0);
        assertEq(token.balanceOf(address(mitra)), 40 ether);
    }

    function test_setor_validation() public {
        (bytes32 id,) = _daftar(SIDIK, cadangan);
        token.faucet(anak, 40 ether);

        bytes32 asing = mitra.idRekening(orangLain, SIDIK);
        vm.prank(anak);
        vm.expectRevert(abi.encodeWithSelector(MitraCair.RekeningTidakAda.selector, asing));
        mitra.setor(asing, 1 ether);

        vm.prank(anak);
        vm.expectRevert(MitraCair.JumlahNol.selector);
        mitra.setor(id, 0);

        // Tanpa approve
        vm.prank(anak);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(mitra), 0, 1 ether)
        );
        mitra.setor(id, 1 ether);
        assertEq(mitra.jumlahPencairan(), 0);
    }

    // ------------------------------------------------------------------
    // Selesaikan: operator menandai transfer bank selesai, token dibakar
    // ------------------------------------------------------------------

    function test_selesaikan_burnsTokensAndRecordsProof() public {
        (bytes32[] memory ids,, uint256[] memory nos) = _buatPencairan(3, 10 ether); // 10, 20, 30 tIDR
        uint256 supplyAwal = token.totalSupply();
        assertEq(token.balanceOf(address(mitra)), 60 ether);

        // Hanya dua yang diselesaikan: 10 dan 30 dibakar, 20 tetap menunggu
        uint256[] memory dua = new uint256[](2);
        dua[0] = nos[0];
        dua[1] = nos[2];
        bytes32[] memory bukti = new bytes32[](2);
        bukti[0] = keccak256("ref-0");
        bukti[1] = keccak256("ref-2");
        vm.expectEmit(address(mitra));
        emit MitraCair.PencairanSelesai(nos[0], ids[0], 10 ether, bukti[0]);
        vm.expectEmit(address(mitra));
        emit MitraCair.PencairanSelesai(nos[2], ids[2], 30 ether, bukti[1]);
        vm.warp(block.timestamp + 1 hours);
        vm.prank(operator);
        mitra.selesaikan(dua, bukti);

        assertEq(token.totalSupply(), supplyAwal - 40 ether, "hanya yang diselesaikan yang dibakar");
        assertEq(token.balanceOf(address(mitra)), 20 ether);
        MitraCair.Pencairan memory p = mitra.getPencairan(nos[0]);
        assertEq(uint8(p.tahap), uint8(MitraCair.Tahap.Selesai));
        assertEq(p.selesai, _now());
        assertEq(p.bukti, bukti[0]);
        assertEq(uint8(mitra.getPencairan(nos[1]).tahap), uint8(MitraCair.Tahap.Diproses));
        assertEq(mitra.getPencairan(nos[2]).bukti, bukti[1]);
    }

    function test_selesaikan_onlyOperator() public {
        (,, uint256[] memory nos) = _buatPencairan(1, 1 ether);
        uint256[] memory satu = new uint256[](1);
        satu[0] = nos[0];
        bytes32[] memory bukti = new bytes32[](1);
        bukti[0] = BUKTI;

        vm.prank(orangLain);
        vm.expectRevert(MitraCair.BukanOperator.selector);
        mitra.selesaikan(satu, bukti);
        vm.prank(pendaftar); // pendaftar rekening bukan operator
        vm.expectRevert(MitraCair.BukanOperator.selector);
        mitra.selesaikan(satu, bukti);
        vm.prank(orangLain);
        vm.expectRevert(MitraCair.BukanOperator.selector);
        mitra.kembalikan(nos[0]);

        // Operator, dan pemilik yang otomatis operator, boleh
        vm.prank(pemilik);
        mitra.selesaikan(satu, bukti);
        assertEq(uint8(mitra.getPencairan(nos[0]).tahap), uint8(MitraCair.Tahap.Selesai));
    }

    function test_selesaikan_doubleSettle_reverts() public {
        (,, uint256[] memory nos) = _buatPencairan(2, 1 ether);
        _selesaikan1(nos[0], BUKTI);

        uint256[] memory satu = new uint256[](1);
        satu[0] = nos[0];
        bytes32[] memory bukti = new bytes32[](1);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(MitraCair.SudahTuntas.selector, nos[0]));
        mitra.selesaikan(satu, bukti);

        // Nomor yang sama dua kali dalam satu batch: seluruh batch batal
        uint256[] memory kembar = new uint256[](2);
        kembar[0] = nos[1];
        kembar[1] = nos[1];
        bytes32[] memory buktiKembar = new bytes32[](2);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(MitraCair.SudahTuntas.selector, nos[1]));
        mitra.selesaikan(kembar, buktiKembar);
        assertEq(uint8(mitra.getPencairan(nos[1]).tahap), uint8(MitraCair.Tahap.Diproses));
    }

    function test_selesaikan_oneAlreadyDone_revertsWholeBatch() public {
        (,, uint256[] memory nos) = _buatPencairan(2, 1 ether);
        _selesaikan1(nos[1], BUKTI);
        uint256 supplyAwal = token.totalSupply();

        bytes32[] memory bukti = new bytes32[](2);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(MitraCair.SudahTuntas.selector, nos[1]));
        mitra.selesaikan(nos, bukti); // [0, 1]: yang kedua sudah tuntas

        assertEq(uint8(mitra.getPencairan(nos[0]).tahap), uint8(MitraCair.Tahap.Diproses), "yang pertama ikut batal");
        assertEq(token.totalSupply(), supplyAwal);
    }

    function test_selesaikan_inputValidation() public {
        vm.startPrank(operator);
        // Panjang tidak sama
        vm.expectRevert(MitraCair.DataTidakValid.selector);
        mitra.selesaikan(new uint256[](2), new bytes32[](1));
        // Lebih dari MAKS_BATCH
        vm.expectRevert(MitraCair.DataTidakValid.selector);
        mitra.selesaikan(new uint256[](21), new bytes32[](21));
        // Nomor yang belum ada
        uint256[] memory belumAda = new uint256[](1);
        belumAda[0] = 99;
        vm.expectRevert(stdError.indexOOBError);
        mitra.selesaikan(belumAda, new bytes32[](1));
        vm.expectRevert(stdError.indexOOBError);
        mitra.kembalikan(99);
        // Batch kosong tidak mengubah apa pun
        mitra.selesaikan(new uint256[](0), new bytes32[](0));
        vm.stopPrank();
    }

    function testFuzz_sweepAndSettle_burnsExactlySweptAmount(uint96 a, uint96 b) public {
        a = uint96(bound(a, 1, 1_000_000_000 ether));
        b = uint96(bound(b, 1, 1_000_000_000 ether));
        (bytes32[] memory ids, address[] memory vas) = _daftarVa(2);
        token.faucet(vas[0], a);
        token.faucet(vas[1], b);
        uint256 supplyAwal = token.totalSupply();

        assertEq(mitra.sapuBanyak(ids), 2);
        assertEq(token.balanceOf(address(mitra)), uint256(a) + b);

        uint256[] memory nos = new uint256[](2);
        nos[1] = 1;
        vm.prank(operator);
        mitra.selesaikan(nos, new bytes32[](2));

        assertEq(token.totalSupply(), supplyAwal - a - b);
        assertEq(token.balanceOf(address(mitra)), 0);
    }

    // ------------------------------------------------------------------
    // Antrean operator
    // ------------------------------------------------------------------

    function test_antrean_advancesWithMixedSettleAndRefund() public {
        _buatPencairan(5, 10 ether);
        uint256[] memory antrean = mitra.antrean();
        assertEq(antrean.length, 5);
        for (uint256 i; i < 5; i++) {
            assertEq(antrean[i], i);
        }
        assertEq(mitra.antreanMulai(), 0);

        _selesaikan1(0, BUKTI); // nomor terdepan tuntas -> awal antrean maju ke 1
        assertEq(mitra.antreanMulai(), 1);

        _selesaikan1(2, BUKTI); // ada lubang di tengah -> awal antrean tetap
        assertEq(mitra.antreanMulai(), 1);
        antrean = mitra.antrean();
        assertEq(antrean.length, 3);
        assertEq(antrean[0], 1);
        assertEq(antrean[1], 3);
        assertEq(antrean[2], 4);

        vm.prank(operator);
        mitra.kembalikan(1); // dikembalikan juga menutup nomor -> awal antrean lompat ke 3
        assertEq(mitra.antreanMulai(), 3);
        antrean = mitra.antrean();
        assertEq(antrean.length, 2);
        assertEq(antrean[0], 3);
        assertEq(antrean[1], 4);

        _selesaikan1(4, BUKTI);
        assertEq(mitra.antreanMulai(), 3);
        assertEq(mitra.antrean().length, 1);

        vm.prank(operator);
        mitra.kembalikan(3);
        assertEq(mitra.antreanMulai(), 5);
        assertEq(mitra.antrean().length, 0);
    }

    function test_antrean_cappedAtMaksBatch() public {
        (,, uint256[] memory nos) = _buatPencairan(25, 1 ether);
        uint256[] memory antrean = mitra.antrean();
        assertEq(antrean.length, 20, "paling banyak MAKS_BATCH");
        assertEq(antrean[0], 0);
        assertEq(antrean[19], 19);

        uint256[] memory dua_puluh = new uint256[](20);
        for (uint256 i; i < 20; i++) {
            dua_puluh[i] = nos[i];
        }
        vm.prank(operator);
        mitra.selesaikan(dua_puluh, new bytes32[](20));

        antrean = mitra.antrean();
        assertEq(antrean.length, 5);
        assertEq(antrean[0], 20);
        assertEq(antrean[4], 24);
        assertEq(mitra.antreanMulai(), 20);
    }

    // ------------------------------------------------------------------
    // Kembalikan: transfer bank gagal
    // ------------------------------------------------------------------

    function test_kembalikan_vaGoesToCadangan() public {
        (,, uint256 no) = _pencairanDariVA(SIDIK, cadangan, 50 ether);
        uint256 supplyAwal = token.totalSupply();

        vm.warp(block.timestamp + 5);
        vm.expectEmit(address(mitra));
        emit MitraCair.PencairanDikembalikan(no, cadangan, 50 ether);
        vm.prank(operator);
        mitra.kembalikan(no);

        assertEq(token.balanceOf(cadangan), 50 ether);
        assertEq(token.balanceOf(address(mitra)), 0);
        assertEq(token.totalSupply(), supplyAwal, "dikembalikan, bukan dibakar");
        MitraCair.Pencairan memory p = mitra.getPencairan(no);
        assertEq(uint8(p.tahap), uint8(MitraCair.Tahap.Dikembalikan));
        assertEq(p.selesai, _now());
        assertEq(mitra.antreanMulai(), 1);
    }

    function test_kembalikan_cairkanGoesBackToSender() public {
        token.faucet(anak, 26 ether);
        (uint256 deadline, uint8 v, bytes32 r, bytes32 s) = _permit(26 ether);
        vm.prank(anak);
        uint256 no = mitra.cairkan(SIDIK, "BRI", "7781", 26 ether, deadline, v, r, s);

        vm.expectEmit(address(mitra));
        emit MitraCair.PencairanDikembalikan(no, anak, 26 ether);
        vm.prank(operator);
        mitra.kembalikan(no);

        assertEq(token.balanceOf(anak), 26 ether);
        assertEq(token.balanceOf(address(mitra)), 0);
    }

    /// @notice Pemegang token yang lebih dulu mendaftarkan rekening yang sama dengan cadangan lain: pengembalian
    ///         mengikuti cadangan terdaftar (pilihannya sendiri), karena pendaftaran ulang tidak mengubah apa pun.
    function test_kembalikan_cairkanOnPreRegisteredAccount_followsRegisteredCadangan() public {
        vm.prank(anak);
        mitra.daftar(SIDIK, "BRI", "7781", cadangan);
        token.faucet(anak, 26 ether);
        (uint256 deadline, uint8 v, bytes32 r, bytes32 s) = _permit(26 ether);
        vm.prank(anak);
        uint256 no = mitra.cairkan(SIDIK, "BRI", "7781", 26 ether, deadline, v, r, s);

        vm.prank(operator);
        mitra.kembalikan(no);
        assertEq(token.balanceOf(cadangan), 26 ether);
        assertEq(token.balanceOf(anak), 0);
    }

    /// @notice Rekening yang dibuat lewat cairkan() juga punya alamat setoran yang berfungsi; jika transfer bank gagal,
    ///         dana dari alamat itu kembali ke pemegang token yang mendaftarkannya.
    function test_cairkanAccount_alsoReceivesViaVirtualAddress() public {
        token.faucet(anak, 1 ether);
        vm.startPrank(anak);
        token.approve(address(mitra), 1 ether);
        mitra.cairkan(SIDIK, "BRI", "7781", 1 ether, 0, 0, bytes32(0), bytes32(0));
        vm.stopPrank();

        bytes32 id = mitra.idRekening(anak, SIDIK);
        address va = mitra.alamatVA(id);
        token.faucet(va, 9 ether);
        uint256 no = mitra.sapu(id);

        assertEq(no, 1);
        assertEq(mitra.getPencairan(no).rekening, id);
        assertEq(mitra.getPencairan(no).dari, va);
        vm.prank(operator);
        mitra.kembalikan(no);
        assertEq(token.balanceOf(anak), 9 ether);
    }

    /// @notice Rekening tanpa cadangan yang diisi lewat setor() oleh pemegang token: dana kembali ke penyetornya.
    function test_kembalikan_withoutCadangan_goesToDepositor() public {
        (bytes32 id,) = _daftar(SIDIK, address(0));
        token.faucet(anak, 12 ether);
        vm.startPrank(anak);
        token.approve(address(mitra), 12 ether);
        uint256 no = mitra.setor(id, 12 ether);
        vm.stopPrank();

        vm.prank(operator);
        mitra.kembalikan(no);
        assertEq(token.balanceOf(anak), 12 ether);
    }

    /// @notice Jika rekening punya cadangan, dana kembali ke cadangan itu, bukan ke penyetor yang bukan pemiliknya.
    function test_kembalikan_withCadangan_goesToCadanganNotDepositor() public {
        (bytes32 id,) = _daftar(SIDIK, cadangan);
        token.faucet(anak, 12 ether);
        vm.startPrank(anak);
        token.approve(address(mitra), 12 ether);
        uint256 no = mitra.setor(id, 12 ether);
        vm.stopPrank();

        vm.prank(operator);
        mitra.kembalikan(no);
        assertEq(token.balanceOf(cadangan), 12 ether);
        assertEq(token.balanceOf(anak), 0);
    }

    /// @notice VA tanpa cadangan tidak bisa dikembalikan (pengirimnya rekening virtual lagi), tetapi masih bisa dituntaskan.
    function test_kembalikan_vaWithoutCadangan_reverts() public {
        (,, uint256 no) = _pencairanDariVA(SIDIK, address(0), 50 ether);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(MitraCair.TanpaCadangan.selector, no));
        mitra.kembalikan(no);
        assertEq(uint8(mitra.getPencairan(no).tahap), uint8(MitraCair.Tahap.Diproses), "tetap menunggu");
        assertEq(token.balanceOf(address(mitra)), 50 ether);

        _selesaikan1(no, BUKTI);
        assertEq(uint8(mitra.getPencairan(no).tahap), uint8(MitraCair.Tahap.Selesai));
    }

    function test_kembalikan_cadanganIsAnotherVa_reverts() public {
        (bytes32 id2, address va2) = _daftar(keccak256("rekening-2"), address(0));
        assertTrue(id2 != bytes32(0));
        (,, uint256 no) = _pencairanDariVA(SIDIK, va2, 50 ether); // cadangan menunjuk rekening virtual lain

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(MitraCair.TanpaCadangan.selector, no));
        mitra.kembalikan(no);
    }

    function test_kembalikan_onlyOnceAndNotAfterSettle() public {
        (,, uint256[] memory nos) = _buatPencairan(2, 1 ether);
        vm.prank(operator);
        mitra.kembalikan(nos[0]);
        _selesaikan1(nos[1], BUKTI);

        vm.startPrank(operator);
        vm.expectRevert(abi.encodeWithSelector(MitraCair.SudahTuntas.selector, nos[0]));
        mitra.kembalikan(nos[0]); // dua kali
        vm.expectRevert(abi.encodeWithSelector(MitraCair.SudahTuntas.selector, nos[1]));
        mitra.kembalikan(nos[1]); // sesudah selesai
        vm.stopPrank();

        uint256[] memory satu = new uint256[](1);
        satu[0] = nos[0];
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(MitraCair.SudahTuntas.selector, nos[0]));
        mitra.selesaikan(satu, new bytes32[](1)); // selesai sesudah dikembalikan
    }

    // ------------------------------------------------------------------
    // Baca: statusPenerima, statusBanyak, vaBerisi
    // ------------------------------------------------------------------

    function test_statusPenerima_unknownAddress_isEmpty() public {
        MitraCair.StatusPenerima memory st = mitra.statusPenerima(orangLain);
        assertEq(st.rekening, bytes32(0));
        assertEq(st.bank, "");
        assertEq(st.akhiran, "");
        assertEq(st.saldo, 0);
        assertFalse(st.adaPencairan);
        assertEq(st.no, 0);
        assertEq(st.pencairan.jumlah, 0);
        assertEq(st.bankTujuan, "");
        assertEq(st.akhiranTujuan, "");

        token.faucet(orangLain, 3 ether); // alamat biasa: hanya saldo yang tampil
        assertEq(mitra.statusPenerima(orangLain).saldo, 3 ether);
    }

    function test_statusPenerima_virtualAccountLifecycle() public {
        (bytes32 id, address va) = _daftar(SIDIK, cadangan);
        token.faucet(va, 165 ether);

        // Sebelum disapu: saldo tampil, belum ada pencairan
        MitraCair.StatusPenerima memory st = mitra.statusPenerima(va);
        assertEq(st.rekening, id);
        assertEq(st.bank, "BRI");
        assertEq(st.akhiran, "7781");
        assertEq(st.saldo, 165 ether);
        assertFalse(st.adaPencairan);
        assertEq(st.bankTujuan, "");

        // Sesudah disapu: saldo 0, pencairan diproses ke rekening bank
        uint256 no = mitra.sapu(id);
        st = mitra.statusPenerima(va);
        assertEq(st.saldo, 0);
        assertTrue(st.adaPencairan);
        assertEq(st.no, no);
        assertEq(uint8(st.pencairan.tahap), uint8(MitraCair.Tahap.Diproses));
        assertEq(st.pencairan.jumlah, 165 ether);
        assertEq(st.pencairan.dari, va);
        assertEq(st.bankTujuan, "BRI");
        assertEq(st.akhiranTujuan, "7781");

        // Sesudah tuntas: nomor referensi bank tampil
        vm.warp(block.timestamp + 1 hours);
        _selesaikan1(no, BUKTI);
        st = mitra.statusPenerima(va);
        assertEq(uint8(st.pencairan.tahap), uint8(MitraCair.Tahap.Selesai));
        assertEq(st.pencairan.bukti, BUKTI);
        assertEq(st.pencairan.selesai, _now());
    }

    function test_statusPenerima_plainHolderAfterCairkan() public {
        token.faucet(anak, 26 ether);
        (uint256 deadline, uint8 v, bytes32 r, bytes32 s) = _permit(26 ether);
        vm.prank(anak);
        mitra.cairkan(SIDIK, "BRI", "7781", 26 ether, deadline, v, r, s);

        MitraCair.StatusPenerima memory st = mitra.statusPenerima(anak);
        assertEq(st.rekening, bytes32(0), "bukan rekening virtual");
        assertEq(st.bank, "", "data VA kosong untuk alamat biasa");
        assertTrue(st.adaPencairan);
        assertEq(st.pencairan.dari, anak);
        assertEq(st.bankTujuan, "BRI");
        assertEq(st.akhiranTujuan, "7781");
    }

    function test_statusPenerima_showsLatestPencairan() public {
        (bytes32 id, address va) = _daftar(SIDIK, cadangan);
        token.faucet(va, 10 ether);
        mitra.sapu(id);
        token.faucet(va, 4 ether);
        uint256 kedua = mitra.sapu(id);

        MitraCair.StatusPenerima memory st = mitra.statusPenerima(va);
        assertEq(st.no, kedua);
        assertEq(st.pencairan.jumlah, 4 ether);
    }

    function test_statusBanyak_matchesIndividualStatus() public {
        (bytes32[] memory ids, address[] memory vas) = _daftarVa(2);
        token.faucet(vas[0], 5 ether);
        mitra.sapu(ids[0]);
        token.faucet(vas[1], 6 ether);
        token.faucet(anak, 7 ether);

        address[] memory daftar = new address[](4);
        daftar[0] = vas[0];
        daftar[1] = vas[1];
        daftar[2] = anak;
        daftar[3] = orangLain;
        MitraCair.StatusPenerima[] memory st = mitra.statusBanyak(daftar);

        assertEq(st.length, 4);
        for (uint256 i; i < 4; i++) {
            assertEq(abi.encode(st[i]), abi.encode(mitra.statusPenerima(daftar[i])));
        }
        assertTrue(st[0].adaPencairan);
        assertEq(st[1].saldo, 6 ether);
        assertEq(st[2].saldo, 7 ether);
        assertFalse(st[3].adaPencairan);
    }

    function test_vaBerisi_filtersByBalanceAndRange() public {
        (bytes32[] memory ids, address[] memory vas) = _daftarVa(5);
        token.faucet(vas[1], 1 ether);
        token.faucet(vas[3], 1 ether);

        bytes32[] memory semua = mitra.vaBerisi(0, 5);
        assertEq(semua.length, 2);
        assertEq(semua[0], ids[1]);
        assertEq(semua[1], ids[3]);

        bytes32[] memory sebagian = mitra.vaBerisi(2, 5);
        assertEq(sebagian.length, 1);
        assertEq(sebagian[0], ids[3]);

        assertEq(mitra.vaBerisi(0, 100).length, 2, "batas atas dipotong ke jumlah rekening");
        assertEq(mitra.vaBerisi(4, 2).length, 0, "rentang terbalik -> kosong");
        assertEq(mitra.vaBerisi(10, 20).length, 0, "di luar jumlah rekening -> kosong");

        // Sesudah disapu, tidak lagi dianggap berisi
        mitra.sapu(ids[1]);
        bytes32[] memory sisa = mitra.vaBerisi(0, 5);
        assertEq(sisa.length, 1);
        assertEq(sisa[0], ids[3]);
    }

    // ------------------------------------------------------------------
    // Token: domain izin yang dipakai aplikasi web
    // ------------------------------------------------------------------

    function test_token_permitDomain() public view {
        (bytes1 fields, string memory name, string memory version, uint256 chainId, address kontrak,,) =
            token.eip712Domain();
        assertEq(fields, bytes1(0x0f));
        assertEq(name, "Testnet Rupiah");
        assertEq(version, "1");
        assertEq(chainId, block.chainid);
        assertEq(kontrak, address(token));
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("Testnet Rupiah"),
                keccak256("1"),
                block.chainid,
                address(token)
            )
        );
        assertEq(token.DOMAIN_SEPARATOR(), domain);
    }

    // ------------------------------------------------------------------
    // Pembantu
    // ------------------------------------------------------------------

    function _now() internal view returns (uint64) {
        return uint64(vm.getBlockTimestamp());
    }

    /// @dev Mendaftarkan rekening BRI ****7781 atas nama `pendaftar`.
    function _daftar(bytes32 sidik, address cad) internal returns (bytes32 id, address va) {
        vm.prank(pendaftar);
        (id, va) = mitra.daftar(sidik, "BRI", "7781", cad);
    }

    /// @dev `n` rekening virtual terdaftar (cadangan = `cadangan`), belum diisi.
    function _daftarVa(uint256 n) internal returns (bytes32[] memory ids, address[] memory vas) {
        ids = new bytes32[](n);
        vas = new address[](n);
        for (uint256 i; i < n; i++) {
            (ids[i], vas[i]) = _daftar(keccak256(abi.encode("va", i)), cadangan);
        }
    }

    /// @dev Satu rekening virtual diisi lalu disapu menjadi satu pencairan.
    function _pencairanDariVA(bytes32 sidik, address cad, uint256 jumlah)
        internal
        returns (bytes32 id, address va, uint256 no)
    {
        (id, va) = _daftar(sidik, cad);
        token.faucet(va, jumlah);
        no = mitra.sapu(id);
    }

    /// @dev `n` pencairan dari `n` rekening virtual: rekening ke-i diisi (i+1) * dasar lalu disapu, sehingga
    ///      pencairan nomor i berasal dari rekening ke-i. Hanya untuk dipanggil sekali per tes.
    function _buatPencairan(uint256 n, uint256 dasar)
        internal
        returns (bytes32[] memory ids, address[] memory vas, uint256[] memory nos)
    {
        (ids, vas) = _daftarVa(n);
        nos = new uint256[](n);
        for (uint256 i; i < n; i++) {
            token.faucet(vas[i], (i + 1) * dasar);
            nos[i] = mitra.sapu(ids[i]);
        }
    }

    function _selesaikan1(uint256 no, bytes32 bukti) internal {
        uint256[] memory nos = new uint256[](1);
        nos[0] = no;
        bytes32[] memory b = new bytes32[](1);
        b[0] = bukti;
        vm.prank(operator);
        mitra.selesaikan(nos, b);
    }

    /// @dev Data `n` rekening: sidik berbeda, bank BCA, akhiran 1234, cadangan berbeda.
    function _batch(uint256 n)
        internal
        pure
        returns (bytes32[] memory sidik, string[] memory bank, string[] memory akhiran, address[] memory cad)
    {
        sidik = new bytes32[](n);
        bank = new string[](n);
        akhiran = new string[](n);
        cad = new address[](n);
        for (uint256 i; i < n; i++) {
            sidik[i] = keccak256(abi.encode("sidik", i));
            bank[i] = "BCA";
            akhiran[i] = "1234";
            cad[i] = address(uint160(0x1000 + i));
        }
    }

    /// @dev Izin EIP-2612 dari `anak` untuk MitraCair, berlaku 1 jam.
    function _permit(uint256 jumlah) internal view returns (uint256 deadline, uint8 v, bytes32 r, bytes32 s) {
        return _permitUntil(jumlah, block.timestamp + 1 hours);
    }

    function _permitUntil(uint256 jumlah, uint256 batas)
        internal
        view
        returns (uint256 deadline, uint8 v, bytes32 r, bytes32 s)
    {
        deadline = batas;
        (v, r, s) = _signPermit(anakKey, anak, address(mitra), jumlah, deadline);
    }

    function _signPermit(uint256 key, address pemegang, address spender, uint256 jumlah, uint256 deadline)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, pemegang, spender, jumlah, token.nonces(pemegang), deadline));
        (v, r, s) = vm.sign(key, keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash)));
    }
}

/// @notice Pelaku acak untuk uji invarian MitraCair. Memanggil fungsi publik dengan urutan dan jumlah acak (daftar,
///         isi, sapu, cairkan, setor, selesaikan, kembalikan, waktu berjalan) sambil mencatat sendiri berapa token yang
///         dicetak dan dibakar. Panggilan yang seharusnya tidak pernah gagal dibiarkan gagal agar terdeteksi
///         (`fail-on-revert`); satu-satunya galat yang wajar, `TanpaCadangan`, ditangkap.
contract MitraCairHandler is Test {
    uint256 public constant MAKS_VA = 8;

    MockIDR public immutable token;
    MitraCair public immutable mitra;
    address public immutable operator;

    address[] internal _aktor;
    bytes32[] internal _ids;
    address[] internal _vas;

    uint256 public dicetak;
    uint256 public dibakar;
    uint256 public jumlahDisapu;
    uint256 public jumlahDicairkan;
    uint256 public jumlahSelesai;
    uint256 public jumlahDikembalikan;
    uint256 public jumlahDitolak; // kembalikan() yang ditolak karena TanpaCadangan

    constructor(MockIDR token_, MitraCair mitra_, address operator_) {
        token = token_;
        mitra = mitra_;
        operator = operator_;
        for (uint256 i; i < 4; i++) {
            _aktor.push(makeAddr(string.concat("aktor", vm.toString(i))));
        }
    }

    function aktorKe(uint256 i) external view returns (address) {
        return _aktor[i];
    }

    function jumlahAktor() external view returns (uint256) {
        return _aktor.length;
    }

    function idKe(uint256 i) external view returns (bytes32) {
        return _ids[i];
    }

    function vaKe(uint256 i) external view returns (address) {
        return _vas[i];
    }

    function jumlahVa() external view returns (uint256) {
        return _vas.length;
    }

    /// @dev Rekening virtual baru; seperempatnya tanpa cadangan (pengembaliannya akan ditolak).
    function daftar(uint256 pendaftarSeed, uint256 cadanganSeed) external {
        if (_ids.length >= MAKS_VA) return;
        address cad = cadanganSeed % 4 == 0 ? address(0) : _pilih(cadanganSeed);
        vm.prank(_pilih(pendaftarSeed));
        (bytes32 id, address va) = mitra.daftar(keccak256(abi.encode("va", _ids.length)), "BRI", "7781", cad);
        _ids.push(id);
        _vas.push(va);
    }

    function isiVa(uint256 idx, uint256 jumlah) external {
        if (_vas.length == 0) return;
        jumlah = bound(jumlah, 1, 1_000_000 ether);
        token.faucet(_vas[idx % _vas.length], jumlah);
        dicetak += jumlah;
    }

    function sapu(uint256 idx) external {
        if (_ids.length == 0) return;
        if (mitra.sapu(_ids[idx % _ids.length]) != type(uint256).max) jumlahDisapu++;
    }

    function sapuSemua() external {
        jumlahDisapu += mitra.sapuBanyak(_ids);
    }

    /// @dev Pemegang token mencairkan ke salah satu dari tiga rekening miliknya (dipakai ulang), dengan allowance.
    function cairkan(uint256 pemegangSeed, uint256 rekeningSeed, uint256 jumlah) external {
        address pemegang = _pilih(pemegangSeed);
        jumlah = bound(jumlah, 1, 1_000_000 ether);
        token.faucet(pemegang, jumlah);
        dicetak += jumlah;
        vm.startPrank(pemegang);
        token.approve(address(mitra), jumlah);
        mitra.cairkan(
            keccak256(abi.encode("cair", rekeningSeed % 3)), "GoPay", "", jumlah, 0, 0, bytes32(0), bytes32(0)
        );
        vm.stopPrank();
        jumlahDicairkan++;
    }

    /// @dev Setor ke rekening virtual yang sudah terdaftar dengan approve biasa.
    function setor(uint256 pemegangSeed, uint256 idx, uint256 jumlah) external {
        if (_ids.length == 0) return;
        address pemegang = _pilih(pemegangSeed);
        jumlah = bound(jumlah, 1, 1_000_000 ether);
        token.faucet(pemegang, jumlah);
        dicetak += jumlah;
        vm.startPrank(pemegang);
        token.approve(address(mitra), jumlah);
        mitra.setor(_ids[idx % _ids.length], jumlah);
        vm.stopPrank();
        jumlahDicairkan++;
    }

    /// @dev Operator menuntaskan 1..n pencairan dari antrean, mulai dari posisi acak.
    function selesaikan(uint256 seed, uint256 banyak) external {
        uint256[] memory antrean = mitra.antrean();
        if (antrean.length == 0) return;
        banyak = bound(banyak, 1, antrean.length);
        seed %= antrean.length;
        uint256[] memory nos = new uint256[](banyak);
        bytes32[] memory bukti = new bytes32[](banyak);
        uint256 total;
        for (uint256 i; i < banyak; i++) {
            nos[i] = antrean[(seed + i) % antrean.length];
            bukti[i] = keccak256(abi.encode("bukti", nos[i]));
            total += mitra.getPencairan(nos[i]).jumlah;
        }
        vm.prank(operator);
        mitra.selesaikan(nos, bukti);
        dibakar += total;
        jumlahSelesai += banyak;
    }

    function kembalikan(uint256 seed) external {
        uint256[] memory antrean = mitra.antrean();
        if (antrean.length == 0) return;
        uint256 no = antrean[seed % antrean.length];
        vm.prank(operator);
        try mitra.kembalikan(no) {
            jumlahDikembalikan++;
        } catch (bytes memory galat) {
            require(bytes4(galat) == MitraCair.TanpaCadangan.selector, "galat kembalikan tak terduga");
            jumlahDitolak++;
        }
    }

    function jalan(uint256 detik) external {
        vm.warp(block.timestamp + bound(detik, 1, 2 days));
    }

    function _pilih(uint256 seed) internal view returns (address) {
        return _aktor[seed % _aktor.length];
    }
}

/// @notice Invarian pembukuan MitraCair di bawah urutan panggilan acak: token di mitra selalu persis jumlah
///         pencairan yang masih diproses, tidak ada token yang bocor atau hilang, dan antrean operator konsisten.
/// forge-config: default.invariant.runs = 40
/// forge-config: default.invariant.depth = 120
/// forge-config: default.invariant.fail-on-revert = true
contract MitraCairInvariantTest is Test {
    MockIDR token;
    MitraCair mitra;
    MitraCairHandler handler;

    function setUp() public {
        token = new MockIDR();
        address pemilik = makeAddr("pemilik");
        address operator = makeAddr("operator");
        mitra = new MitraCair(token, pemilik);
        vm.prank(pemilik);
        mitra.aturOperator(operator, true);
        handler = new MitraCairHandler(token, mitra, operator);

        bytes4[] memory pilihan = new bytes4[](9);
        pilihan[0] = handler.daftar.selector;
        pilihan[1] = handler.isiVa.selector;
        pilihan[2] = handler.sapu.selector;
        pilihan[3] = handler.sapuSemua.selector;
        pilihan[4] = handler.cairkan.selector;
        pilihan[5] = handler.setor.selector;
        pilihan[6] = handler.selesaikan.selector;
        pilihan[7] = handler.kembalikan.selector;
        pilihan[8] = handler.jalan.selector;
        targetContract(address(handler)); // hanya pelaku, bukan token atau mitra langsung
        targetSelector(FuzzSelector({addr: address(handler), selectors: pilihan}));
    }

    /// @dev Token di mitra = jumlah semua pencairan yang masih Diproses.
    function invariant_mitraHoldsExactlyTheOpenRequests() public view {
        uint256 terbuka;
        uint256 n = mitra.jumlahPencairan();
        for (uint256 i; i < n; i++) {
            MitraCair.Pencairan memory p = mitra.getPencairan(i);
            if (p.tahap == MitraCair.Tahap.Diproses) terbuka += p.jumlah;
        }
        assertEq(token.balanceOf(address(mitra)), terbuka);
    }

    function invariant_supplyIsMintedMinusBurned() public view {
        assertEq(token.totalSupply(), handler.dicetak() - handler.dibakar());
    }

    /// @dev Semua token ada di mitra, di dompet pelaku, atau di rekening virtual; tidak ada yang bocor ke tempat lain.
    function invariant_noTokenLeaksOutsideKnownAddresses() public view {
        uint256 total = token.balanceOf(address(mitra));
        for (uint256 i; i < handler.jumlahAktor(); i++) {
            total += token.balanceOf(handler.aktorKe(i));
        }
        for (uint256 i; i < handler.jumlahVa(); i++) {
            total += token.balanceOf(handler.vaKe(i));
        }
        assertEq(total, token.totalSupply());
    }

    /// @dev Awal antrean selalu persis pencairan pertama yang masih diproses (atau akhir daftar jika tidak ada).
    function invariant_queueStartIsFirstOpenRequest() public view {
        uint256 n = mitra.jumlahPencairan();
        uint256 pertama = n;
        for (uint256 i; i < n; i++) {
            if (mitra.getPencairan(i).tahap == MitraCair.Tahap.Diproses) {
                pertama = i;
                break;
            }
        }
        assertEq(mitra.antreanMulai(), pertama);
    }

    /// @dev antrean() = 20 pencairan Diproses pertama, berurutan naik.
    function invariant_antreanListsOpenRequestsInOrder() public view {
        uint256[] memory antrean = mitra.antrean();
        uint256 n = mitra.jumlahPencairan();
        uint256 k;
        for (uint256 i; i < n && k < mitra.MAKS_BATCH(); i++) {
            if (mitra.getPencairan(i).tahap == MitraCair.Tahap.Diproses) {
                assertEq(antrean[k], i);
                k++;
            }
        }
        assertEq(antrean.length, k);
    }

    /// @dev Yang masih diproses belum punya waktu selesai atau bukti; yang sudah tuntas punya waktu selesai yang wajar,
    ///      dan yang Selesai punya nomor referensi bank. Jumlahnya tidak pernah nol.
    function invariant_closedRequestsHaveSettlementData() public view {
        uint256 n = mitra.jumlahPencairan();
        for (uint256 i; i < n; i++) {
            MitraCair.Pencairan memory p = mitra.getPencairan(i);
            assertGt(p.jumlah, 0);
            if (p.tahap == MitraCair.Tahap.Diproses) {
                assertEq(p.selesai, 0);
                assertEq(p.bukti, bytes32(0));
            } else {
                assertGe(p.selesai, p.diminta);
                assertGt(p.selesai, 0);
                if (p.tahap == MitraCair.Tahap.Selesai) assertTrue(p.bukti != bytes32(0));
                else assertEq(p.bukti, bytes32(0));
            }
        }
    }

    /// @dev Peta rekening ↔ alamat setoran selalu konsisten.
    function invariant_virtualAddressMapIsConsistent() public view {
        for (uint256 i; i < handler.jumlahVa(); i++) {
            bytes32 id = handler.idKe(i);
            address va = handler.vaKe(i);
            assertEq(mitra.rekeningDariVA(va), id);
            assertEq(mitra.getRekening(id).va, va);
            assertEq(mitra.alamatVA(id), va);
        }
    }
}
