// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {FaraidLib} from "../src/FaraidLib.sol";
import {MockIDR} from "../src/MockIDR.sol";
import {PusakaCore} from "../src/PusakaCore.sol";

/// @notice Tes alur yang sama untuk kedua model: brankas (PusakaVault) dan dompet pewaris lewat EIP-7702
///         (PusakaWallet). Keluarga yang dipakai adalah kasus demo K01.
abstract contract PusakaFlowBase is Test {
    uint32 constant INACTIVITY = 10 minutes;
    uint32 constant CHALLENGE = 20 seconds;
    uint256 constant HARTA = 120_000_000 ether; // Rp120 jt
    bytes32 constant AKTA = keccak256("akta-kematian.pdf");

    // EIP-712 persis seperti yang dibangun PusakaCore (domain Pusaka v1, verifyingContract = alamat yang menjalankan kode)
    bytes32 constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 constant CHECKIN_TYPEHASH = keccak256("KabarHidup(string pesan,uint64 waktu)");
    bytes32 constant ATTEST_TYPEHASH = keccak256("KonfirmasiWafat(address saksi,bytes32 bukti,uint256 putaran)");

    MockIDR token;
    PusakaCore subject; // brankas atau dompet pewaris yang sedang dites
    address pewaris; // pemilik `subject`
    uint256 pewarisKey; // kunci pribadi `pewaris`, untuk kabar hidup bertanda tangan; diisi oleh tiap model

    address istri = makeAddr("istri");
    address anakLk1 = makeAddr("anakLk1");
    address anakLk2 = makeAddr("anakLk2");
    address anakPr = makeAddr("anakPr");
    address ayah = makeAddr("ayah");
    address ibu = makeAddr("ibu");
    address saksi1;
    address saksi2;
    address saksi3;
    // Saksi menandatangani, relayer mengirim: kunci saksi dipakai untuk attestDeathFor()
    uint256 saksi1Key;
    uint256 saksi2Key;
    uint256 saksi3Key;
    address masjid = makeAddr("masjid");
    address orangLain = makeAddr("orangLain");

    constructor() {
        (saksi1, saksi1Key) = makeAddrAndKey("saksi1");
        (saksi2, saksi2Key) = makeAddrAndKey("saksi2");
        (saksi3, saksi3Key) = makeAddrAndKey("saksi3");
    }

    function setUp() public virtual {
        token = new MockIDR();
        _deployInfrastructure();
        subject = _create(_heirsK01(), _witnesses(), _noBequests(), _config());
        _fund(HARTA);
    }

    // ------------------------------------------------------------------
    // Diisi oleh tiap model
    // ------------------------------------------------------------------

    function _deployInfrastructure() internal virtual;

    /// @dev Membuat brankas/dompet baru dan mengisi `pewaris` dengan pemiliknya.
    function _create(
        PusakaCore.Heir[] memory heirs,
        address[] memory witnesses,
        PusakaCore.Bequest[] memory bequests,
        PusakaCore.Config memory cfg
    ) internal virtual returns (PusakaCore);

    /// @dev Menambah harta `subject` lewat jalur normal pewaris.
    function _fund(uint256 amount) internal virtual;

    /// @dev Pewaris memakai sebagian hartanya semasa hidup.
    function _spend(uint256 amount) internal virtual;

    /// @dev Pewaris memakai dompet/brankasnya lewat jalur yang dihitung sebagai bukti hidup
    ///      (dompet: execute() dengan satu transfer token · brankas: penarikan). Selalu terkirim dari `pewaris`.
    function _ownerActivity() internal virtual;

    // ------------------------------------------------------------------
    // Alur utama: saksi → masa sanggah → pembagian
    // ------------------------------------------------------------------

    function test_flow_witnessesThenFinalize_K01() public {
        vm.prank(saksi1);
        subject.attestDeath(AKTA);
        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(uint8(s.status), uint8(PusakaCore.Status.Active), "1 saksi belum cukup");
        assertEq(s.attestations, 1);

        vm.prank(saksi2);
        subject.attestDeath(AKTA);
        s = subject.getSummary();
        assertEq(uint8(s.status), uint8(PusakaCore.Status.Triggered), "2 saksi -> DIPICU");
        assertEq(uint8(s.triggerReason), uint8(PusakaCore.TriggerReason.Witnesses));
        assertEq(s.challengeEndsAt, vm.getBlockTimestamp() + CHALLENGE);

        // Masa sanggah belum habis
        vm.warp(vm.getBlockTimestamp() + CHALLENGE - 1);
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.TooEarly.selector, s.challengeEndsAt));
        subject.finalize();

        // Masa sanggah habis; siapa pun boleh membagikan
        vm.warp(vm.getBlockTimestamp() + 1);
        vm.prank(orangLain);
        subject.finalize();

        assertEq(token.balanceOf(istri), 15_000_000 ether, "istri");
        assertEq(token.balanceOf(anakLk1), 26_000_000 ether, "anak lk 1");
        assertEq(token.balanceOf(anakLk2), 26_000_000 ether, "anak lk 2");
        assertEq(token.balanceOf(anakPr), 13_000_000 ether, "anak pr");
        assertEq(token.balanceOf(ayah), 20_000_000 ether, "ayah");
        assertEq(token.balanceOf(ibu), 20_000_000 ether, "ibu");
        assertEq(token.balanceOf(address(subject)), 0, "harta habis dibagikan");

        s = subject.getSummary();
        assertEq(uint8(s.status), uint8(PusakaCore.Status.Distributed));
        assertEq(s.distributedTotal, HARTA);

        // Tidak bisa dibagikan dua kali
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.WrongStatus.selector, PusakaCore.Status.Distributed));
        subject.finalize();
    }

    function test_finalize_emitsEvents() public {
        _triggerByWitnesses();
        vm.warp(vm.getBlockTimestamp() + CHALLENGE);

        vm.expectEmit(address(subject));
        emit PusakaCore.Distributed(address(token), HARTA, 0);
        vm.expectEmit(address(subject));
        emit PusakaCore.ShareSent(address(token), istri, FaraidLib.Relation.Wife, 15_000_000 ether);
        subject.finalize();
    }

    // ------------------------------------------------------------------
    // Urutan KHI: harta bersama → wasiat → faraid
    // ------------------------------------------------------------------

    /// @notice Rp300 jt, seluruhnya harta bersama, wakaf masjid 1/5. Istri menerima 150 jt (harta bersama) lebih
    ///         dulu, masjid 30 jt, lalu 120 jt sisanya dibagi faraid persis seperti K01.
    function test_estate_jointPropertyAndBequest() public {
        PusakaCore.Config memory cfg = _config();
        cfg.jointProperty = FaraidLib.Frac(1, 1);
        PusakaCore.Bequest[] memory wasiat = new PusakaCore.Bequest[](1);
        wasiat[0] = PusakaCore.Bequest(masjid, FaraidLib.Frac(1, 5));
        subject = _create(_heirsK01(), _witnesses(), wasiat, cfg);
        _fund(300_000_000 ether);

        PusakaCore.Preview memory p = subject.preview();
        assertEq(p.jointAmount, 150_000_000 ether, "harta bersama");
        assertEq(p.bequests[0].amount, 30_000_000 ether, "wakaf");
        assertEq(p.faraidPool, 120_000_000 ether, "dibagi faraid");
        assertEq(p.heirs[0].jointAmount, 150_000_000 ether, "harta bersama milik istri");
        assertEq(p.heirs[0].faraidAmount, 15_000_000 ether, "faraid istri");

        _triggerByWitnesses();
        vm.warp(vm.getBlockTimestamp() + CHALLENGE);
        vm.expectEmit(address(subject));
        emit PusakaCore.JointShareSent(address(token), istri, 150_000_000 ether);
        vm.expectEmit(address(subject));
        emit PusakaCore.BequestSent(address(token), masjid, 30_000_000 ether);
        subject.finalize();

        assertEq(token.balanceOf(istri), 165_000_000 ether, "istri: 150 harta bersama + 15 faraid");
        assertEq(token.balanceOf(masjid), 30_000_000 ether, "wakaf masjid");
        assertEq(token.balanceOf(anakLk1), 26_000_000 ether, "anak lk 1");
        assertEq(token.balanceOf(anakLk2), 26_000_000 ether, "anak lk 2");
        assertEq(token.balanceOf(anakPr), 13_000_000 ether, "anak pr");
        assertEq(token.balanceOf(ayah), 20_000_000 ether, "ayah");
        assertEq(token.balanceOf(ibu), 20_000_000 ether, "ibu");
        assertEq(token.balanceOf(address(subject)), 0);

        // Setelah dibagikan, rincian tetap bisa dibaca layar
        p = subject.preview();
        assertEq(p.balance, 300_000_000 ether);
        assertEq(p.heirs[1].faraidAmount, 26_000_000 ether);
    }

    /// @notice Pewaris perempuan: suami menerima separuh harta bersama, lalu 1/4 warisan karena ada anak;
    ///         sisanya anak laki-laki 2 : anak perempuan 1.
    function test_estate_femaleDeceased_husbandWithJointProperty() public {
        address suami = makeAddr("suami");
        // Suami sengaja bukan di indeks 0: sisa pembulatan masuk ke indeks 0 dan bisa menutupi salah hitung di sana
        PusakaCore.Heir[] memory heirs = new PusakaCore.Heir[](3);
        heirs[0] = PusakaCore.Heir(anakLk1, FaraidLib.Relation.Son);
        heirs[1] = PusakaCore.Heir(anakPr, FaraidLib.Relation.Daughter);
        heirs[2] = PusakaCore.Heir(suami, FaraidLib.Relation.Husband);
        PusakaCore.Config memory cfg = _config();
        cfg.deceasedMale = false;
        cfg.jointProperty = FaraidLib.Frac(1, 2);
        subject = _create(heirs, _witnesses(), _noBequests(), cfg);
        _fund(200_000_000 ether);

        // Harta bersama 100 jt, separuhnya (50 jt) milik suami. Warisan 150 jt: suami 1/4 = 37,5 jt, anak 75 jt : 37,5 jt
        PusakaCore.Preview memory p = subject.preview();
        assertEq(p.jointAmount, 50_000_000 ether, "harta bersama");
        assertEq(p.faraidPool, 150_000_000 ether, "dibagi faraid");
        assertEq(p.heirs[2].jointAmount, 50_000_000 ether);
        assertEq(p.heirs[2].faraidAmount, 37_500_000 ether);
        assertEq(p.heirs[0].faraidAmount, 75_000_000 ether);
        assertEq(p.heirs[0].jointAmount + p.heirs[1].jointAmount, 0, "hanya pasangan yang mendapat harta bersama");

        _triggerByWitnesses();
        vm.warp(vm.getBlockTimestamp() + CHALLENGE);
        vm.expectEmit(address(subject));
        emit PusakaCore.JointShareSent(address(token), suami, 50_000_000 ether);
        subject.finalize();

        assertEq(token.balanceOf(suami), 87_500_000 ether, "suami: 50 harta bersama + 37,5 faraid");
        assertEq(token.balanceOf(anakLk1), 75_000_000 ether);
        assertEq(token.balanceOf(anakPr), 37_500_000 ether);
        assertEq(token.balanceOf(address(subject)), 0);
    }

    /// @notice Tanpa pasangan (hanya anak): tidak ada bagian harta bersama dan rincian tetap terbaca.
    function test_noSpouse_onlyChildren() public {
        PusakaCore.Heir[] memory heirs = new PusakaCore.Heir[](2);
        heirs[0] = PusakaCore.Heir(anakLk1, FaraidLib.Relation.Son);
        heirs[1] = PusakaCore.Heir(anakPr, FaraidLib.Relation.Daughter);
        subject = _create(heirs, _witnesses(), _noBequests(), _config());
        _fund(90_000_000 ether);

        PusakaCore.Preview memory p = subject.preview();
        assertEq(p.jointAmount, 0);
        assertEq(p.heirs.length, 2);
        assertEq(p.heirs[0].faraidAmount, 60_000_000 ether, "anak laki-laki 2/3");
        assertEq(p.heirs[1].faraidAmount, 30_000_000 ether, "anak perempuan 1/3");
        assertEq(p.heirs[0].jointAmount + p.heirs[1].jointAmount, 0);

        _triggerByWitnesses();
        vm.warp(vm.getBlockTimestamp() + CHALLENGE);
        subject.finalize();
        assertEq(token.balanceOf(anakLk1), 60_000_000 ether);
        assertEq(token.balanceOf(anakPr), 30_000_000 ether);
        assertEq(token.balanceOf(address(subject)), 0);
    }

    /// @notice Urutan ahli waris di daftar tidak mengubah bagian siapa pun. Sisa pembulatan masuk ke indeks 0 dan bisa
    ///         menutupi salah hitung di sana, jadi K01 dicoba juga dengan urutan dibalik (ibu di indeks 0).
    function test_heirOrder_doesNotChangeShares() public {
        PusakaCore.Heir[] memory asli = _heirsK01();
        PusakaCore.Heir[] memory terbalik = new PusakaCore.Heir[](asli.length);
        for (uint256 i; i < asli.length; i++) {
            terbalik[i] = asli[asli.length - 1 - i];
        }
        subject = _create(terbalik, _witnesses(), _noBequests(), _config());
        _fund(HARTA);

        _triggerByWitnesses();
        vm.warp(vm.getBlockTimestamp() + CHALLENGE);
        subject.finalize();

        assertEq(token.balanceOf(istri), 15_000_000 ether, "istri");
        assertEq(token.balanceOf(anakLk1), 26_000_000 ether, "anak lk 1");
        assertEq(token.balanceOf(anakLk2), 26_000_000 ether, "anak lk 2");
        assertEq(token.balanceOf(anakPr), 13_000_000 ether, "anak pr");
        assertEq(token.balanceOf(ayah), 20_000_000 ether, "ayah");
        assertEq(token.balanceOf(ibu), 20_000_000 ether, "ibu");
    }

    /// @notice Tanpa anak: ibu 1/3, ayah sisanya 2/3 (ayah dan ibu berbeda bagian, tidak seperti K01).
    function test_parentsOnly_motherThirdFatherRest() public {
        PusakaCore.Heir[] memory heirs = new PusakaCore.Heir[](2);
        heirs[0] = PusakaCore.Heir(ibu, FaraidLib.Relation.Mother);
        heirs[1] = PusakaCore.Heir(ayah, FaraidLib.Relation.Father);
        subject = _create(heirs, _witnesses(), _noBequests(), _config());
        _fund(90_000_000 ether);

        _triggerByWitnesses();
        vm.warp(vm.getBlockTimestamp() + CHALLENGE);
        subject.finalize();

        assertEq(token.balanceOf(ibu), 30_000_000 ether, "ibu 1/3");
        assertEq(token.balanceOf(ayah), 60_000_000 ether, "ayah sisanya");
        assertEq(token.balanceOf(address(subject)), 0);
    }

    // ------------------------------------------------------------------
    // Alur tidak aktif
    // ------------------------------------------------------------------

    function test_flow_inactivity() public {
        uint64 readyAt = subject.getSummary().inactivityReadyAt;

        vm.warp(readyAt - 1);
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.TooEarly.selector, readyAt));
        subject.triggerByInactivity();

        vm.warp(readyAt);
        vm.prank(orangLain);
        subject.triggerByInactivity();
        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(uint8(s.status), uint8(PusakaCore.Status.Triggered));
        assertEq(uint8(s.triggerReason), uint8(PusakaCore.TriggerReason.Inactivity));

        vm.warp(vm.getBlockTimestamp() + CHALLENGE);
        subject.finalize();
        assertEq(token.balanceOf(anakLk1), 26_000_000 ether);
    }

    function test_heartbeat_resetsInactivityTimer() public {
        vm.warp(vm.getBlockTimestamp() + INACTIVITY - 1);
        vm.prank(pewaris);
        subject.heartbeat();

        vm.warp(vm.getBlockTimestamp() + INACTIVITY - 1);
        uint64 readyAt = subject.getSummary().inactivityReadyAt;
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.TooEarly.selector, readyAt));
        subject.triggerByInactivity();
    }

    // ------------------------------------------------------------------
    // Pembatalan lewat "Saya masih hidup"
    // ------------------------------------------------------------------

    function test_heartbeat_cancelsTriggerAndResetsAttestations() public {
        _triggerByWitnesses();
        vm.warp(vm.getBlockTimestamp() + CHALLENGE - 1);

        vm.prank(pewaris);
        subject.heartbeat();
        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(uint8(s.status), uint8(PusakaCore.Status.Active), "kembali AKTIF");
        assertEq(s.attestations, 0, "konfirmasi direset");
        assertEq(s.challengeEndsAt, 0);
        (, bool[] memory attested) = subject.getWitnesses();
        assertFalse(attested[0] || attested[1] || attested[2]);

        // Saksi yang sama boleh mengonfirmasi lagi, dan alurnya bisa diulang sampai selesai
        _triggerByWitnesses();
        vm.warp(vm.getBlockTimestamp() + CHALLENGE);
        subject.finalize();
        assertEq(token.balanceOf(ibu), 20_000_000 ether);
    }

    function test_heartbeat_clearsPartialAttestations() public {
        vm.prank(saksi1);
        subject.attestDeath(AKTA);
        vm.prank(pewaris);
        subject.heartbeat();
        assertEq(subject.getSummary().attestations, 0);

        // Satu konfirmasi baru tidak cukup, karena konfirmasi lama sudah hangus
        vm.prank(saksi2);
        subject.attestDeath(AKTA);
        assertEq(uint8(subject.status()), uint8(PusakaCore.Status.Active));
    }

    function test_heartbeat_afterChallengeOver_reverts() public {
        _triggerByWitnesses();
        vm.warp(vm.getBlockTimestamp() + CHALLENGE);
        vm.prank(pewaris);
        vm.expectRevert(PusakaCore.ChallengeOver.selector);
        subject.heartbeat();
    }

    function test_heartbeat_afterDistributed_reverts() public {
        _triggerByWitnesses();
        vm.warp(vm.getBlockTimestamp() + CHALLENGE);
        subject.finalize();
        vm.prank(pewaris);
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.WrongStatus.selector, PusakaCore.Status.Distributed));
        subject.heartbeat();
    }

    // ------------------------------------------------------------------
    // Hak akses dan status
    // ------------------------------------------------------------------

    function test_onlyOwner_heartbeat() public {
        vm.prank(orangLain);
        vm.expectRevert(PusakaCore.NotOwner.selector);
        subject.heartbeat();
    }

    function test_onlyWitness() public {
        vm.prank(pewaris);
        vm.expectRevert(PusakaCore.NotWitness.selector);
        subject.attestDeath(AKTA);

        vm.prank(istri);
        vm.expectRevert(PusakaCore.NotWitness.selector);
        subject.attestDeath(AKTA);
    }

    function test_witnessCannotAttestTwice() public {
        vm.startPrank(saksi1);
        subject.attestDeath(AKTA);
        vm.expectRevert(PusakaCore.AlreadyAttested.selector);
        subject.attestDeath(AKTA);
        vm.stopPrank();
    }

    function test_attestDeath_emitsEvidenceHash() public {
        vm.expectEmit(address(subject));
        emit PusakaCore.DeathAttested(saksi1, AKTA, 1);
        vm.prank(saksi1);
        subject.attestDeath(AKTA);
    }

    function test_thirdWitnessAfterTrigger_reverts() public {
        _triggerByWitnesses();
        vm.prank(saksi3);
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.WrongStatus.selector, PusakaCore.Status.Triggered));
        subject.attestDeath(AKTA);
    }

    function test_triggerByInactivity_onlyWhenActive() public {
        _triggerByWitnesses();
        vm.warp(vm.getBlockTimestamp() + INACTIVITY);
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.WrongStatus.selector, PusakaCore.Status.Triggered));
        subject.triggerByInactivity();
    }

    // ------------------------------------------------------------------
    // Pembulatan
    // ------------------------------------------------------------------

    /// @notice Harta 100 wei tidak habis dibagi 120: sisa pembulatan masuk ke ahli waris pertama (istri).
    function test_roundingDust_goesToFirstHeir() public {
        _spend(HARTA - 100);
        _triggerByWitnesses();
        vm.warp(vm.getBlockTimestamp() + CHALLENGE);
        subject.finalize();

        // 100 × 1/8 = 12,5 → 12; 100 × 13/60 = 21,6 → 21 (×2); 100 × 13/120 = 10,8 → 10; 100 × 1/6 = 16,6 → 16 (×2)
        // Terkirim 12 + 42 + 10 + 32 = 96, sisa 4 wei → istri
        assertEq(token.balanceOf(istri), 16);
        assertEq(token.balanceOf(anakLk1), 21);
        assertEq(token.balanceOf(anakPr), 10);
        assertEq(token.balanceOf(ayah), 16);
        assertEq(token.balanceOf(address(subject)), 0);
    }

    /// @notice Saldo hanya 5 wei: bagian anak perempuan, ayah, dan ibu membulat ke nol dan dilewati tanpa transfer;
    ///         tiap anak laki-laki 1 wei, sisa 3 wei ke istri.
    function test_roundingDust_zeroSharesAreSkipped() public {
        _spend(HARTA - 5);
        _triggerByWitnesses();
        vm.warp(vm.getBlockTimestamp() + CHALLENGE);
        vm.recordLogs();
        subject.finalize();

        // Hanya tiga transfer sungguhan (istri, dua anak laki-laki); bagian nol tidak memicu transfer token
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 transfers;
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].emitter == address(token) && logs[i].topics[0] == IERC20.Transfer.selector) transfers++;
        }
        assertEq(transfers, 3, "tanpa transfer bernilai nol");

        assertEq(token.balanceOf(istri), 3);
        assertEq(token.balanceOf(anakLk1), 1);
        assertEq(token.balanceOf(anakLk2), 1);
        assertEq(token.balanceOf(anakPr), 0);
        assertEq(token.balanceOf(ayah), 0);
        assertEq(token.balanceOf(ibu), 0);
        assertEq(token.balanceOf(address(subject)), 0);
        assertEq(uint8(subject.status()), uint8(PusakaCore.Status.Distributed));
    }

    /// @notice Harta sudah habis dipakai semasa hidup: pembagian tetap selesai (semua bagian nol), tidak macet.
    function test_finalize_emptyEstate_stillCompletes() public {
        _spend(HARTA);
        _triggerByWitnesses();
        vm.warp(vm.getBlockTimestamp() + CHALLENGE);

        vm.expectEmit(address(subject));
        emit PusakaCore.Distributed(address(token), 0, 0);
        subject.finalize();

        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(uint8(s.status), uint8(PusakaCore.Status.Distributed));
        assertEq(s.distributedTotal, 0);
        assertEq(token.balanceOf(istri) + token.balanceOf(anakLk1) + token.balanceOf(ibu), 0);
    }

    /// @notice Saldo berapa pun: total terkirim = saldo, tidak ada yang tertinggal.
    function testFuzz_finalize_sendsWholeBalance(uint256 extra) public {
        extra = bound(extra, 0, 1_000_000_000 ether);
        token.faucet(address(subject), extra); // transfer langsung juga ikut dibagikan
        _triggerByWitnesses();
        vm.warp(vm.getBlockTimestamp() + CHALLENGE);
        subject.finalize();

        uint256 received = token.balanceOf(istri) + token.balanceOf(anakLk1) + token.balanceOf(anakLk2)
            + token.balanceOf(anakPr) + token.balanceOf(ayah) + token.balanceOf(ibu);
        assertEq(received, HARTA + extra);
        assertEq(token.balanceOf(address(subject)), 0);
        assertEq(token.balanceOf(anakLk1), token.balanceOf(anakLk2), "anak lk sama");
    }

    // ------------------------------------------------------------------
    // Fungsi baca
    // ------------------------------------------------------------------

    function test_preview() public view {
        PusakaCore.Preview memory p = subject.preview();
        assertEq(p.balance, HARTA);
        assertEq(p.jointAmount, 0);
        assertEq(p.faraidPool, HARTA);
        assertEq(p.flags, 0);
        assertEq(p.bequests.length, 0);
        assertEq(p.heirs.length, 6);
        assertEq(p.heirs[0].faraidAmount, 15_000_000 ether);
        assertEq(p.heirs[1].wallet, anakLk1);
        assertEq(uint8(p.heirs[1].relation), uint8(FaraidLib.Relation.Son));
        assertEq(p.heirs[1].num, 13);
        assertEq(p.heirs[1].den, 60);
        assertEq(p.heirs[1].faraidAmount, 26_000_000 ether);
        assertEq(p.heirs[3].num, 13);
        assertEq(p.heirs[3].den, 120);
    }

    function test_getSummary() public {
        vm.prank(saksi1);
        subject.attestDeath(AKTA);

        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(s.owner, pewaris);
        assertEq(s.token, address(token));
        assertEq(uint8(s.status), uint8(PusakaCore.Status.Active));
        assertEq(s.balance, HARTA);
        assertEq(s.timestamp, vm.getBlockTimestamp());
        assertEq(s.inactivityReadyAt, s.lastHeartbeat + INACTIVITY);
        assertEq(s.attestations, 1);
        assertEq(s.witnessCount, 3);
        assertEq(s.heirCount, 6);
        assertEq(s.config.witnessThreshold, 2);
        assertEq(s.config.challengePeriod, CHALLENGE);
        assertTrue(s.config.deceasedMale);
    }

    function test_getFamily() public view {
        FaraidLib.Family memory f = subject.getFamily();
        assertTrue(f.deceasedMale);
        assertEq(f.wives, 1);
        assertEq(f.sons, 2);
        assertEq(f.daughters, 1);
        assertTrue(f.father && f.mother);
    }

    /// @notice Pengaturan yang dipasang terbaca persis: token, wasiat, dan konfigurasi.
    function test_getTokensBequestsAndConfig() public {
        PusakaCore.Config memory cfg = _config();
        cfg.jointProperty = FaraidLib.Frac(1, 4);
        cfg.raddToSpouse = true;
        PusakaCore.Bequest[] memory wasiat = new PusakaCore.Bequest[](2);
        wasiat[0] = PusakaCore.Bequest(masjid, FaraidLib.Frac(1, 10));
        wasiat[1] = PusakaCore.Bequest(orangLain, FaraidLib.Frac(1, 5));
        subject = _create(_heirsK01(), _witnesses(), wasiat, cfg);

        address[] memory tokens = subject.getTokens();
        assertEq(tokens.length, 1);
        assertEq(tokens[0], address(token));

        PusakaCore.Bequest[] memory b = subject.getBequests();
        assertEq(b.length, 2);
        assertEq(b[0].to, masjid);
        assertEq(b[0].share.num, 1);
        assertEq(b[0].share.den, 10);
        assertEq(b[1].to, orangLain);
        assertEq(b[1].share.num, 1);
        assertEq(b[1].share.den, 5);

        PusakaCore.Config memory c = subject.getConfig();
        assertTrue(c.deceasedMale);
        assertEq(c.siblings, 0);
        assertFalse(c.otherRelatives);
        assertTrue(c.raddToSpouse);
        assertEq(c.inactivityPeriod, INACTIVITY);
        assertEq(c.challengePeriod, CHALLENGE);
        assertEq(c.witnessThreshold, 2);
        assertEq(c.jointProperty.num, 1);
        assertEq(c.jointProperty.den, 4);
    }

    // ------------------------------------------------------------------
    // Bukti hidup: tombol, aktivitas pewaris, dan ringkasan
    // ------------------------------------------------------------------

    function test_getSummary_tracksProofViaAndRound() public {
        // Pemasangan baru belum punya bukti hidup selain pemasangan itu sendiri
        subject = _create(_heirsK01(), _witnesses(), _noBequests(), _config());
        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(s.lastProofVia, 0, "pemasangan");
        assertEq(s.round, 1);

        _fund(10 ether);
        uint256 putaran = subject.getSummary().round;

        _warpBy(10);
        vm.prank(pewaris);
        subject.heartbeat();
        s = subject.getSummary();
        assertEq(s.lastProofVia, 1, "tombol");
        assertEq(s.round, putaran + 1);

        _warpBy(10);
        uint64 waktu = _now();
        bytes memory sig = _checkInSig(waktu);
        subject.checkIn(waktu, sig);
        s = subject.getSummary();
        assertEq(s.lastProofVia, 2, "tanda tangan");
        assertEq(s.round, putaran + 2);

        _warpBy(10);
        _ownerActivity();
        s = subject.getSummary();
        assertEq(s.lastProofVia, 3, "aktivitas pewaris");
        assertEq(s.round, putaran + 3);
    }

    function test_heartbeat_emitsHeartbeatViaButton() public {
        _warpBy(30);
        uint64 sekarang = _now();
        vm.expectEmit(address(subject));
        emit PusakaCore.Heartbeat(sekarang, 1);
        vm.prank(pewaris);
        subject.heartbeat();

        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(s.lastHeartbeat, sekarang);
        assertEq(s.lastProofVia, 1);
    }

    /// @notice Memakai dompet/brankas seperti biasa sudah cukup sebagai bukti hidup: tanpa menekan tombol apa pun.
    function test_activity_countsAsProofOfLife() public {
        vm.prank(saksi1);
        subject.attestDeath(AKTA);
        _warpBy(INACTIVITY / 2);
        uint64 sekarang = _now();
        uint256 putaran = subject.getSummary().round;

        vm.expectEmit(address(subject));
        emit PusakaCore.Heartbeat(sekarang, 3);
        _ownerActivity();

        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(uint8(s.status), uint8(PusakaCore.Status.Active));
        assertEq(s.lastHeartbeat, sekarang);
        assertEq(s.lastProofVia, 3, "aktivitas pewaris");
        assertEq(s.attestations, 0, "konfirmasi saksi hangus");
        assertEq(s.round, putaran + 1);

        // Timer dihitung dari aktivitas itu
        vm.warp(sekarang + INACTIVITY - 1);
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.TooEarly.selector, sekarang + INACTIVITY));
        subject.triggerByInactivity();
    }

    // ------------------------------------------------------------------
    // Kabar hidup bertanda tangan (checkIn): pewaris menandatangani, relayer mengirim
    // ------------------------------------------------------------------

    function test_checkIn_relayedSignature_refreshesTimer() public {
        vm.prank(saksi1);
        subject.attestDeath(AKTA); // konfirmasi sebagian
        _warpBy(INACTIVITY / 2);
        uint64 waktu = _now();
        uint256 putaran = subject.getSummary().round;
        bytes memory sig = _checkInSig(waktu);

        vm.expectEmit(address(subject));
        emit PusakaCore.Heartbeat(waktu, 2);
        vm.prank(orangLain); // relayer, bukan pewaris
        subject.checkIn(waktu, sig);

        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(uint8(s.status), uint8(PusakaCore.Status.Active));
        assertEq(s.lastHeartbeat, waktu);
        assertEq(s.inactivityReadyAt, waktu + INACTIVITY);
        assertEq(s.lastProofVia, 2, "tanda tangan");
        assertEq(s.attestations, 0, "konfirmasi lama hangus");
        assertEq(s.round, putaran + 1);
        (, bool[] memory attested) = subject.getWitnesses();
        assertFalse(attested[0] || attested[1] || attested[2]);

        // Satu konfirmasi baru tidak cukup, karena konfirmasi lama sudah hangus
        vm.prank(saksi2);
        subject.attestDeath(AKTA);
        assertEq(uint8(subject.status()), uint8(PusakaCore.Status.Active));

        // Timer baru dihitung dari waktu tanda tangan
        vm.warp(waktu + INACTIVITY - 1);
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.TooEarly.selector, waktu + INACTIVITY));
        subject.triggerByInactivity();
    }

    function test_checkIn_replay_reverts() public {
        _warpBy(1 minutes);
        uint64 waktu = _now();
        bytes memory sig = _checkInSig(waktu);
        subject.checkIn(waktu, sig);

        // Tanda tangan yang sama tidak bisa dipakai lagi: di detik yang sama maupun sesudahnya
        vm.expectRevert(PusakaCore.StaleCheckIn.selector);
        subject.checkIn(waktu, sig);
        _warpBy(5 minutes);
        vm.expectRevert(PusakaCore.StaleCheckIn.selector);
        subject.checkIn(waktu, sig);
    }

    function test_checkIn_notNewerThanLastProof_reverts() public {
        _warpBy(1 minutes);
        vm.prank(pewaris);
        subject.heartbeat(); // bukti hidup terakhir: sekarang
        uint64 terakhir = subject.getSummary().lastHeartbeat;
        bytes memory sama = _checkInSig(terakhir);
        bytes memory lebihLama = _checkInSig(terakhir - 30);

        // Sama dengan atau lebih lama dari bukti hidup terakhir
        vm.expectRevert(PusakaCore.StaleCheckIn.selector);
        subject.checkIn(terakhir, sama);
        vm.expectRevert(PusakaCore.StaleCheckIn.selector);
        subject.checkIn(terakhir - 30, lebihLama);

        // Satu detik lebih baru sudah cukup
        _warpBy(1);
        bytes memory baru = _checkInSig(terakhir + 1);
        subject.checkIn(terakhir + 1, baru);
        assertEq(subject.getSummary().lastHeartbeat, terakhir + 1);
    }

    /// @notice Kabar yang ditandatangani lalu tersalip aktivitas pewaris yang lebih baru tidak berlaku lagi.
    function test_checkIn_overtakenByLaterActivity_reverts() public {
        _warpBy(1 minutes);
        uint64 waktu = _now();
        bytes memory sig = _checkInSig(waktu);

        _warpBy(30);
        _ownerActivity();
        vm.expectRevert(PusakaCore.StaleCheckIn.selector);
        subject.checkIn(waktu, sig);
    }

    /// @notice Jam perangkat pewaris boleh lebih cepat dari jam blok (MAX_CLOCK_SKEW). Waktunya disimpan apa adanya.
    function test_checkIn_futureDated_storedAsSigned() public {
        _warpBy(1 minutes);
        uint64 waktu = _now() + 5 minutes;
        bytes memory sig = _checkInSig(waktu);

        vm.expectEmit(address(subject));
        emit PusakaCore.Heartbeat(waktu, 2); // yang dicatat adalah waktu yang disimpan
        subject.checkIn(waktu, sig);

        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(s.lastHeartbeat, waktu, "tidak dipotong ke jam blok");
        assertGt(s.lastHeartbeat, s.timestamp, "lebih depan dari jam blok");
        assertEq(s.inactivityReadyAt, waktu + INACTIVITY);
        assertEq(s.lastProofVia, 2);

        // Tanda tangan yang sama langsung ditolak, juga setelah jam blok melewati waktunya
        vm.expectRevert(PusakaCore.StaleCheckIn.selector);
        subject.checkIn(waktu, sig);
        vm.warp(waktu + 1);
        vm.expectRevert(PusakaCore.StaleCheckIn.selector);
        subject.checkIn(waktu, sig);
    }

    function test_checkIn_skewBoundary() public {
        _warpBy(1 minutes);
        assertEq(subject.MAX_CLOCK_SKEW(), 10 minutes);
        uint64 batas = _now() + subject.MAX_CLOCK_SKEW();
        bytes memory terlaluDepan = _checkInSig(batas + 1);
        bytes memory tepatDiBatas = _checkInSig(batas);

        vm.expectRevert(PusakaCore.CheckInFromFuture.selector);
        subject.checkIn(batas + 1, terlaluDepan);

        subject.checkIn(batas, tepatDiBatas);
        assertEq(subject.getSummary().lastHeartbeat, batas);
    }

    /// @notice Bukti hidup yang bertanggal di depan jam blok tidak pernah dimundurkan oleh tombol atau aktivitas
    ///         yang terjadi sesudahnya, tetapi sumber bukti dan putaran saksi tetap diperbarui.
    function test_heartbeat_afterFutureCheckIn_neverMovesBackwards() public {
        _warpBy(1 minutes);
        uint64 waktu = _now() + 5 minutes;
        bytes memory sig = _checkInSig(waktu);
        subject.checkIn(waktu, sig);
        vm.prank(saksi1);
        subject.attestDeath(AKTA); // konfirmasi sebagian, setelah kabar hidup
        uint256 putaran = subject.getSummary().round;

        _warpBy(1 minutes); // jam blok masih sebelum `waktu`
        vm.expectEmit(address(subject));
        emit PusakaCore.Heartbeat(waktu, 1); // yang dicatat tetap waktu terdepan
        vm.prank(pewaris);
        subject.heartbeat();

        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(s.lastHeartbeat, waktu, "tidak mundur");
        assertEq(s.lastProofVia, 1, "sumber bukti hidup tetap diperbarui");
        assertEq(s.attestations, 0, "konfirmasi saksi tetap hangus");
        assertEq(s.round, putaran + 1);

        // Setelah jam blok melewati waktu itu, bukti hidup maju lagi mengikuti jam blok
        vm.warp(waktu + 30);
        vm.prank(pewaris);
        subject.heartbeat();
        assertEq(subject.getSummary().lastHeartbeat, waktu + 30);
    }

    function test_activity_afterFutureCheckIn_neverMovesBackwards() public {
        _warpBy(1 minutes);
        uint64 waktu = _now() + 5 minutes;
        bytes memory sig = _checkInSig(waktu);
        subject.checkIn(waktu, sig);
        vm.prank(saksi1);
        subject.attestDeath(AKTA);
        uint256 putaran = subject.getSummary().round;

        _warpBy(1 minutes);
        vm.expectEmit(address(subject));
        emit PusakaCore.Heartbeat(waktu, 3);
        _ownerActivity();

        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(s.lastHeartbeat, waktu, "tidak mundur");
        assertEq(s.lastProofVia, 3, "sumber bukti hidup tetap diperbarui");
        assertEq(s.attestations, 0, "konfirmasi saksi tetap hangus");
        assertEq(s.round, putaran + 1);

        // Timer tetap dihitung dari waktu terdepan itu
        vm.warp(waktu + INACTIVITY - 1);
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.TooEarly.selector, waktu + INACTIVITY));
        subject.triggerByInactivity();
    }

    function test_checkIn_nonOwnerSignature_reverts() public {
        _warpBy(1 minutes);
        uint64 waktu = _now();
        (, uint256 penipuKey) = makeAddrAndKey("penipu");
        bytes memory dariPenipu = _signCheckIn(address(subject), penipuKey, waktu);
        bytes memory dariSaksi = _signCheckIn(address(subject), saksi1Key, waktu);
        bytes memory untukWaktuLain = _checkInSig(waktu - 1); // tanda tangan pewaris, tetapi atas waktu yang lain

        vm.expectRevert(PusakaCore.BadSignature.selector);
        subject.checkIn(waktu, dariPenipu);
        vm.expectRevert(PusakaCore.BadSignature.selector);
        subject.checkIn(waktu, dariSaksi);
        vm.expectRevert(PusakaCore.BadSignature.selector);
        subject.checkIn(waktu, untukWaktuLain);

        // Tanda tangan rusak: kosong, terlalu pendek, atau nol semua
        vm.expectRevert(PusakaCore.BadSignature.selector);
        subject.checkIn(waktu, "");
        vm.expectRevert(PusakaCore.BadSignature.selector);
        subject.checkIn(waktu, hex"1234");
        vm.expectRevert(PusakaCore.BadSignature.selector);
        subject.checkIn(waktu, new bytes(65));

        PusakaCore.Summary memory s = subject.getSummary();
        assertLt(s.lastHeartbeat, waktu, "tidak ada yang berubah");
        assertEq(uint8(s.status), uint8(PusakaCore.Status.Active));
    }

    /// @notice Tanda tangan terikat pada alamat kontrak dan rantai: tidak bisa dipakai di brankas/dompet lain.
    function test_checkIn_signatureBoundToContractAndChain() public {
        _warpBy(1 minutes);
        uint64 waktu = _now() + 1;
        PusakaCore pertama = subject;
        bytes memory sig = _checkInSig(waktu);

        // Brankas/dompet lain (model brankas: pewaris yang sama, jadi hanya alamat kontrak yang membedakan)
        PusakaCore kedua = _create(_heirsK01(), _witnesses(), _noBequests(), _config());
        vm.expectRevert(PusakaCore.BadSignature.selector);
        kedua.checkIn(waktu, sig);

        // Rantai lain
        uint256 rantai = vm.getChainId();
        vm.chainId(rantai + 1);
        vm.expectRevert(PusakaCore.BadSignature.selector);
        pertama.checkIn(waktu, sig);

        // Di tempat aslinya tetap sah
        vm.chainId(rantai);
        pertama.checkIn(waktu, sig);
        assertEq(pertama.getSummary().lastHeartbeat, waktu);
    }

    // ------------------------------------------------------------------
    // Kabar hidup bertanda tangan selama masa sanggah
    // ------------------------------------------------------------------

    function test_checkIn_duringChallenge_signedAfterTrigger_cancelsTrigger() public {
        _triggerByWitnesses();
        _warpBy(CHALLENGE - 5);
        uint64 waktu = _now(); // ditandatangani setelah pemicu
        bytes memory sig = _checkInSig(waktu);

        vm.expectEmit(address(subject));
        emit PusakaCore.TriggerCancelled(waktu);
        vm.expectEmit(address(subject));
        emit PusakaCore.Heartbeat(waktu, 2);
        vm.prank(orangLain);
        subject.checkIn(waktu, sig);

        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(uint8(s.status), uint8(PusakaCore.Status.Active), "kembali AKTIF");
        assertEq(uint8(s.triggerReason), uint8(PusakaCore.TriggerReason.None));
        assertEq(s.triggeredAt, 0);
        assertEq(s.challengeEndsAt, 0);
        assertEq(s.attestations, 0, "konfirmasi direset");
        assertEq(s.lastHeartbeat, waktu);
        assertEq(s.lastProofVia, 2);

        vm.expectRevert(abi.encodeWithSelector(PusakaCore.WrongStatus.selector, PusakaCore.Status.Active));
        subject.finalize();

        // Saksi yang sama boleh mengonfirmasi lagi, dan alurnya bisa diulang sampai selesai
        _triggerByWitnesses();
        _warpBy(CHALLENGE);
        subject.finalize();
        assertEq(token.balanceOf(ibu), 20_000_000 ether);
    }

    function test_checkIn_duringChallenge_signedBeforeTrigger_reverts() public {
        _warpBy(1 minutes);
        uint64 waktu = _now();
        bytes memory sig = _checkInSig(waktu); // pewaris menandatangani, tetapi belum terkirim
        _warpBy(5);
        _triggerByWitnesses(); // saksi memicu setelahnya

        vm.expectRevert(PusakaCore.StaleCheckIn.selector);
        subject.checkIn(waktu, sig);
        assertEq(uint8(subject.status()), uint8(PusakaCore.Status.Triggered), "pemicu tetap berjalan");
    }

    /// @notice Batasnya tepat di detik pemicu: sebelum itu basi, pada detik itu dan sesudahnya sah.
    function test_checkIn_duringChallenge_boundaryAtTriggerTime() public {
        _warpBy(1 minutes);
        _triggerByWitnesses();
        uint64 dipicu = subject.getSummary().triggeredAt;
        bytes memory sebelum = _checkInSig(dipicu - 1);
        bytes memory tepat = _checkInSig(dipicu);

        vm.expectRevert(PusakaCore.StaleCheckIn.selector);
        subject.checkIn(dipicu - 1, sebelum);

        subject.checkIn(dipicu, tepat);
        assertEq(uint8(subject.status()), uint8(PusakaCore.Status.Active));
        assertEq(subject.getSummary().lastHeartbeat, dipicu);
    }

    function test_checkIn_afterChallengeOver_reverts() public {
        _triggerByWitnesses();
        _warpBy(CHALLENGE - 1); // masih di masa sanggah saat ditandatangani
        uint64 waktu = _now();
        bytes memory sig = _checkInSig(waktu);
        _warpBy(1); // masa sanggah habis sebelum terkirim

        vm.expectRevert(PusakaCore.ChallengeOver.selector);
        subject.checkIn(waktu, sig);

        // Pembagian tetap berjalan
        subject.finalize();
        assertEq(uint8(subject.status()), uint8(PusakaCore.Status.Distributed));
    }

    function test_checkIn_afterDistributed_reverts() public {
        _triggerByWitnesses();
        _warpBy(CHALLENGE);
        subject.finalize();
        _warpBy(1 minutes);
        uint64 waktu = _now();
        bytes memory sig = _checkInSig(waktu);

        vm.expectRevert(abi.encodeWithSelector(PusakaCore.WrongStatus.selector, PusakaCore.Status.Distributed));
        subject.checkIn(waktu, sig);
    }

    // ------------------------------------------------------------------
    // Konfirmasi wafat bertanda tangan (attestDeathFor): saksi menandatangani, relayer mengirim
    // ------------------------------------------------------------------

    function test_attestDeathFor_relayedSignaturesTrigger() public {
        bytes memory sig1 = _attestSig(saksi1Key, saksi1);
        bytes memory sig2 = _attestSig(saksi2Key, saksi2);

        vm.expectEmit(address(subject));
        emit PusakaCore.DeathAttested(saksi1, AKTA, 1);
        vm.prank(orangLain); // relayer, bukan saksi
        subject.attestDeathFor(saksi1, AKTA, sig1);
        assertEq(subject.getSummary().attestations, 1);
        assertEq(uint8(subject.status()), uint8(PusakaCore.Status.Active), "1 saksi belum cukup");
        (, bool[] memory attested) = subject.getWitnesses();
        assertTrue(attested[0]);
        assertFalse(attested[1]);

        uint64 sekarang = _now();
        vm.expectEmit(address(subject));
        emit PusakaCore.DeathAttested(saksi2, AKTA, 2);
        vm.expectEmit(address(subject));
        emit PusakaCore.Triggered(PusakaCore.TriggerReason.Witnesses, sekarang, sekarang + CHALLENGE);
        vm.prank(orangLain);
        subject.attestDeathFor(saksi2, AKTA, sig2);

        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(uint8(s.status), uint8(PusakaCore.Status.Triggered), "2 saksi -> DIPICU");
        assertEq(uint8(s.triggerReason), uint8(PusakaCore.TriggerReason.Witnesses));
        assertEq(s.challengeEndsAt, sekarang + CHALLENGE);

        _warpBy(CHALLENGE);
        subject.finalize();
        assertEq(token.balanceOf(istri), 15_000_000 ether);
        assertEq(token.balanceOf(ibu), 20_000_000 ether);
    }

    function test_attestDeathFor_signatureOfOldRound_reverts() public {
        bytes memory sebelumTombol = _attestSig(saksi1Key, saksi1);
        _warpBy(10);
        vm.prank(pewaris);
        subject.heartbeat(); // putaran berganti, konfirmasi lama hangus
        vm.expectRevert(PusakaCore.BadSignature.selector);
        subject.attestDeathFor(saksi1, AKTA, sebelumTombol);

        // Putaran juga berganti oleh kabar hidup bertanda tangan dan oleh aktivitas pewaris
        bytes memory sebelumKabar = _attestSig(saksi1Key, saksi1);
        _warpBy(10);
        uint64 waktu = _now();
        bytes memory kabar = _checkInSig(waktu);
        subject.checkIn(waktu, kabar);
        vm.expectRevert(PusakaCore.BadSignature.selector);
        subject.attestDeathFor(saksi1, AKTA, sebelumKabar);

        bytes memory sebelumAktivitas = _attestSig(saksi1Key, saksi1);
        _warpBy(10);
        _ownerActivity();
        vm.expectRevert(PusakaCore.BadSignature.selector);
        subject.attestDeathFor(saksi1, AKTA, sebelumAktivitas);

        // Tanda tangan untuk putaran sekarang sah
        bytes memory baru = _attestSig(saksi1Key, saksi1);
        subject.attestDeathFor(saksi1, AKTA, baru);
        assertEq(subject.getSummary().attestations, 1);
    }

    function test_attestDeathFor_nonWitness_reverts() public {
        uint256 putaran = subject.getSummary().round;
        (address asing, uint256 asingKey) = makeAddrAndKey("asing");
        bytes memory dariAsing = _signAttest(address(subject), asingKey, asing, AKTA, putaran);
        bytes memory dariPewaris = _signAttest(address(subject), pewarisKey, pewaris, AKTA, putaran);

        vm.expectRevert(PusakaCore.NotWitness.selector);
        subject.attestDeathFor(asing, AKTA, dariAsing);
        vm.expectRevert(PusakaCore.NotWitness.selector);
        subject.attestDeathFor(pewaris, AKTA, dariPewaris);
        // Bukan saksi ditolak lebih dulu, sebelum tanda tangannya diperiksa sama sekali (tanda tangan rusak pun sama)
        vm.expectRevert(PusakaCore.NotWitness.selector);
        subject.attestDeathFor(asing, AKTA, hex"1234");

        // Menyamar sebagai saksi dengan tanda tangan sendiri
        vm.expectRevert(PusakaCore.BadSignature.selector);
        subject.attestDeathFor(saksi1, AKTA, dariAsing);
        // Saksi lain tidak bisa menandatangani atas nama saksi ini
        bytes memory dariSaksi2 = _attestSig(saksi2Key, saksi1);
        vm.expectRevert(PusakaCore.BadSignature.selector);
        subject.attestDeathFor(saksi1, AKTA, dariSaksi2);

        assertEq(subject.getSummary().attestations, 0);
    }

    function test_attestDeathFor_sameWitnessTwice_reverts() public {
        bytes32 buktiLain = keccak256("bukti-lain");
        bytes memory sig = _attestSig(saksi1Key, saksi1);
        bytes memory sigLain = _signAttest(address(subject), saksi1Key, saksi1, buktiLain, subject.getSummary().round);

        subject.attestDeathFor(saksi1, AKTA, sig);

        // Tanda tangan yang sama dikirim ulang, atau tanda tangan baru dari saksi yang sama
        vm.expectRevert(PusakaCore.AlreadyAttested.selector);
        subject.attestDeathFor(saksi1, AKTA, sig);
        vm.expectRevert(PusakaCore.AlreadyAttested.selector);
        subject.attestDeathFor(saksi1, buktiLain, sigLain);
        vm.prank(saksi1);
        vm.expectRevert(PusakaCore.AlreadyAttested.selector);
        subject.attestDeath(AKTA);

        assertEq(subject.getSummary().attestations, 1);
    }

    function test_attestDeathFor_mixedWithDirectAttestDeath() public {
        // saksi1 langsung, saksi2 lewat tanda tangan
        vm.prank(saksi1);
        subject.attestDeath(AKTA);
        bytes memory sig2 = _attestSig(saksi2Key, saksi2);
        vm.prank(orangLain);
        subject.attestDeathFor(saksi2, AKTA, sig2);
        assertEq(uint8(subject.status()), uint8(PusakaCore.Status.Triggered));
        assertEq(subject.getSummary().attestations, 2);

        // Dibatalkan pewaris, lalu urutannya dibalik: saksi3 lewat tanda tangan, saksi1 langsung
        vm.prank(pewaris);
        subject.heartbeat();
        bytes memory sig3 = _attestSig(saksi3Key, saksi3);
        subject.attestDeathFor(saksi3, AKTA, sig3);
        assertEq(uint8(subject.status()), uint8(PusakaCore.Status.Active));
        vm.prank(saksi1);
        subject.attestDeath(AKTA);
        assertEq(uint8(subject.status()), uint8(PusakaCore.Status.Triggered));

        (, bool[] memory attested) = subject.getWitnesses();
        assertTrue(attested[0] && !attested[1] && attested[2]);
    }

    function test_attestDeathFor_evidenceHashIsSigned() public {
        bytes memory sig = _attestSig(saksi1Key, saksi1); // untuk AKTA
        vm.expectRevert(PusakaCore.BadSignature.selector);
        subject.attestDeathFor(saksi1, keccak256("bukti-lain"), sig);
    }

    function test_attestDeathFor_onlyWhenActive() public {
        bytes memory sig = _attestSig(saksi3Key, saksi3);
        _triggerByWitnesses();
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.WrongStatus.selector, PusakaCore.Status.Triggered));
        subject.attestDeathFor(saksi3, AKTA, sig);

        _warpBy(CHALLENGE);
        subject.finalize();
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.WrongStatus.selector, PusakaCore.Status.Distributed));
        subject.attestDeathFor(saksi3, AKTA, sig);
    }

    function test_attestDeathFor_signatureBoundToContract() public {
        PusakaCore pertama = subject;
        bytes memory sig = _attestSig(saksi1Key, saksi1);
        // Saksi yang sama di brankas/dompet lain; putaran dan bukti bisa saja sama
        PusakaCore kedua = _create(_heirsK01(), _witnesses(), _noBequests(), _config());
        vm.expectRevert(PusakaCore.BadSignature.selector);
        kedua.attestDeathFor(saksi1, AKTA, sig);

        pertama.attestDeathFor(saksi1, AKTA, sig);
        assertEq(pertama.getSummary().attestations, 1);
        assertEq(kedua.getSummary().attestations, 0);
    }

    // ------------------------------------------------------------------
    // EIP-712: domain dan bentuk typed data yang dipakai aplikasi web
    // ------------------------------------------------------------------

    function test_eip712Domain_describesSigningDomain() public {
        (
            bytes1 fields,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            bytes32 salt,
            uint256[] memory extensions
        ) = subject.eip712Domain();
        assertEq(fields, bytes1(0x0f), "nama, versi, chainId, verifyingContract");
        assertEq(name, "Pusaka");
        assertEq(version, "1");
        assertEq(chainId, block.chainid);
        assertEq(verifyingContract, address(subject), "alamat yang menjalankan kode");
        assertEq(salt, bytes32(0));
        assertEq(extensions.length, 0);

        // Domain mengikuti rantai tempat kontrak berjalan
        vm.chainId(1234);
        (,,, chainId,,,) = subject.eip712Domain();
        assertEq(chainId, 1234);
    }

    /// @notice Digest dari typed data JSON (format eth_signTypedData_v4, seperti yang ditandatangani aplikasi web)
    ///         dihitung cheatcode rujukan, lalu dibandingkan dengan rumus kontrak dan diterima kontrak.
    function test_typedData_matchesEip712JsonReference() public {
        uint64 waktu = _now() + 1;
        uint256 putaran = subject.getSummary().round;
        bytes32 rujukanKonfirmasi = vm.eip712HashTypedData(_jsonKonfirmasiWafat(saksi1, AKTA, putaran));
        bytes32 rujukanKabar = vm.eip712HashTypedData(_jsonKabarHidup(waktu));

        bytes32 strukKonfirmasi = keccak256(abi.encode(ATTEST_TYPEHASH, saksi1, AKTA, putaran));
        bytes32 strukKabar = keccak256(abi.encode(CHECKIN_TYPEHASH, keccak256("Saya masih hidup"), waktu));
        assertEq(rujukanKonfirmasi, _typedDataDigest(address(subject), strukKonfirmasi));
        assertEq(rujukanKabar, _typedDataDigest(address(subject), strukKabar));

        // Tanda tangan atas digest rujukan diterima kontrak (konfirmasi dulu: kabar hidup mengganti putaran)
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(saksi1Key, rujukanKonfirmasi);
        subject.attestDeathFor(saksi1, AKTA, abi.encodePacked(r, s, v));
        assertEq(subject.getSummary().attestations, 1);
        (v, r, s) = vm.sign(pewarisKey, rujukanKabar);
        subject.checkIn(waktu, abi.encodePacked(r, s, v));
        assertEq(subject.getSummary().lastHeartbeat, waktu);
    }

    // ------------------------------------------------------------------
    // Pembantu
    // ------------------------------------------------------------------

    function _now() internal view returns (uint64) {
        return uint64(vm.getBlockTimestamp());
    }

    function _warpBy(uint256 detik) internal {
        vm.warp(vm.getBlockTimestamp() + detik);
    }

    /// @dev Digest EIP-712 yang dibangun PusakaCore, dihitung ulang di sini dari rumus standar.
    function _typedDataDigest(address verifyingContract, bytes32 structHash) internal view returns (bytes32) {
        bytes32 domain = keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256("Pusaka"), keccak256("1"), block.chainid, verifyingContract)
        );
        return keccak256(abi.encodePacked("\x19\x01", domain, structHash));
    }

    function _signCheckIn(address target, uint256 key, uint64 waktu) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(CHECKIN_TYPEHASH, keccak256("Saya masih hidup"), waktu));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, _typedDataDigest(target, structHash));
        return abi.encodePacked(r, s, v);
    }

    function _signAttest(address target, uint256 key, address saksi, bytes32 bukti, uint256 putaran)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash = keccak256(abi.encode(ATTEST_TYPEHASH, saksi, bukti, putaran));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, _typedDataDigest(target, structHash));
        return abi.encodePacked(r, s, v);
    }

    /// @dev Kabar hidup pewaris untuk `subject`. Hitung tanda tangan SEBELUM vm.prank/vm.expectRevert: fungsi ini
    ///      tidak memanggil kontrak, tetapi _attestSig() memanggil subject.
    function _checkInSig(uint64 waktu) internal view returns (bytes memory) {
        return _signCheckIn(address(subject), pewarisKey, waktu);
    }

    /// @dev Konfirmasi wafat `saksi` untuk putaran saat ini di `subject`, dengan bukti AKTA.
    function _attestSig(uint256 key, address saksi) internal view returns (bytes memory) {
        return _signAttest(address(subject), key, saksi, AKTA, subject.getSummary().round);
    }

    function _jsonDomain() internal view returns (string memory) {
        return string.concat(
            '"domain":{"name":"Pusaka","version":"1","chainId":',
            vm.toString(block.chainid),
            ',"verifyingContract":"',
            vm.toString(address(subject)),
            '"}'
        );
    }

    function _jsonDomainTypes() internal pure returns (string memory) {
        return string.concat(
            '"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},',
            '{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}]'
        );
    }

    function _jsonKabarHidup(uint64 waktu) internal view returns (string memory) {
        return string.concat(
            '{"types":{',
            _jsonDomainTypes(),
            ',"KabarHidup":[{"name":"pesan","type":"string"},{"name":"waktu","type":"uint64"}]},',
            '"primaryType":"KabarHidup",',
            _jsonDomain(),
            ',"message":{"pesan":"Saya masih hidup","waktu":',
            vm.toString(waktu),
            "}}"
        );
    }

    function _jsonKonfirmasiWafat(address saksi, bytes32 bukti, uint256 putaran) internal view returns (string memory) {
        return string.concat(
            '{"types":{',
            _jsonDomainTypes(),
            ',"KonfirmasiWafat":[{"name":"saksi","type":"address"},{"name":"bukti","type":"bytes32"},',
            '{"name":"putaran","type":"uint256"}]},',
            '"primaryType":"KonfirmasiWafat",',
            _jsonDomain(),
            ',"message":{"saksi":"',
            vm.toString(saksi),
            '","bukti":"',
            vm.toString(bukti),
            '","putaran":',
            vm.toString(putaran),
            "}}"
        );
    }

    function _triggerByWitnesses() internal {
        vm.prank(saksi1);
        subject.attestDeath(AKTA);
        vm.prank(saksi2);
        subject.attestDeath(AKTA);
    }

    function _heirsK01() internal view returns (PusakaCore.Heir[] memory h) {
        h = new PusakaCore.Heir[](6);
        h[0] = PusakaCore.Heir(istri, FaraidLib.Relation.Wife);
        h[1] = PusakaCore.Heir(anakLk1, FaraidLib.Relation.Son);
        h[2] = PusakaCore.Heir(anakLk2, FaraidLib.Relation.Son);
        h[3] = PusakaCore.Heir(anakPr, FaraidLib.Relation.Daughter);
        h[4] = PusakaCore.Heir(ayah, FaraidLib.Relation.Father);
        h[5] = PusakaCore.Heir(ibu, FaraidLib.Relation.Mother);
    }

    function _witnesses() internal view returns (address[] memory w) {
        w = new address[](3);
        w[0] = saksi1;
        w[1] = saksi2;
        w[2] = saksi3;
    }

    function _noBequests() internal pure returns (PusakaCore.Bequest[] memory) {
        return new PusakaCore.Bequest[](0);
    }

    function _config() internal pure returns (PusakaCore.Config memory) {
        return PusakaCore.Config({
            deceasedMale: true,
            siblings: 0,
            otherRelatives: false,
            raddToSpouse: false,
            inactivityPeriod: INACTIVITY,
            challengePeriod: CHALLENGE,
            witnessThreshold: 2,
            jointProperty: FaraidLib.Frac(0, 1)
        });
    }
}
