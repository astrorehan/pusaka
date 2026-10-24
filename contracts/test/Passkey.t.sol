// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {FaraidLib} from "../src/FaraidLib.sol";
import {MockIDR} from "../src/MockIDR.sol";
import {PusakaCore} from "../src/PusakaCore.sol";
import {PusakaWallet} from "../src/PusakaWallet.sol";
import {WebAuthnLib} from "../src/WebAuthnLib.sol";

/// @notice Kabar hidup dengan passkey (WebAuthn P-256): pewaris cukup menyentuh sidik jari di HP, relayer mengirim.
contract PasskeyTest is Test {
    uint256 constant N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551;
    bytes32 constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 constant CHECKIN_TYPEHASH = keccak256("KabarHidup(string pesan,uint64 waktu)");
    bytes1 constant UP_UV = 0x05;

    MockIDR token;
    PusakaWallet implementation;
    address pewaris;
    uint256 pewarisKey;
    address[] saksi;
    uint256 passkeyPk = 0xA11CE;
    bytes32 qx;
    bytes32 qy;
    address relayer = makeAddr("relayer");

    function setUp() public {
        vm.warp(1_790_000_000);
        token = new MockIDR();
        implementation = new PusakaWallet();
        (pewaris, pewarisKey) = makeAddrAndKey("pewaris-passkey");
        for (uint256 i; i < 3; i++) {
            saksi.push(makeAddr(string.concat("saksi-", vm.toString(i))));
        }
        PusakaCore.Heir[] memory heirs = new PusakaCore.Heir[](2);
        heirs[0] = PusakaCore.Heir(makeAddr("istri"), FaraidLib.Relation.Wife);
        heirs[1] = PusakaCore.Heir(makeAddr("putra"), FaraidLib.Relation.Son);
        PusakaCore.Config memory cfg = PusakaCore.Config({
            deceasedMale: true,
            siblings: 0,
            otherRelatives: false,
            raddToSpouse: false,
            inactivityPeriod: 365 days,
            challengePeriod: 1 days,
            witnessThreshold: 2,
            jointProperty: FaraidLib.Frac(0, 1)
        });
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        vm.signAndAttachDelegation(address(implementation), pewarisKey);
        vm.prank(pewaris);
        PusakaWallet(payable(pewaris)).setup(tokens, heirs, saksi, new PusakaCore.Bequest[](0), cfg);
        token.faucet(pewaris, 300_000_000 ether);

        (uint256 x, uint256 y) = vm.publicKeyP256(passkeyPk);
        qx = bytes32(x);
        qy = bytes32(y);
    }

    function _w() internal view returns (PusakaWallet) {
        return PusakaWallet(payable(pewaris));
    }

    function _daftar() internal {
        vm.prank(pewaris);
        _w().aturPasskey(qx, qy);
    }

    function _digest(uint64 waktu) internal view returns (bytes32) {
        bytes32 domain = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256("Pusaka"), keccak256("1"), block.chainid, pewaris));
        bytes32 isi = keccak256(abi.encode(CHECKIN_TYPEHASH, keccak256("Saya masih hidup"), waktu));
        return keccak256(abi.encodePacked("\x19\x01", domain, isi));
    }

    /// @dev Meniru navigator.credentials.get(): clientDataJSON + authenticatorData, lalu tanda tangan P-256 dengan s
    ///      dinormalkan (seperti yang dilakukan web sebelum mengirim).
    function _auth(uint256 pk, bytes32 challenge, bytes1 flags, string memory tipe)
        internal
        pure
        returns (WebAuthnLib.Auth memory a)
    {
        bytes memory data = abi.encodePacked(sha256("localhost"), flags, uint32(7));
        string memory json = string.concat(
            '{"type":"',
            tipe,
            '","challenge":"',
            Base64.encodeURL(abi.encodePacked(challenge)),
            '","origin":"http://localhost:5180","crossOrigin":false}'
        );
        bytes32 h = sha256(abi.encodePacked(data, sha256(bytes(json))));
        (bytes32 r, bytes32 s) = vm.signP256(pk, h);
        if (uint256(s) > N / 2) s = bytes32(N - uint256(s));
        a = WebAuthnLib.Auth({
            authenticatorData: data,
            clientDataJSON: json,
            challengeIndex: 11 + bytes(tipe).length,
            typeIndex: 1,
            r: r,
            s: s
        });
    }

    function _authUntuk(uint64 waktu) internal view returns (WebAuthnLib.Auth memory) {
        return _auth(passkeyPk, _digest(waktu), UP_UV, "webauthn.get");
    }

    function _kirim(uint64 waktu, WebAuthnLib.Auth memory a) internal {
        vm.prank(relayer);
        _w().checkInPasskey(waktu, a);
    }

    function _picuOlehSaksi() internal {
        vm.prank(saksi[0]);
        _w().attestDeath(bytes32(uint256(1)));
        vm.prank(saksi[1]);
        _w().attestDeath(bytes32(uint256(1)));
        assertEq(uint8(_w().status()), uint8(PusakaCore.Status.Triggered));
    }

    // ------------------------------------------------------------------

    function test_passkey_checkIn_recordsProofOfLife() public {
        _daftar();
        vm.warp(block.timestamp + 300 days);
        uint64 t = uint64(block.timestamp);
        uint256 g = gasleft();
        _kirim(t, _authUntuk(t));
        emit log_named_uint("gas checkInPasskey", g - gasleft());
        PusakaCore.Summary memory s = _w().getSummary();
        assertEq(s.lastHeartbeat, t);
        assertEq(s.lastProofVia, 4, "sumber: passkey");
        assertEq(relayer.balance, 0, "relayer tidak perlu apa pun dari pewaris");
    }

    function test_passkey_timerRestarts_soInactivityTriggerWaits() public {
        _daftar();
        vm.warp(block.timestamp + 360 days);
        uint64 t = uint64(block.timestamp);
        _kirim(t, _authUntuk(t));
        vm.warp(block.timestamp + 10 days);
        vm.expectRevert(abi.encodeWithSelector(PusakaCore.TooEarly.selector, t + 365 days));
        _w().triggerByInactivity();
    }

    function test_passkey_cancelsTriggerDuringChallenge() public {
        _daftar();
        _picuOlehSaksi();
        vm.warp(block.timestamp + 1 hours);
        uint64 t = uint64(block.timestamp);
        vm.expectEmit(pewaris);
        emit PusakaCore.TriggerCancelled(t);
        _kirim(t, _authUntuk(t));
        assertEq(uint8(_w().status()), uint8(PusakaCore.Status.Active));
        assertEq(_w().getSummary().attestations, 0, "konfirmasi saksi hangus");
    }

    function test_passkey_afterChallengeOver_reverts() public {
        _daftar();
        _picuOlehSaksi();
        vm.warp(block.timestamp + 1 days);
        uint64 t = uint64(block.timestamp);
        WebAuthnLib.Auth memory a = _authUntuk(t);
        vm.expectRevert(PusakaCore.ChallengeOver.selector);
        _kirim(t, a);
    }

    function test_passkey_signedBeforeTrigger_cannotCancel() public {
        _daftar();
        vm.warp(block.timestamp + 1 days);
        uint64 lama = uint64(block.timestamp);
        WebAuthnLib.Auth memory a = _authUntuk(lama);
        vm.warp(block.timestamp + 1 hours);
        _picuOlehSaksi();
        vm.expectRevert(PusakaCore.StaleCheckIn.selector);
        _kirim(lama, a);
    }

    function test_passkey_replay_reverts() public {
        _daftar();
        vm.warp(block.timestamp + 1 days);
        uint64 t = uint64(block.timestamp);
        WebAuthnLib.Auth memory a = _authUntuk(t);
        _kirim(t, a);
        vm.expectRevert(PusakaCore.StaleCheckIn.selector);
        _kirim(t, a);
    }

    function test_passkey_fromFarFuture_reverts() public {
        _daftar();
        uint64 t = uint64(block.timestamp + 11 minutes);
        WebAuthnLib.Auth memory a = _authUntuk(t);
        vm.expectRevert(PusakaCore.CheckInFromFuture.selector);
        _kirim(t, a);
    }

    function test_passkey_notRegistered_reverts() public {
        uint64 t = uint64(block.timestamp + 1);
        WebAuthnLib.Auth memory a = _authUntuk(t);
        vm.expectRevert(PusakaCore.BadSignature.selector);
        _kirim(t, a);
    }

    function test_passkey_otherKey_reverts() public {
        _daftar();
        uint64 t = uint64(block.timestamp + 1);
        WebAuthnLib.Auth memory a = _auth(0xB0B, _digest(t), UP_UV, "webauthn.get");
        vm.expectRevert(PusakaCore.BadSignature.selector);
        _kirim(t, a);
    }

    function test_passkey_challengeForOtherTime_reverts() public {
        _daftar();
        uint64 t = uint64(block.timestamp + 1);
        WebAuthnLib.Auth memory a = _authUntuk(t);
        vm.expectRevert(PusakaCore.BadSignature.selector);
        _kirim(t + 1, a);
    }

    function test_passkey_challengeForOtherWallet_reverts() public {
        _daftar();
        uint64 t = uint64(block.timestamp + 1);
        bytes32 domainLain = keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256("Pusaka"), keccak256("1"), block.chainid, makeAddr("dompet-lain"))
        );
        bytes32 isi = keccak256(abi.encode(CHECKIN_TYPEHASH, keccak256("Saya masih hidup"), t));
        WebAuthnLib.Auth memory a = _auth(passkeyPk, keccak256(abi.encodePacked("\x19\x01", domainLain, isi)), UP_UV, "webauthn.get");
        vm.expectRevert(PusakaCore.BadSignature.selector);
        _kirim(t, a);
    }

    function test_passkey_registrationCeremonyType_reverts() public {
        _daftar();
        uint64 t = uint64(block.timestamp + 1);
        WebAuthnLib.Auth memory a = _auth(passkeyPk, _digest(t), UP_UV, "webauthn.create");
        vm.expectRevert(PusakaCore.BadSignature.selector);
        _kirim(t, a);
    }

    function test_passkey_requiresUserPresentAndVerified() public {
        _daftar();
        uint64 t = uint64(block.timestamp + 1);
        WebAuthnLib.Auth memory hanyaHadir = _auth(passkeyPk, _digest(t), 0x01, "webauthn.get");
        vm.expectRevert(PusakaCore.BadSignature.selector);
        _kirim(t, hanyaHadir);
        WebAuthnLib.Auth memory tanpaFlag = _auth(passkeyPk, _digest(t), 0x00, "webauthn.get");
        vm.expectRevert(PusakaCore.BadSignature.selector);
        _kirim(t, tanpaFlag);
        _kirim(t, _auth(passkeyPk, _digest(t), 0x1d, "webauthn.get")); // flag lain (BE, BS) boleh
    }

    function test_passkey_highS_reverts_lowS_ok() public {
        _daftar();
        uint64 t = uint64(block.timestamp + 1);
        WebAuthnLib.Auth memory a = _authUntuk(t);
        WebAuthnLib.Auth memory tinggi = _authUntuk(t);
        tinggi.s = bytes32(N - uint256(a.s));
        vm.expectRevert(PusakaCore.BadSignature.selector);
        _kirim(t, tinggi);
        _kirim(t, a);
    }

    function test_passkey_badIndexes_revertCleanly() public {
        _daftar();
        uint64 t = uint64(block.timestamp + 1);
        WebAuthnLib.Auth memory a = _authUntuk(t);
        a.challengeIndex = type(uint256).max;
        vm.expectRevert(PusakaCore.BadSignature.selector);
        _kirim(t, a);
        a = _authUntuk(t);
        a.typeIndex = 2;
        vm.expectRevert(PusakaCore.BadSignature.selector);
        _kirim(t, a);
        a = _authUntuk(t);
        a.authenticatorData = hex"00";
        vm.expectRevert(PusakaCore.BadSignature.selector);
        _kirim(t, a);
    }

    function test_passkey_tamperedJson_reverts() public {
        _daftar();
        uint64 t = uint64(block.timestamp + 1);
        WebAuthnLib.Auth memory a = _authUntuk(t);
        a.clientDataJSON = string.concat(a.clientDataJSON, " ");
        vm.expectRevert(PusakaCore.BadSignature.selector);
        _kirim(t, a);
    }

    function test_passkey_onlyOwnerCanRegister() public {
        vm.prank(relayer);
        vm.expectRevert(PusakaCore.NotOwner.selector);
        _w().aturPasskey(qx, qy);
    }

    function test_passkey_registerViaExecute_countsAsActivity() public {
        vm.warp(block.timestamp + 5 days);
        PusakaWallet.Call[] memory calls = new PusakaWallet.Call[](1);
        calls[0] = PusakaWallet.Call(pewaris, 0, abi.encodeCall(PusakaCore.aturPasskey, (qx, qy)));
        vm.expectEmit(pewaris);
        emit PusakaCore.PasskeyDiatur(qx, qy);
        vm.prank(pewaris);
        _w().execute(calls);
        (bytes32 x, bytes32 y) = _w().passkey();
        assertEq(x, qx);
        assertEq(y, qy);
        assertEq(_w().getSummary().lastProofVia, 3, "mendaftarkan passkey juga transaksi dari dompet");
    }

    function test_passkey_removedAndClearedOnCancelSetup() public {
        _daftar();
        vm.prank(pewaris);
        _w().aturPasskey(bytes32(0), bytes32(0));
        uint64 t = uint64(block.timestamp + 1);
        WebAuthnLib.Auth memory a = _authUntuk(t);
        vm.expectRevert(PusakaCore.BadSignature.selector);
        _kirim(t, a);

        _daftar();
        vm.prank(pewaris);
        _w().cancelSetup();
        (bytes32 x, bytes32 y) = _w().passkey();
        assertEq(x, bytes32(0));
        assertEq(y, bytes32(0));
    }

    function testFuzz_passkey_onlyMatchingKeyWorks(uint256 pkLain) public {
        pkLain = bound(pkLain, 1, N - 1);
        vm.assume(pkLain != passkeyPk);
        _daftar();
        uint64 t = uint64(block.timestamp + 1);
        WebAuthnLib.Auth memory a = _auth(pkLain, _digest(t), UP_UV, "webauthn.get");
        vm.expectRevert(PusakaCore.BadSignature.selector);
        _kirim(t, a);
    }
}
