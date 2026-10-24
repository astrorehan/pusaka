// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Vm} from "forge-std/Vm.sol";
import {FaraidLib} from "../src/FaraidLib.sol";
import {MitraCair} from "../src/MitraCair.sol";
import {MockIDR} from "../src/MockIDR.sol";
import {PusakaCore} from "../src/PusakaCore.sol";
import {PusakaWallet} from "../src/PusakaWallet.sol";
import {PusakaFlowBase} from "./PusakaFlowBase.sol";

/// @dev Token yang selalu gagal saat dikirim, untuk menguji bahwa satu token rusak tidak menghalangi yang lain.
contract BrokenToken is ERC20 {
    constructor() ERC20("Broken", "BRK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transfer(address, uint256) public pure override returns (bool) {
        revert("rusak");
    }
}

/// @dev Token yang `balanceOf`-nya sendiri selalu gagal, jadi saldonya tidak bisa dibaca sama sekali.
contract BrokenBalanceToken {
    function balanceOf(address) external pure returns (uint256) {
        revert("rusak");
    }
}

contract MockNFT is ERC721 {
    constructor() ERC721("Kaligrafi", "KLG") {}

    function safeMint(address to, uint256 id) external {
        _safeMint(to, id);
    }
}

/// @notice Model dompet: aturan warisan dipasang langsung di dompet pewaris lewat EIP-7702, tanpa memindahkan harta.
///         Semua tes alur di PusakaFlowBase ikut dijalankan untuk model ini.
contract PusakaWalletTest is PusakaFlowBase {
    PusakaWallet implementation;
    uint256 walletCount;

    function _deployInfrastructure() internal override {
        implementation = new PusakaWallet();
    }

    /// @dev Setiap pemasangan memakai dompet baru: delegasi EIP-7702 + setup() dari dompet itu sendiri.
    function _create(
        PusakaCore.Heir[] memory heirs,
        address[] memory witnesses,
        PusakaCore.Bequest[] memory bequests,
        PusakaCore.Config memory cfg
    ) internal override returns (PusakaCore) {
        return _createWith(_tokens(address(token)), heirs, witnesses, bequests, cfg);
    }

    function _createWith(
        address[] memory tokens,
        PusakaCore.Heir[] memory heirs,
        address[] memory witnesses,
        PusakaCore.Bequest[] memory bequests,
        PusakaCore.Config memory cfg
    ) internal returns (PusakaCore) {
        (pewaris, pewarisKey) = makeAddrAndKey(string.concat("dompet-pewaris-", vm.toString(++walletCount)));
        vm.signAndAttachDelegation(address(implementation), pewarisKey);
        vm.prank(pewaris);
        PusakaWallet(payable(pewaris)).setup(tokens, heirs, witnesses, bequests, cfg);
        return PusakaCore(pewaris);
    }

    /// @dev Harta tetap di dompet pewaris; tidak perlu setor ke mana pun.
    function _fund(uint256 amount) internal override {
        token.faucet(pewaris, amount);
    }

    /// @dev Pewaris memakai dompetnya seperti biasa.
    function _spend(uint256 amount) internal override {
        vm.prank(pewaris);
        token.transfer(orangLain, amount);
    }

    /// @dev Di dompet, bukti hidup lewat aktivitas = transaksi biasa lewat execute() (di sini: satu transfer tIDR).
    function _ownerActivity() internal override {
        PusakaWallet.Call[] memory calls = new PusakaWallet.Call[](1);
        calls[0] = _transferCall(orangLain, 1 ether);
        _execute(calls);
    }

    function _wallet() internal view returns (PusakaWallet) {
        return PusakaWallet(payable(pewaris));
    }

    // ------------------------------------------------------------------
    // Khusus dompet EIP-7702
    // ------------------------------------------------------------------

    function test_kind_andAssetsStayInOwnWallet() public view {
        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(s.kind, 2);
        assertEq(s.owner, pewaris, "pemiliknya dompet itu sendiri");
        assertEq(address(subject), pewaris, "kontraknya berjalan di alamat dompet pewaris");
        assertEq(token.balanceOf(pewaris), HARTA, "harta tetap di dompet pewaris");
    }

    function test_delegationIsInstalled() public view {
        // Kode dompet berisi penanda delegasi EIP-7702: 0xef0100 + alamat kontrak PusakaWallet
        assertEq(pewaris.code, abi.encodePacked(hex"ef0100", address(implementation)));
    }

    function test_ownerKeepsUsingWallet() public {
        _spend(20_000_000 ether);
        assertEq(subject.preview().balance, 100_000_000 ether, "yang dibagi adalah sisa harta saat wafat");

        _triggerByWitnesses();
        vm.warp(vm.getBlockTimestamp() + CHALLENGE);
        subject.finalize();
        assertEq(token.balanceOf(ibu), uint256(100_000_000 ether) / 6);
        assertEq(token.balanceOf(pewaris), 0);
    }

    function test_setup_onlyFromOwnWallet() public {
        (address korban, uint256 key) = makeAddrAndKey("korban");
        vm.signAndAttachDelegation(address(implementation), key);
        vm.prank(orangLain);
        vm.expectRevert(PusakaWallet.NotSelf.selector);
        PusakaWallet(payable(korban))
            .setup(_tokens(address(token)), _heirsK01(), _witnesses(), _noBequests(), _config());
    }

    function test_implementationItselfCannotBeSetUp() public {
        vm.expectRevert(PusakaWallet.NotSelf.selector);
        implementation.setup(_tokens(address(token)), _heirsK01(), _witnesses(), _noBequests(), _config());
        assertEq(uint8(implementation.status()), uint8(PusakaCore.Status.None));
        assertEq(implementation.preview().heirs.length, 0);
    }

    function test_setupTwice_reverts() public {
        vm.prank(pewaris);
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.WrongStatus.selector, PusakaCore.Status.Active));
        _wallet().setup(_tokens(address(token)), _heirsK01(), _witnesses(), _noBequests(), _config());
    }

    function test_cancelSetup_thenSetupAgain() public {
        vm.prank(saksi1);
        subject.attestDeath(AKTA);

        vm.prank(pewaris);
        _wallet().cancelSetup();
        assertEq(uint8(subject.status()), uint8(PusakaCore.Status.None));
        assertFalse(subject.isWitness(saksi1));
        assertEq(subject.getHeirs().length, 0);

        vm.prank(pewaris);
        _wallet().setup(_tokens(address(token)), _heirsK01(), _witnesses(), _noBequests(), _config());

        // Konfirmasi dari pengaturan lama hangus: satu konfirmasi baru belum memicu
        vm.prank(saksi2);
        subject.attestDeath(AKTA);
        assertEq(uint8(subject.status()), uint8(PusakaCore.Status.Active));
        vm.prank(saksi1);
        subject.attestDeath(AKTA);
        assertEq(uint8(subject.status()), uint8(PusakaCore.Status.Triggered));
    }

    function test_cancelSetup_onlyOwner() public {
        vm.prank(orangLain);
        vm.expectRevert(PusakaCore.NotOwner.selector);
        _wallet().cancelSetup();
    }

    function test_cancelSetup_notAfterTrigger() public {
        _triggerByWitnesses();
        vm.prank(pewaris);
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.WrongStatus.selector, PusakaCore.Status.Triggered));
        _wallet().cancelSetup();
    }

    function test_multipleTokens() public {
        MockIDR emas = new MockIDR();
        address[] memory tokens = new address[](2);
        tokens[0] = address(token);
        tokens[1] = address(emas);
        subject = _createWith(tokens, _heirsK01(), _witnesses(), _noBequests(), _config());
        token.faucet(pewaris, HARTA);
        emas.faucet(pewaris, 1200 ether);

        _triggerByWitnesses();
        vm.warp(vm.getBlockTimestamp() + CHALLENGE);
        subject.finalize();

        assertEq(token.balanceOf(anakLk1), 26_000_000 ether);
        assertEq(emas.balanceOf(anakLk1), 260 ether);
        assertEq(emas.balanceOf(anakPr), 130 ether);
        assertEq(emas.balanceOf(pewaris), 0);
    }

    function test_brokenToken_doesNotBlockOthers() public {
        BrokenToken rusak = new BrokenToken();
        address[] memory tokens = new address[](2);
        tokens[0] = address(token);
        tokens[1] = address(rusak);
        subject = _createWith(tokens, _heirsK01(), _witnesses(), _noBequests(), _config());
        token.faucet(pewaris, HARTA);
        rusak.mint(pewaris, 1200 ether);

        _triggerByWitnesses();
        vm.warp(vm.getBlockTimestamp() + CHALLENGE);
        vm.expectEmit(pewaris);
        emit PusakaCore.TransferFailed(address(rusak), istri, 150 ether);
        subject.finalize();

        assertEq(token.balanceOf(istri), 15_000_000 ether, "tIDR tetap dibagikan");
        assertEq(rusak.balanceOf(pewaris), 1200 ether, "token rusak tertinggal, tidak membatalkan semuanya");
        assertEq(uint8(subject.status()), uint8(PusakaCore.Status.Distributed));
    }

    /// @dev Pewaris menyimpan tIDR, token bermasalah, lalu emas, lalu semuanya dibagikan. Urutannya sengaja begitu:
    ///      token sesudah yang rusak juga harus tetap dibagikan.
    function _finalizeWithBadTokenInMiddle(address rusak) internal returns (MockIDR emas) {
        emas = new MockIDR();
        address[] memory tokens = new address[](3);
        tokens[0] = address(token);
        tokens[1] = rusak;
        tokens[2] = address(emas);
        subject = _createWith(tokens, _heirsK01(), _witnesses(), _noBequests(), _config());
        token.faucet(pewaris, HARTA);
        emas.faucet(pewaris, 1200 ether);

        _triggerByWitnesses();
        vm.warp(vm.getBlockTimestamp() + CHALLENGE);
        vm.expectEmit(pewaris);
        emit PusakaCore.TransferFailed(rusak, address(0), 0);
        subject.finalize();
    }

    function _assertGoodTokensDistributed(MockIDR emas) internal view {
        assertEq(uint8(subject.status()), uint8(PusakaCore.Status.Distributed));
        assertEq(token.balanceOf(istri), 15_000_000 ether, "token sebelum yang rusak dibagikan");
        assertEq(emas.balanceOf(anakLk1), 260 ether, "token sesudah yang rusak tetap dibagikan");
        assertEq(token.balanceOf(pewaris), 0);
        assertEq(emas.balanceOf(pewaris), 0);
    }

    /// @notice Token yang `balanceOf`-nya gagal dilewati dan dicatat; token lain di kiri-kanannya tetap dibagikan.
    function test_finalize_tokenWithRevertingBalanceOf_isSkipped() public {
        BrokenBalanceToken rusak = new BrokenBalanceToken();
        MockIDR emas = _finalizeWithBadTokenInMiddle(address(rusak));
        _assertGoodTokensDistributed(emas);
    }

    /// @notice Alamat tanpa kontrak (mis. salah ketik atau token milik rantai lain) juga dilewati. Tanpa pemeriksaan
    ///         kode, `try` tidak menangkap kegagalan membaca hasil dari alamat kosong sehingga finalize() membatalkan
    ///         seluruh pembagian dan harta terkunci selamanya.
    function test_finalize_tokenWithoutCode_isSkipped() public {
        address bukanToken = makeAddr("bukanToken");
        MockIDR emas = _finalizeWithBadTokenInMiddle(bukanToken);
        _assertGoodTokensDistributed(emas);
    }

    function test_setup_rejectsBadTokens() public {
        address[] memory six = new address[](6);
        for (uint256 i; i < 6; i++) {
            six[i] = address(new MockIDR());
        }
        _expectSetupRevert(six, abi.encodeWithSelector(PusakaCore.InvalidConfig.selector, uint8(8)));

        address[] memory dup = new address[](2);
        dup[0] = address(token);
        dup[1] = address(token);
        _expectSetupRevert(dup, abi.encodeWithSelector(PusakaCore.InvalidConfig.selector, uint8(8)));

        _expectSetupRevert(_tokens(address(0)), abi.encodeWithSelector(PusakaCore.InvalidConfig.selector, uint8(4)));
        _expectSetupRevert(new address[](0), abi.encodeWithSelector(PusakaCore.InvalidConfig.selector, uint8(8)));
    }

    // ------------------------------------------------------------------
    // Dompet tetap berfungsi normal setelah dipasang Pusaka
    // ------------------------------------------------------------------

    function test_stillReceivesMon() public {
        vm.deal(orangLain, 1 ether);
        vm.prank(orangLain);
        (bool ok,) = pewaris.call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(pewaris.balance, 1 ether);
    }

    function test_stillReceivesNft() public {
        MockNFT nft = new MockNFT();
        nft.safeMint(pewaris, 1);
        assertEq(nft.ownerOf(1), pewaris);
    }

    function test_signatureStillValid_ERC1271() public {
        bytes32 digest = keccak256("Saya pemilik dompet ini");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pewarisKey, digest);
        assertEq(_wallet().isValidSignature(digest, abi.encodePacked(r, s, v)), bytes4(0x1626ba7e));

        (, uint256 otherKey) = makeAddrAndKey("penipu");
        (v, r, s) = vm.sign(otherKey, digest);
        assertEq(_wallet().isValidSignature(digest, abi.encodePacked(r, s, v)), bytes4(0xffffffff));
    }

    // ------------------------------------------------------------------
    // execute(): transaksi biasa dari dompet = bukti hidup otomatis
    // ------------------------------------------------------------------

    function test_execute_tokenTransfer_countsAsProofOfLife() public {
        vm.prank(saksi1);
        subject.attestDeath(AKTA); // konfirmasi sebagian
        _warpBy(INACTIVITY / 2);
        uint64 sekarang = _now();
        uint256 putaran = subject.getSummary().round;
        PusakaWallet.Call[] memory calls = new PusakaWallet.Call[](1);
        calls[0] = _transferCall(orangLain, 20_000_000 ether);

        vm.expectEmit(pewaris);
        emit PusakaCore.Heartbeat(sekarang, 3);
        vm.prank(pewaris);
        bytes[] memory hasil = _wallet().execute(calls);

        assertEq(hasil.length, 1);
        assertTrue(abi.decode(hasil[0], (bool)), "transfer berhasil");
        assertEq(token.balanceOf(pewaris), 100_000_000 ether);
        assertEq(token.balanceOf(orangLain), 20_000_000 ether);
        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(uint8(s.status), uint8(PusakaCore.Status.Active));
        assertEq(s.lastHeartbeat, sekarang);
        assertEq(s.lastProofVia, 3, "aktivitas dompet");
        assertEq(s.attestations, 0, "konfirmasi saksi hangus");
        assertEq(s.round, putaran + 1);
    }

    /// @notice Beberapa panggilan dalam satu execute() tetap satu bukti hidup.
    function test_execute_batch_isOneProofOfLife() public {
        uint256 putaran = subject.getSummary().round;
        PusakaWallet.Call[] memory calls = new PusakaWallet.Call[](3);
        calls[0] = _transferCall(orangLain, 1_000_000 ether);
        calls[1] = _transferCall(masjid, 2_000_000 ether);
        calls[2] = _transferCall(istri, 3_000_000 ether);

        vm.recordLogs();
        _execute(calls);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        assertEq(_countLogs(logs, pewaris, PusakaCore.Heartbeat.selector), 1, "satu bukti hidup per execute");
        assertEq(subject.getSummary().round, putaran + 1);
        assertEq(token.balanceOf(orangLain), 1_000_000 ether);
        assertEq(token.balanceOf(masjid), 2_000_000 ether);
        assertEq(token.balanceOf(istri), 3_000_000 ether);
    }

    function test_execute_sendsMon() public {
        vm.deal(pewaris, 3 ether);
        PusakaWallet.Call[] memory calls = new PusakaWallet.Call[](1);
        calls[0] = PusakaWallet.Call({to: orangLain, value: 1 ether, data: ""});
        _execute(calls);

        assertEq(orangLain.balance, 1 ether);
        assertEq(pewaris.balance, 2 ether);
        assertEq(subject.getSummary().lastProofVia, 3);
    }

    /// @notice Dompet yang belum dipasangi aturan tetap dompet biasa: execute() jalan, tanpa bukti hidup apa pun.
    function test_execute_withoutRules_isPlainWallet() public {
        (address eoa, uint256 key) = makeAddrAndKey("dompet-polos");
        token.faucet(eoa, 10 ether);
        PusakaWallet.Call[] memory calls = new PusakaWallet.Call[](1);
        calls[0] = _transferCall(orangLain, 4 ether);

        vm.signAndAttachDelegation(address(implementation), key);
        vm.prank(eoa);
        PusakaWallet(payable(eoa)).execute(calls);

        assertEq(token.balanceOf(orangLain), 4 ether);
        assertEq(token.balanceOf(eoa), 6 ether);
        assertEq(uint8(PusakaCore(eoa).status()), uint8(PusakaCore.Status.None));
        assertEq(PusakaCore(eoa).getSummary().lastProofVia, 0);
    }

    function test_execute_duringChallenge_cancelsTrigger() public {
        _triggerByWitnesses();
        _warpBy(CHALLENGE - 1); // detik terakhir masa sanggah
        uint64 sekarang = _now();
        uint256 putaran = subject.getSummary().round;
        PusakaWallet.Call[] memory calls = new PusakaWallet.Call[](1);
        calls[0] = _transferCall(orangLain, 20_000_000 ether);

        vm.expectEmit(pewaris);
        emit PusakaCore.TriggerCancelled(sekarang);
        vm.expectEmit(pewaris);
        emit PusakaCore.Heartbeat(sekarang, 3);
        vm.prank(pewaris);
        _wallet().execute(calls);

        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(uint8(s.status), uint8(PusakaCore.Status.Active), "pemicu dibatalkan");
        assertEq(uint8(s.triggerReason), uint8(PusakaCore.TriggerReason.None));
        assertEq(s.triggeredAt, 0);
        assertEq(s.challengeEndsAt, 0);
        assertEq(s.attestations, 0);
        assertEq(s.lastHeartbeat, sekarang);
        assertEq(s.lastProofVia, 3);
        assertEq(s.round, putaran + 1);
        assertEq(token.balanceOf(orangLain), 20_000_000 ether, "transfernya tetap jalan");

        // Tidak bisa dibagikan, dan saksi harus mengonfirmasi ulang
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.WrongStatus.selector, PusakaCore.Status.Active));
        subject.finalize();
        _triggerByWitnesses();
        assertEq(uint8(subject.status()), uint8(PusakaCore.Status.Triggered));
    }

    /// @notice Setelah masa sanggah habis, execute() tetap berjalan (dompet tetap milik pewaris) tetapi tidak lagi
    ///         membatalkan pemicu, dan tidak pernah revert karenanya.
    function test_execute_afterChallenge_stillTransfers_butDoesNotCancel() public {
        _triggerByWitnesses();
        _warpBy(CHALLENGE); // detik pertama setelah masa sanggah
        PusakaCore.Summary memory sebelum = subject.getSummary();
        PusakaWallet.Call[] memory calls = new PusakaWallet.Call[](1);
        calls[0] = _transferCall(orangLain, 20_000_000 ether);

        vm.recordLogs();
        _execute(calls); // tidak revert
        Vm.Log[] memory logs = vm.getRecordedLogs();

        assertEq(_countLogs(logs, pewaris, PusakaCore.Heartbeat.selector), 0, "bukan bukti hidup");
        assertEq(_countLogs(logs, pewaris, PusakaCore.TriggerCancelled.selector), 0);
        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(uint8(s.status), uint8(PusakaCore.Status.Triggered), "pemicu tetap berjalan");
        assertEq(s.lastHeartbeat, sebelum.lastHeartbeat);
        assertEq(s.lastProofVia, sebelum.lastProofVia);
        assertEq(s.round, sebelum.round);
        assertEq(s.attestations, sebelum.attestations);
        assertEq(s.challengeEndsAt, sebelum.challengeEndsAt);
        assertEq(token.balanceOf(orangLain), 20_000_000 ether, "transfernya tetap jalan");

        // Pembagian tetap berjalan atas sisa harta
        subject.finalize();
        assertEq(uint8(subject.status()), uint8(PusakaCore.Status.Distributed));
        assertEq(token.balanceOf(ibu), uint256(100_000_000 ether) / 6);
    }

    function test_execute_afterDistributed_isPlainWalletUse() public {
        _triggerByWitnesses();
        _warpBy(CHALLENGE);
        subject.finalize();
        token.faucet(pewaris, 5 ether);
        PusakaWallet.Call[] memory calls = new PusakaWallet.Call[](1);
        calls[0] = _transferCall(orangLain, 5 ether);

        _execute(calls); // tidak revert

        assertEq(token.balanceOf(orangLain), 5 ether);
        assertEq(uint8(subject.status()), uint8(PusakaCore.Status.Distributed));
    }

    function test_execute_fromOtherAddress_reverts() public {
        PusakaWallet.Call[] memory calls = new PusakaWallet.Call[](1);
        calls[0] = _transferCall(orangLain, 1 ether);

        vm.prank(orangLain);
        vm.expectRevert(PusakaWallet.NotSelf.selector);
        _wallet().execute(calls);
        // Saksi dan ahli waris juga tidak bisa
        vm.prank(saksi1);
        vm.expectRevert(PusakaWallet.NotSelf.selector);
        _wallet().execute(calls);
        vm.prank(istri);
        vm.expectRevert(PusakaWallet.NotSelf.selector);
        _wallet().execute(calls);
        // Kontrak implementasinya sendiri juga tidak
        vm.expectRevert(PusakaWallet.NotSelf.selector);
        implementation.execute(calls);

        assertEq(token.balanceOf(orangLain), 0);
        assertEq(token.balanceOf(pewaris), HARTA);
    }

    function test_execute_failingCall_revertsWithCallFailed() public {
        uint256 putaran = subject.getSummary().round;
        PusakaWallet.Call[] memory calls = new PusakaWallet.Call[](2);
        calls[0] = _transferCall(orangLain, 1_000_000 ether); // berhasil
        calls[1] = _transferCall(orangLain, HARTA); // saldo tidak cukup setelah transfer pertama
        bytes memory sebab = abi.encodeWithSelector(
            IERC20Errors.ERC20InsufficientBalance.selector, pewaris, HARTA - 1_000_000 ether, HARTA
        );

        vm.prank(pewaris);
        vm.expectRevert(abi.encodeWithSelector(PusakaWallet.CallFailed.selector, uint256(1), sebab));
        _wallet().execute(calls);

        // Semuanya dibatalkan: transfer pertama dan bukti hidupnya
        assertEq(token.balanceOf(orangLain), 0);
        assertEq(token.balanceOf(pewaris), HARTA);
        assertEq(subject.getSummary().round, putaran);
    }

    function test_execute_callFailed_carriesInnerReason() public {
        // Alasan berupa pesan Error(string)
        BrokenToken rusak = new BrokenToken();
        rusak.mint(pewaris, 10 ether);
        PusakaWallet.Call[] memory calls = new PusakaWallet.Call[](1);
        calls[0] = PusakaWallet.Call({
            to: address(rusak), value: 0, data: abi.encodeCall(rusak.transfer, (orangLain, 1 ether))
        });
        vm.prank(pewaris);
        vm.expectRevert(
            abi.encodeWithSelector(
                PusakaWallet.CallFailed.selector, uint256(0), abi.encodeWithSignature("Error(string)", "rusak")
            )
        );
        _wallet().execute(calls);

        // Alasan kosong: token tidak menerima MON
        vm.deal(pewaris, 1 ether);
        calls[0] = PusakaWallet.Call({
            to: address(token), value: 1 wei, data: abi.encodeCall(token.transfer, (orangLain, 1 ether))
        });
        vm.prank(pewaris);
        vm.expectRevert(abi.encodeWithSelector(PusakaWallet.CallFailed.selector, uint256(0), bytes("")));
        _wallet().execute(calls);
    }

    // ------------------------------------------------------------------
    // Pemasangan sekali jalan: daftarkan rekening bank + pasang aturan lewat satu execute()
    // ------------------------------------------------------------------

    function test_install_viaExecute_registersBankAccountsAndSetsUpRules() public {
        mitra = new MitraCair(token, operator);

        vm.recordLogs();
        PusakaWallet dompet = _installViaExecute(_config(), false, "");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        subject = PusakaCore(address(dompet));

        // Dua langkah, satu transaksi: 4 rekening terdaftar dan aturan terpasang
        assertEq(_countLogs(logs, address(mitra), MitraCair.RekeningDidaftarkan.selector), 4);
        assertEq(_countLogs(logs, address(dompet), PusakaCore.Configured.selector), 1);
        assertEq(uint8(subject.status()), uint8(PusakaCore.Status.Active));
        assertEq(subject.owner(), address(dompet));

        // Pemasangan bukan bukti hidup: _touch() diam saat aturan belum terpasang
        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(s.lastProofVia, 0);
        assertEq(s.round, 1);

        // Istri, ayah, dan ibu memakai rekening virtual; anak-anak alamat biasa
        PusakaCore.Heir[] memory heirs = subject.getHeirs();
        assertEq(heirs[0].wallet, vaMitra[0], "istri");
        assertEq(heirs[1].wallet, anakLk1);
        assertEq(heirs[2].wallet, anakLk2);
        assertEq(heirs[3].wallet, anakPr);
        assertEq(heirs[4].wallet, vaMitra[1], "ayah");
        assertEq(heirs[5].wallet, vaMitra[2], "ibu");

        // Rekening terdaftar atas nama dompet itu, jadi VA-nya tidak bisa diserobot pihak lain
        assertEq(mitra.jumlahRekening(), 4);
        bytes32[] memory sidik = _sidik();
        string[4] memory bank = ["BCA", "Mandiri", "BNI", "BSI"];
        string[4] memory akhiran = ["1234", "5678", "9012", "3456"];
        address[4] memory cadangan = [istri, ayah, ibu, masjid];
        for (uint256 i; i < 4; i++) {
            bytes32 id = mitra.idRekening(address(dompet), sidik[i]);
            MitraCair.Rekening memory r = mitra.getRekening(id);
            assertEq(r.va, vaMitra[i]);
            assertEq(r.bank, bank[i]);
            assertEq(r.akhiran, akhiran[i]);
            assertEq(r.cadangan, cadangan[i]);
            assertEq(mitra.rekeningDariVA(vaMitra[i]), id);
        }
    }

    /// @notice Jika setup() gagal, pendaftaran rekening ikut dibatalkan: tidak ada setengah pemasangan.
    function test_install_viaExecute_failureRollsBackEverything() public {
        mitra = new MitraCair(token, operator);
        PusakaCore.Config memory cfg = _config();
        cfg.challengePeriod = 0;

        bytes memory sebab = abi.encodeWithSelector(PusakaCore.InvalidConfig.selector, uint8(7));
        _installViaExecute(cfg, false, abi.encodeWithSelector(PusakaWallet.CallFailed.selector, uint256(1), sebab));

        assertEq(mitra.jumlahRekening(), 0, "pendaftaran rekening ikut batal");
        assertEq(mitra.rekeningDariVA(vaMitra[0]), bytes32(0));
    }

    // ------------------------------------------------------------------
    // Alur penuh: warisan sampai ke rekening bank lewat MitraCair
    // ------------------------------------------------------------------

    /// @notice Keluarga K01, harta bersama 1/1, wakaf masjid 1/5, harta Rp300 jt. Istri, ayah, ibu, dan masjid memakai
    ///         rekening virtual MitraCair sebagai alamat penerima; anak-anak alamat biasa. Sesudah dibagikan, bagian
    ///         VA disapu dan ditransfer ke bank oleh operator. Lalu satu anak mencairkan bagiannya sendiri dengan izin
    ///         bertanda tangan, tanpa approve.
    function test_integration_inheritanceReachesBankAccounts() public {
        mitra = new MitraCair(token, operator);
        PusakaCore.Config memory cfg = _config();
        cfg.jointProperty = FaraidLib.Frac(1, 1);
        subject = PusakaCore(address(_installViaExecute(cfg, true, "")));
        token.faucet(pewaris, 300_000_000 ether);
        supplyAwal = token.totalSupply();

        // 1. Saksi memicu, masa sanggah lewat, siapa pun membagikan
        _triggerByWitnesses();
        _warpBy(CHALLENGE);
        vm.expectEmit(pewaris);
        emit PusakaCore.Distributed(address(token), 300_000_000 ether, 0);
        vm.expectEmit(pewaris);
        emit PusakaCore.JointShareSent(address(token), vaMitra[0], 150_000_000 ether);
        vm.expectEmit(pewaris);
        emit PusakaCore.BequestSent(address(token), vaMitra[3], 30_000_000 ether);
        vm.expectEmit(pewaris);
        emit PusakaCore.ShareSent(address(token), vaMitra[0], FaraidLib.Relation.Wife, 15_000_000 ether);
        vm.prank(orangLain);
        subject.finalize();

        assertEq(token.balanceOf(vaMitra[0]), 165_000_000 ether, "istri: 150 jt harta bersama + 15 jt faraid");
        assertEq(token.balanceOf(vaMitra[1]), 20_000_000 ether, "ayah");
        assertEq(token.balanceOf(vaMitra[2]), 20_000_000 ether, "ibu");
        assertEq(token.balanceOf(vaMitra[3]), 30_000_000 ether, "wakaf masjid");
        assertEq(token.balanceOf(anakLk1), 26_000_000 ether);
        assertEq(token.balanceOf(anakLk2), 26_000_000 ether);
        assertEq(token.balanceOf(anakPr), 13_000_000 ether);
        assertEq(token.balanceOf(pewaris), 0, "harta habis dibagikan");
        assertEq(vaMitra[0].code.length, 0, "VA baru berupa alamat; kontraknya belum ada");
        assertEq(token.totalSupply(), supplyAwal, "belum ada yang dibakar");

        _sapuDanSelesaikanRekeningVirtual();
        _anakMencairkanSendiri();
    }

    function _sapuDanSelesaikanRekeningVirtual() internal {
        // 2. Siapa pun menyapu rekening virtual yang berisi: hasilnya antrean pencairan ke bank
        bytes32[] memory ids = mitra.vaBerisi(0, 100);
        assertEq(ids.length, 4);
        uint256[4] memory jumlah = [uint256(165_000_000 ether), 20_000_000 ether, 20_000_000 ether, 30_000_000 ether];
        for (uint256 i; i < 4; i++) {
            vm.expectEmit(address(mitra));
            emit MitraCair.PencairanDiminta(i, ids[i], vaMitra[i], jumlah[i]);
        }
        vm.prank(orangLain);
        assertEq(mitra.sapuBanyak(ids), 4);

        assertEq(token.balanceOf(address(mitra)), 235_000_000 ether);
        for (uint256 i; i < 4; i++) {
            assertEq(token.balanceOf(vaMitra[i]), 0);
            assertEq(vaMitra[i].code.length, 45, "klon EIP-1167 terpasang di alamat yang sama");
        }
        uint256[] memory antrean = mitra.antrean();
        assertEq(antrean.length, 4);
        assertEq(mitra.vaBerisi(0, 100).length, 0, "tidak ada lagi yang perlu disapu");

        // 3. Operator mentransfer ke bank (simulasi), lalu menandai tuntas: token yang ditukar dibakar
        uint256[] memory nos = new uint256[](4);
        bytes32[] memory bukti = new bytes32[](4);
        for (uint256 i; i < 4; i++) {
            nos[i] = i;
            bukti[i] = keccak256(abi.encode("referensi-bank", i));
            vm.expectEmit(address(mitra));
            emit MitraCair.PencairanSelesai(i, ids[i], jumlah[i], bukti[i]);
        }
        vm.prank(operator);
        mitra.selesaikan(nos, bukti);

        assertEq(token.balanceOf(address(mitra)), 0);
        assertEq(token.totalSupply(), supplyAwal - 235_000_000 ether, "235 jt tIDR dibakar");
        assertEq(mitra.antrean().length, 0);
        assertEq(mitra.antreanMulai(), 4);

        // 4. Layar istri: sudah tuntas, Rp165.000.000 ke rekening banknya
        MitraCair.StatusPenerima memory st = mitra.statusPenerima(vaMitra[0]);
        assertEq(st.rekening, ids[0]);
        assertEq(st.bank, "BCA");
        assertEq(st.akhiran, "1234");
        assertEq(st.saldo, 0);
        assertTrue(st.adaPencairan);
        assertEq(st.no, 0);
        assertEq(st.pencairan.rekening, ids[0]);
        assertEq(st.pencairan.dari, vaMitra[0]);
        assertEq(st.pencairan.jumlah, 165_000_000 ether);
        assertEq(uint8(st.pencairan.tahap), uint8(MitraCair.Tahap.Selesai));
        assertEq(st.pencairan.bukti, bukti[0]);
        assertEq(st.pencairan.selesai, _now());
        assertEq(st.bankTujuan, "BCA");
        assertEq(st.akhiranTujuan, "1234");
    }

    function _anakMencairkanSendiri() internal {
        // 5. Anak pertama mencairkan 26 jt dari dompetnya sendiri: satu transaksi dengan izin bertanda tangan
        (address anak, uint256 anakKey) = makeAddrAndKey("anakLk1");
        assertEq(anak, anakLk1);
        bytes32 sidik = keccak256("rekening-anak");
        bytes32 id = mitra.idRekening(anakLk1, sidik);
        address va = mitra.alamatVA(id);
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(anakKey, anakLk1, address(mitra), 26_000_000 ether, deadline);
        assertEq(token.allowance(anakLk1, address(mitra)), 0, "belum ada approve");

        vm.expectEmit(address(mitra));
        emit MitraCair.RekeningDidaftarkan(id, va, "BRI", "7781", anakLk1);
        vm.expectEmit(address(mitra));
        emit MitraCair.PencairanDiminta(4, id, anakLk1, 26_000_000 ether);
        vm.prank(anakLk1);
        uint256 no = mitra.cairkan(sidik, "BRI", "7781", 26_000_000 ether, deadline, v, r, s);

        assertEq(no, 4);
        assertEq(token.balanceOf(anakLk1), 0);
        assertEq(token.balanceOf(address(mitra)), 26_000_000 ether);
        assertEq(token.allowance(anakLk1, address(mitra)), 0, "izin terpakai habis");
        assertEq(token.nonces(anakLk1), 1);
        MitraCair.StatusPenerima memory st = mitra.statusPenerima(anakLk1);
        assertEq(st.rekening, bytes32(0), "anak bukan rekening virtual");
        assertTrue(st.adaPencairan);
        assertEq(st.no, 4);
        assertEq(uint8(st.pencairan.tahap), uint8(MitraCair.Tahap.Diproses));
        assertEq(st.pencairan.dari, anakLk1);
        assertEq(st.bankTujuan, "BRI");
        assertEq(st.akhiranTujuan, "7781");

        // 6. Operator menyelesaikan; token dibakar
        uint256[] memory nos = new uint256[](1);
        nos[0] = no;
        bytes32[] memory bukti = new bytes32[](1);
        bukti[0] = keccak256("referensi-bank-anak");
        vm.expectEmit(address(mitra));
        emit MitraCair.PencairanSelesai(no, id, 26_000_000 ether, bukti[0]);
        vm.prank(operator);
        mitra.selesaikan(nos, bukti);

        assertEq(token.balanceOf(address(mitra)), 0);
        assertEq(token.totalSupply(), supplyAwal - 261_000_000 ether, "261 jt tIDR dibakar seluruhnya");
        assertEq(mitra.antrean().length, 0);
        assertEq(mitra.antreanMulai(), 5);
        assertEq(uint8(mitra.statusPenerima(anakLk1).pencairan.tahap), uint8(MitraCair.Tahap.Selesai));
    }

    // ------------------------------------------------------------------
    // Pembantu
    // ------------------------------------------------------------------

    bytes32 constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    MitraCair mitra;
    address operator = makeAddr("operator");
    address[] vaMitra; // rekening virtual istri, ayah, ibu, masjid (diisi _installViaExecute)
    uint256 supplyAwal;

    function _tokens(address t) internal pure returns (address[] memory list) {
        list = new address[](1);
        list[0] = t;
    }

    function _transferCall(address to, uint256 amount) internal view returns (PusakaWallet.Call memory) {
        return PusakaWallet.Call({to: address(token), value: 0, data: abi.encodeCall(token.transfer, (to, amount))});
    }

    /// @dev Transaksi pewaris dari dompetnya sendiri.
    function _execute(PusakaWallet.Call[] memory calls) internal {
        vm.prank(pewaris);
        _wallet().execute(calls);
    }

    function _countLogs(Vm.Log[] memory logs, address emitter, bytes32 topic0) internal pure returns (uint256 n) {
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].emitter == emitter && logs[i].topics[0] == topic0) n++;
        }
    }

    /// @dev Izin EIP-2612 untuk MockIDR: `pemilik` mengizinkan `spender` memakai `jumlah`.
    function _signPermit(uint256 key, address pemilik, address spender, uint256 jumlah, uint256 deadline)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, pemilik, spender, jumlah, token.nonces(pemilik), deadline));
        (v, r, s) = vm.sign(key, keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash)));
    }

    /// @dev Sidik empat rekening bank: istri, ayah, ibu, masjid.
    function _sidik() internal pure returns (bytes32[] memory s) {
        s = new bytes32[](4);
        s[0] = keccak256("rekening-istri");
        s[1] = keccak256("rekening-ayah");
        s[2] = keccak256("rekening-ibu");
        s[3] = keccak256("rekening-masjid");
    }

    function _daftarCall() internal view returns (PusakaWallet.Call memory) {
        string[] memory bank = new string[](4);
        bank[0] = "BCA";
        bank[1] = "Mandiri";
        bank[2] = "BNI";
        bank[3] = "BSI";
        string[] memory akhiran = new string[](4);
        akhiran[0] = "1234";
        akhiran[1] = "5678";
        akhiran[2] = "9012";
        akhiran[3] = "3456";
        address[] memory cadangan = new address[](4);
        cadangan[0] = istri;
        cadangan[1] = ayah;
        cadangan[2] = ibu;
        cadangan[3] = masjid;
        return PusakaWallet.Call({
            to: address(mitra),
            value: 0,
            data: abi.encodeCall(MitraCair.daftarBanyak, (_sidik(), bank, akhiran, cadangan))
        });
    }

    /// @dev setup() dengan istri, ayah, ibu (dan masjid sebagai penerima wakaf 1/5) di alamat rekening virtual.
    function _setupCall(address dompet, address[] memory va, PusakaCore.Config memory cfg, bool denganWakaf)
        internal
        view
        returns (PusakaWallet.Call memory)
    {
        PusakaCore.Heir[] memory heirs = _heirsK01();
        heirs[0].wallet = va[0];
        heirs[4].wallet = va[1];
        heirs[5].wallet = va[2];
        PusakaCore.Bequest[] memory wasiat = _noBequests();
        if (denganWakaf) {
            wasiat = new PusakaCore.Bequest[](1);
            wasiat[0] = PusakaCore.Bequest(va[3], FaraidLib.Frac(1, 5));
        }
        return PusakaWallet.Call({
            to: dompet,
            value: 0,
            data: abi.encodeCall(PusakaWallet.setup, (_tokens(address(token)), heirs, _witnesses(), wasiat, cfg))
        });
    }

    /// @dev Dompet baru memasang aturan lewat SATU execute(): daftarBanyak() ke MitraCair, lalu setup() ke dirinya sendiri.
    ///      Alamat rekening virtual dihitung dulu (alamatVAUntuk), karena dipakai sebagai alamat ahli waris di setup().
    ///      `galat` tidak kosong = revert yang diharapkan dari execute().
    function _installViaExecute(PusakaCore.Config memory cfg, bool denganWakaf, bytes memory galat)
        internal
        returns (PusakaWallet)
    {
        (pewaris, pewarisKey) = makeAddrAndKey(string.concat("dompet-mitra-", vm.toString(++walletCount)));
        address[] memory va = mitra.alamatVAUntuk(pewaris, _sidik());
        delete vaMitra;
        for (uint256 i; i < va.length; i++) {
            vaMitra.push(va[i]);
        }
        PusakaWallet.Call[] memory calls = new PusakaWallet.Call[](2);
        calls[0] = _daftarCall();
        calls[1] = _setupCall(pewaris, va, cfg, denganWakaf);

        vm.signAndAttachDelegation(address(implementation), pewarisKey);
        vm.prank(pewaris);
        if (galat.length > 0) vm.expectRevert(galat);
        _wallet().execute(calls);
        return _wallet();
    }

    function _expectSetupRevert(address[] memory tokens, bytes memory err) internal {
        (address eoa, uint256 key) = makeAddrAndKey(string.concat("dompet-salah-", vm.toString(++walletCount)));
        vm.signAndAttachDelegation(address(implementation), key);
        vm.prank(eoa);
        vm.expectRevert(err);
        PusakaWallet(payable(eoa)).setup(tokens, _heirsK01(), _witnesses(), _noBequests(), _config());
    }
}
