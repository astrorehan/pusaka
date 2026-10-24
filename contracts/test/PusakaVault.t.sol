// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Vm} from "forge-std/Vm.sol";
import {FaraidLib} from "../src/FaraidLib.sol";
import {EstateLib} from "../src/EstateLib.sol";
import {MockIDR} from "../src/MockIDR.sol";
import {PusakaCore} from "../src/PusakaCore.sol";
import {PusakaVault} from "../src/PusakaVault.sol";
import {PusakaFactory} from "../src/PusakaFactory.sol";
import {PusakaFlowBase} from "./PusakaFlowBase.sol";

/// @dev Dompet pintar tiruan (ERC-1271): tanda tangan sah jika ditandatangani kunci pemegangnya.
contract MockSmartAccount {
    bytes4 private constant MAGIC = 0x1626ba7e;

    address public immutable kunci;

    constructor(address kunci_) {
        kunci = kunci_;
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(hash, signature);
        return err == ECDSA.RecoverError.NoError && signer == kunci ? MAGIC : bytes4(0xffffffff);
    }
}

/// @dev Penanda tangan kontrak yang rusak: pemeriksaan tanda tangannya selalu revert.
contract BrokenSigner {
    function isValidSignature(bytes32, bytes calldata) external pure returns (bytes4) {
        revert("rusak");
    }
}

/// @notice Model brankas: pewaris menyetor tIDR ke brankas yang dibuat factory.
///         Semua tes alur di PusakaFlowBase ikut dijalankan untuk model ini.
contract PusakaVaultTest is PusakaFlowBase {
    PusakaFactory factory;

    function _deployInfrastructure() internal override {
        (pewaris, pewarisKey) = makeAddrAndKey("pewaris");
        factory = new PusakaFactory(token, address(new PusakaVault()));
    }

    function _create(
        PusakaCore.Heir[] memory heirs,
        address[] memory witnesses,
        PusakaCore.Bequest[] memory bequests,
        PusakaCore.Config memory cfg
    ) internal override returns (PusakaCore) {
        vm.prank(pewaris);
        return PusakaCore(factory.createVault(heirs, witnesses, bequests, cfg));
    }

    function _fund(uint256 amount) internal override {
        token.faucet(pewaris, amount);
        vm.startPrank(pewaris);
        token.approve(address(subject), amount);
        _vault().deposit(amount);
        vm.stopPrank();
    }

    function _spend(uint256 amount) internal override {
        vm.prank(pewaris);
        _vault().withdraw(amount);
    }

    /// @dev Di brankas, bukti hidup lewat aktivitas = pewaris menarik sebagian tIDR.
    function _ownerActivity() internal override {
        vm.prank(pewaris);
        _vault().withdraw(1 ether);
    }

    function _vault() internal view returns (PusakaVault) {
        return PusakaVault(address(subject));
    }

    // ------------------------------------------------------------------
    // Khusus brankas
    // ------------------------------------------------------------------

    function test_kind() public view {
        assertEq(subject.getSummary().kind, 1);
        assertEq(token.balanceOf(address(subject)), HARTA, "harta dipindah ke brankas");
    }

    function test_withdraw() public {
        vm.prank(pewaris);
        _vault().withdraw(20_000_000 ether);
        assertEq(token.balanceOf(pewaris), 20_000_000 ether);
        assertEq(token.balanceOf(address(subject)), 100_000_000 ether);
    }

    function test_withdraw_onlyOwner() public {
        vm.prank(orangLain);
        vm.expectRevert(PusakaCore.NotOwner.selector);
        _vault().withdraw(1);
    }

    function test_depositAndWithdraw_onlyWhenActive() public {
        _triggerByWitnesses();
        vm.startPrank(pewaris);
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.WrongStatus.selector, PusakaCore.Status.Triggered));
        _vault().withdraw(1);
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.WrongStatus.selector, PusakaCore.Status.Triggered));
        _vault().deposit(1);
        vm.stopPrank();
    }

    function test_implementationIsLocked() public {
        PusakaVault implementation = PusakaVault(factory.vaultImplementation());
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.WrongStatus.selector, PusakaCore.Status.Distributed));
        implementation.initialize(pewaris, address(token), _heirsK01(), _witnesses(), _noBequests(), _config());
    }

    function test_initializeTwice_reverts() public {
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.WrongStatus.selector, PusakaCore.Status.Active));
        _vault().initialize(orangLain, address(token), _heirsK01(), _witnesses(), _noBequests(), _config());
    }

    /// @notice Kontrak cetakan terkunci: fungsi bertanda tangan tidak bisa dipakai di sana.
    function test_implementation_signedFunctionsAreInert() public {
        PusakaVault implementation = PusakaVault(factory.vaultImplementation());
        vm.expectRevert(PusakaCore.BadSignature.selector);
        implementation.checkIn(_now(), hex"00");
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.WrongStatus.selector, PusakaCore.Status.Distributed));
        implementation.attestDeathFor(saksi1, AKTA, hex"00");
    }

    // ------------------------------------------------------------------
    // Bukti hidup di brankas: setoran pewaris dan penarikan
    // ------------------------------------------------------------------

    function test_freshVault_hasOnlyInstallAsProof() public {
        PusakaCore baru = _create(_heirsK01(), _witnesses(), _noBequests(), _config());
        PusakaCore.Summary memory s = baru.getSummary();
        assertEq(s.lastProofVia, 0, "belum ada bukti hidup selain pemasangan");
        assertEq(s.round, 1);
        assertEq(s.lastHeartbeat, _now());
    }

    /// @notice Setoran pewaris sendiri dihitung sebagai bukti hidup; itu sudah terjadi di setUp() lewat _fund().
    function test_setUp_ownerDepositWasProofOfLife() public view {
        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(s.lastProofVia, 3);
        assertEq(s.round, 2, "pemasangan + setoran pertama");
    }

    function test_deposit_byOwner_countsAsProofOfLife() public {
        vm.prank(saksi1);
        subject.attestDeath(AKTA);
        _warpBy(INACTIVITY / 2);
        uint64 sekarang = _now();
        uint256 putaran = subject.getSummary().round;
        token.faucet(pewaris, 5 ether);

        vm.startPrank(pewaris);
        token.approve(address(subject), 5 ether);
        vm.expectEmit(address(subject));
        emit PusakaCore.Heartbeat(sekarang, 3);
        vm.expectEmit(address(subject));
        emit PusakaVault.Deposited(pewaris, 5 ether);
        _vault().deposit(5 ether);
        vm.stopPrank();

        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(s.lastHeartbeat, sekarang);
        assertEq(s.lastProofVia, 3);
        assertEq(s.attestations, 0, "konfirmasi saksi hangus");
        assertEq(s.round, putaran + 1);
    }

    /// @notice Orang lain boleh menyetor, tetapi itu bukan bukti hidup pewaris: timer tidak diulang dan konfirmasi saksi
    ///         tidak terhapus. Kalau bisa, setoran receh dapat dipakai untuk menggagalkan saksi.
    function test_deposit_byThirdParty_isNotProofOfLife() public {
        vm.prank(saksi1);
        subject.attestDeath(AKTA);
        _warpBy(INACTIVITY / 2);
        PusakaCore.Summary memory sebelum = subject.getSummary();
        token.faucet(orangLain, 5 ether);

        vm.startPrank(orangLain);
        token.approve(address(subject), 5 ether);
        vm.recordLogs();
        vm.expectEmit(address(subject));
        emit PusakaVault.Deposited(orangLain, 5 ether);
        _vault().deposit(5 ether);
        vm.stopPrank();

        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; i++) {
            assertTrue(logs[i].topics[0] != PusakaCore.Heartbeat.selector, "tidak ada Heartbeat");
        }
        PusakaCore.Summary memory sesudah = subject.getSummary();
        assertEq(sesudah.lastHeartbeat, sebelum.lastHeartbeat, "timer tidak diulang");
        assertEq(sesudah.lastProofVia, sebelum.lastProofVia);
        assertEq(sesudah.round, sebelum.round);
        assertEq(sesudah.attestations, 1, "konfirmasi saksi tetap");
        assertEq(token.balanceOf(address(subject)), HARTA + 5 ether, "setorannya tetap masuk");
    }

    function test_withdraw_countsAsProofOfLife() public {
        vm.prank(saksi1);
        subject.attestDeath(AKTA);
        _warpBy(INACTIVITY / 2);
        uint64 sekarang = _now();
        uint256 putaran = subject.getSummary().round;

        vm.expectEmit(address(subject));
        emit PusakaCore.Heartbeat(sekarang, 3);
        vm.expectEmit(address(subject));
        emit PusakaVault.Withdrawn(20_000_000 ether);
        vm.prank(pewaris);
        _vault().withdraw(20_000_000 ether);

        PusakaCore.Summary memory s = subject.getSummary();
        assertEq(s.lastHeartbeat, sekarang);
        assertEq(s.lastProofVia, 3);
        assertEq(s.attestations, 0, "konfirmasi saksi hangus");
        assertEq(s.round, putaran + 1);
    }

    // ------------------------------------------------------------------
    // Pemilik atau saksi berupa kontrak (ERC-1271), mis. dompet pintar
    // ------------------------------------------------------------------

    function test_erc1271_smartAccountOwner_signedCheckIn() public {
        (address kunciAddr, uint256 kunci) = makeAddrAndKey("kunci-dompet-pintar");
        MockSmartAccount akun = new MockSmartAccount(kunciAddr);
        PusakaCore brankas = _createFor(address(akun), _witnesses());
        assertEq(brankas.owner(), address(akun));

        _warpBy(1 minutes);
        uint64 waktu = _now();
        bytes memory dariKunci = _signCheckIn(address(brankas), kunci, waktu);
        bytes memory dariLain = _signCheckIn(address(brankas), saksi1Key, waktu);

        vm.expectRevert(PusakaCore.BadSignature.selector);
        brankas.checkIn(waktu, dariLain);
        vm.expectRevert(PusakaCore.BadSignature.selector);
        brankas.checkIn(waktu, hex"1234");

        vm.expectEmit(address(brankas));
        emit PusakaCore.Heartbeat(waktu, 2);
        vm.prank(orangLain);
        brankas.checkIn(waktu, dariKunci);

        PusakaCore.Summary memory s = brankas.getSummary();
        assertEq(s.lastHeartbeat, waktu);
        assertEq(s.lastProofVia, 2);
    }

    /// @notice Penanda tangan kontrak yang rusak menghasilkan BadSignature yang rapi, bukan revert dari kontrak itu.
    function test_erc1271_brokenContractOwner_isBadSignature() public {
        BrokenSigner rusak = new BrokenSigner();
        PusakaCore brankas = _createFor(address(rusak), _witnesses());
        _warpBy(1 minutes);
        uint64 waktu = _now();
        bytes memory sig = _signCheckIn(address(brankas), pewarisKey, waktu);

        vm.expectRevert(PusakaCore.BadSignature.selector);
        brankas.checkIn(waktu, sig);
    }

    function test_erc1271_smartAccountWitness_attestDeathFor() public {
        (address kunciAddr, uint256 kunci) = makeAddrAndKey("kunci-saksi-pintar");
        MockSmartAccount saksiPintar = new MockSmartAccount(kunciAddr);
        address[] memory saksi = _witnesses();
        saksi[0] = address(saksiPintar);
        PusakaCore brankas = _createFor(pewaris, saksi);
        uint256 putaran = brankas.getSummary().round;
        bytes memory dariKunci = _signAttest(address(brankas), kunci, address(saksiPintar), AKTA, putaran);
        bytes memory dariLain = _signAttest(address(brankas), saksi2Key, address(saksiPintar), AKTA, putaran);

        // Tanda tangan orang lain atas nama dompet pintar itu ditolak
        vm.expectRevert(PusakaCore.BadSignature.selector);
        brankas.attestDeathFor(address(saksiPintar), AKTA, dariLain);

        vm.expectEmit(address(brankas));
        emit PusakaCore.DeathAttested(address(saksiPintar), AKTA, 1);
        vm.prank(orangLain);
        brankas.attestDeathFor(address(saksiPintar), AKTA, dariKunci);
        assertEq(uint8(brankas.status()), uint8(PusakaCore.Status.Active), "1 saksi belum cukup");

        // Saksi kedua langsung → dipicu
        vm.prank(saksi2);
        brankas.attestDeath(AKTA);
        assertEq(uint8(brankas.status()), uint8(PusakaCore.Status.Triggered));
    }

    function test_erc1271_smartAccountKey_cannotSignForOtherWitness() public {
        (address kunciAddr, uint256 kunci) = makeAddrAndKey("kunci-saksi-pintar");
        MockSmartAccount saksiPintar = new MockSmartAccount(kunciAddr);
        address[] memory saksi = _witnesses();
        saksi[0] = address(saksiPintar);
        PusakaCore brankas = _createFor(pewaris, saksi);
        // Kunci dompet pintar menandatangani atas nama saksi2 (akun biasa): ditolak
        bytes memory sig = _signAttest(address(brankas), kunci, saksi2, AKTA, brankas.getSummary().round);

        vm.expectRevert(PusakaCore.BadSignature.selector);
        brankas.attestDeathFor(saksi2, AKTA, sig);
    }

    function _createFor(address pemilik, address[] memory saksi) internal returns (PusakaCore) {
        vm.prank(pemilik);
        return PusakaCore(factory.createVault(_heirsK01(), saksi, _noBequests(), _config()));
    }

    // ------------------------------------------------------------------
    // Factory
    // ------------------------------------------------------------------

    function test_factory_tracksVaultsAndEmits() public {
        vm.expectEmit(true, false, false, false, address(factory));
        emit PusakaFactory.VaultCreated(pewaris, address(0));
        PusakaCore second = _create(_heirsK01(), _witnesses(), _noBequests(), _config());

        address[] memory list = factory.vaultsOf(pewaris);
        assertEq(list.length, 2);
        assertEq(list[0], address(subject));
        assertEq(list[1], address(second));
        assertEq(second.owner(), pewaris);
    }

    function test_factory_rejectsZeroAddress() public {
        vm.expectRevert(PusakaFactory.ZeroAddress.selector);
        new PusakaFactory(MockIDR(address(0)), address(1));
    }

    function test_factory_previewFaraid() public view {
        FaraidLib.Family memory f;
        f.deceasedMale = true;
        f.wives = 1;
        f.father = true;
        f.mother = true;
        FaraidLib.Result memory r = factory.previewFaraid(f, false);
        assertEq(r.mother.num, 1);
        assertEq(r.mother.den, 4); // K09 gharrawain
    }

    function test_factory_previewEstate() public view {
        FaraidLib.Family memory f = subject.getFamily();
        FaraidLib.Frac[] memory wasiat = new FaraidLib.Frac[](1);
        wasiat[0] = FaraidLib.Frac(1, 5);
        (uint256 joint, uint256[] memory bequests, uint256 pool, FaraidLib.Result memory r) =
            factory.previewEstate(300_000_000 ether, f, false, FaraidLib.Frac(1, 1), wasiat);
        assertEq(joint, 150_000_000 ether);
        assertEq(bequests[0], 30_000_000 ether);
        assertEq(pool, 120_000_000 ether);
        assertEq(pool * r.sonEach.num / r.sonEach.den, 26_000_000 ether);
    }

    // ------------------------------------------------------------------
    // Validasi saat brankas dibuat (kode yang sama dipakai PusakaWallet)
    // ------------------------------------------------------------------

    function test_create_rejectsInvalidFamily() public {
        PusakaCore.Heir[] memory heirs = new PusakaCore.Heir[](1);
        heirs[0] = PusakaCore.Heir(istri, FaraidLib.Relation.Husband); // suami untuk pewaris laki-laki
        vm.expectRevert(abi.encodeWithSelector(FaraidLib.InvalidFamily.selector, uint8(1)));
        _create(heirs, _witnesses(), _noBequests(), _config());
    }

    function test_create_rejectsUnsupportedCase() public {
        PusakaCore.Heir[] memory heirs = new PusakaCore.Heir[](1);
        heirs[0] = PusakaCore.Heir(istri, FaraidLib.Relation.Wife); // X1: istri saja, mode jumhur
        vm.expectRevert(abi.encodeWithSelector(FaraidLib.UnsupportedCase.selector, uint8(2)));
        _create(heirs, _witnesses(), _noBequests(), _config());
    }

    function test_create_rejectsBadConfig() public {
        PusakaCore.Heir[] memory heirs = _heirsK01();
        address[] memory witnesses = _witnesses();
        PusakaCore.Bequest[] memory none = _noBequests();
        PusakaCore.Config memory cfg;

        // 1: tanpa ahli waris
        _expectInvalid(1, new PusakaCore.Heir[](0), witnesses, none, _config());

        // 2: tanpa saksi
        _expectInvalid(2, heirs, new address[](0), none, _config());

        // 3: ambang lebih besar dari jumlah saksi
        cfg = _config();
        cfg.witnessThreshold = 4;
        _expectInvalid(3, heirs, witnesses, none, cfg);

        // 4: alamat nol
        heirs[0].wallet = address(0);
        _expectInvalid(4, heirs, witnesses, none, _config());

        // 5: alamat ganda; pewaris sebagai saksi; ahli waris sebagai penerima wasiat
        heirs = _heirsK01();
        heirs[1].wallet = heirs[2].wallet;
        _expectInvalid(5, heirs, witnesses, none, _config());
        heirs = _heirsK01();
        witnesses[0] = pewaris;
        _expectInvalid(5, heirs, witnesses, none, _config());
        witnesses = _witnesses();
        PusakaCore.Bequest[] memory wasiat = new PusakaCore.Bequest[](1);
        wasiat[0] = PusakaCore.Bequest(istri, FaraidLib.Frac(1, 10));
        _expectInvalid(5, heirs, witnesses, wasiat, _config());

        // 6: dua ibu
        heirs[4].relation = FaraidLib.Relation.Mother;
        _expectInvalid(6, heirs, witnesses, none, _config());

        // 7: masa sanggah 0
        heirs = _heirsK01();
        cfg = _config();
        cfg.challengePeriod = 0;
        _expectInvalid(7, heirs, witnesses, none, cfg);
    }

    function test_create_rejectsBadEstate() public {
        // Harta bersama dengan dua istri belum didukung
        PusakaCore.Heir[] memory heirs = _heirsK01();
        heirs[1].relation = FaraidLib.Relation.Wife;
        PusakaCore.Config memory cfg = _config();
        cfg.jointProperty = FaraidLib.Frac(1, 1);
        vm.prank(pewaris);
        vm.expectRevert(abi.encodeWithSelector(EstateLib.InvalidEstate.selector, uint8(2)));
        factory.createVault(heirs, _witnesses(), _noBequests(), cfg);

        // Wasiat lebih dari 1/3
        PusakaCore.Bequest[] memory wasiat = new PusakaCore.Bequest[](1);
        wasiat[0] = PusakaCore.Bequest(masjid, FaraidLib.Frac(1, 2));
        vm.prank(pewaris);
        vm.expectRevert(abi.encodeWithSelector(EstateLib.InvalidEstate.selector, uint8(4)));
        factory.createVault(_heirsK01(), _witnesses(), wasiat, _config());
    }

    function test_faucetLimit() public {
        vm.expectRevert(abi.encodeWithSelector(MockIDR.FaucetLimit.selector, 1_000_000_000 ether));
        token.faucet(orangLain, 1_000_000_000 ether + 1);
    }

    function _expectInvalid(
        uint8 code,
        PusakaCore.Heir[] memory heirs,
        address[] memory witnesses,
        PusakaCore.Bequest[] memory bequests,
        PusakaCore.Config memory cfg
    ) internal {
        vm.prank(pewaris);
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.InvalidConfig.selector, code));
        factory.createVault(heirs, witnesses, bequests, cfg);
    }
}
