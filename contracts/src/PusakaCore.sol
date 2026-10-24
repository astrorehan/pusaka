// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {FaraidLib} from "./FaraidLib.sol";
import {EstateLib} from "./EstateLib.sol";
import {WebAuthnLib} from "./WebAuthnLib.sol";

/// @title PusakaCore
/// @notice Logika bersama warisan Pusaka: saksi, timer tidak aktif, masa sanggah, lalu pembagian
///         harta bersama → wasiat → faraid. Dipakai oleh PusakaVault (brankas terpisah) dan PusakaWallet
///         (dompet pewaris sendiri lewat EIP-7702). Tanpa admin dan tanpa upgrade.
///         Prototipe testnet, bukan nasihat hukum atau fatwa.
///
///         Bukti hidup tidak perlu tombol. Ada tiga jalan, semuanya mengulang timer dan, selama masa sanggah,
///         membatalkan pemicu: (1) aktivitas biasa dari dompet pewaris (PusakaWallet.execute, penarikan brankas),
///         (2) kabar hidup yang cukup ditandatangani lalu dikirim siapa pun, jadi pewaris tidak membayar gas,
///         (3) tombol `heartbeat()` sebagai cadangan.
/// @dev Semua data disimpan di satu slot bernama (ERC-7201). Ini penting untuk EIP-7702: kodenya berjalan di
///      penyimpanan dompet pewaris, jadi datanya tidak boleh bertabrakan dengan kontrak lain yang pernah dipakai dompet itu.
///      Domain EIP-712 dihitung tanpa penyimpanan, dengan alamat yang sedang menjalankan kode (dompet atau brankas).
abstract contract PusakaCore {
    using SafeERC20 for IERC20;

    enum Status {
        None, // belum dipasang
        Active,
        Triggered,
        Distributed
    }

    enum TriggerReason {
        None,
        Witnesses,
        Inactivity
    }

    struct Heir {
        address wallet;
        FaraidLib.Relation relation;
    }

    /// @dev Wasiat untuk bukan ahli waris, mis. wakaf masjid. `share` dihitung dari harta warisan.
    struct Bequest {
        address to;
        FaraidLib.Frac share;
    }

    struct Config {
        bool deceasedMale;
        uint8 siblings;
        bool otherRelatives;
        bool raddToSpouse; // default false (jumhur)
        uint32 inactivityPeriod; // detik
        uint32 challengePeriod; // detik
        uint8 witnessThreshold; // mis. 2
        FaraidLib.Frac jointProperty; // bagian saldo yang merupakan harta bersama; 0/1 = tidak ada
    }

    /// @notice Semua data yang dibutuhkan layar dalam satu panggilan.
    struct Summary {
        uint8 kind; // 1 = brankas, 2 = dompet pewaris (EIP-7702)
        address owner;
        address token; // aset utama yang ditampilkan di layar (token pertama)
        Status status;
        TriggerReason triggerReason;
        uint256 balance;
        uint64 timestamp; // waktu blok saat ini, agar hitung mundur di layar tidak bergantung jam perangkat
        uint64 lastHeartbeat;
        uint64 inactivityReadyAt;
        uint64 triggeredAt;
        uint64 challengeEndsAt;
        uint64 distributedAt;
        uint256 distributedTotal;
        uint8 attestations;
        uint8 witnessCount;
        uint8 heirCount;
        Config config;
        uint8 lastProofVia; // bukti hidup terakhir: 0 pemasangan · 1 tombol · 2 tanda tangan · 3 aktivitas dompet · 4 passkey
        uint256 round; // putaran konfirmasi saksi; ditandatangani saksi pada attestDeathFor()
    }

    struct HeirShare {
        address wallet;
        FaraidLib.Relation relation;
        uint256 num; // bagian faraid per orang
        uint256 den;
        uint256 faraidAmount;
        uint256 jointAmount; // dari harta bersama; hanya untuk pasangan
    }

    struct BequestShare {
        address to;
        uint256 num;
        uint256 den;
        uint256 amount;
    }

    /// @notice Rincian pembagian token utama. Setelah dibagikan, dihitung dari jumlah yang dibagikan.
    struct Preview {
        uint256 balance;
        uint256 jointAmount;
        uint256 faraidPool;
        uint8 flags;
        HeirShare[] heirs;
        BequestShare[] bequests;
    }

    /// @custom:storage-location erc7201:pusaka.storage
    struct Layout {
        address owner;
        Status status;
        TriggerReason triggerReason;
        uint8 attestations;
        uint64 lastHeartbeat;
        uint64 triggeredAt;
        uint64 challengeEndsAt;
        uint64 distributedAt;
        // Konfirmasi saksi dicatat per "putaran". heartbeat() menaikkan putaran, jadi konfirmasi lama hangus.
        uint256 round;
        Config config;
        FaraidLib.Family family;
        address[] tokens;
        Heir[] heirs;
        address[] witnesses;
        Bequest[] bequests;
        mapping(address => bool) isWitness;
        mapping(address => uint256) attestedRound;
        mapping(address => uint256) distributed; // token => jumlah yang dibagikan
        uint8 lastProofVia;
        // Passkey pewaris (kunci publik P-256) untuk kabar hidup dengan sidik jari. Nol berarti belum didaftarkan.
        bytes32 passkeyX;
        bytes32 passkeyY;
    }

    // keccak256(abi.encode(uint256(keccak256("pusaka.storage")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_SLOT = 0x70833386bee14472c9a3936b28f0a1b76f0a1896245331fff7b90413b5687900;

    uint256 public constant MAX_HEIRS = 20;
    uint256 public constant MAX_WITNESSES = 5;
    uint256 public constant MAX_TOKENS = 5;
    /// @notice Jam perangkat penanda tangan boleh lebih cepat dari jam blok paling banyak sebesar ini.
    uint64 public constant MAX_CLOCK_SKEW = 10 minutes;

    /// @dev Sumber bukti hidup, dicatat di event Heartbeat dan di ringkasan.
    uint8 internal constant VIA_BUTTON = 1;
    uint8 internal constant VIA_SIGNATURE = 2;
    uint8 internal constant VIA_ACTIVITY = 3;
    uint8 internal constant VIA_PASSKEY = 4;

    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH = keccak256("Pusaka");
    bytes32 private constant VERSION_HASH = keccak256("1");
    /// @dev Pesan kabar hidup selalu sama, agar tampilannya di aplikasi dompet jelas dibaca.
    bytes32 private constant CHECKIN_TYPEHASH = keccak256("KabarHidup(string pesan,uint64 waktu)");
    bytes32 private constant CHECKIN_MESSAGE_HASH = keccak256("Saya masih hidup");
    bytes32 private constant ATTEST_TYPEHASH = keccak256("KonfirmasiWafat(address saksi,bytes32 bukti,uint256 putaran)");

    event Configured(address indexed owner);
    /// @param via 1 tombol · 2 tanda tangan · 3 aktivitas dompet
    event Heartbeat(uint64 at, uint8 via);
    event PasskeyDiatur(bytes32 x, bytes32 y);
    event DeathAttested(address indexed witness, bytes32 evidenceHash, uint8 count);
    event Triggered(TriggerReason reason, uint64 at, uint64 challengeEndsAt);
    event TriggerCancelled(uint64 at);
    event Distributed(address indexed token, uint256 total, uint8 flags);
    event JointShareSent(address indexed token, address indexed spouse, uint256 amount);
    event BequestSent(address indexed token, address indexed to, uint256 amount);
    event ShareSent(address indexed token, address indexed heir, FaraidLib.Relation relation, uint256 amount);
    /// @dev Token yang gagal dikirim tetap di alamat ini; token dan penerima lain tetap dibagikan.
    event TransferFailed(address indexed token, address indexed to, uint256 amount);

    error NotOwner();
    error NotWitness();
    error AlreadyAttested();
    error WrongStatus(Status current);
    error TooEarly(uint64 readyAt);
    error ChallengeOver();
    error BadSignature();
    /// @dev Kabar hidup tidak lebih baru dari bukti hidup terakhir, atau ditandatangani sebelum pemicu berjalan.
    error StaleCheckIn();
    error CheckInFromFuture();
    /// @dev 1 jumlah ahli waris 0 atau > 20 · 2 jumlah saksi 0 atau > 5 · 3 ambang saksi 0 atau > jumlah saksi
    ///      4 alamat nol · 5 alamat ganda (pewaris, ahli waris, saksi, dan penerima wasiat harus berbeda semua)
    ///      6 ayah/ibu lebih dari satu · 7 batas tidak aktif atau masa sanggah = 0 · 8 jumlah token 0, > 5, atau ganda
    error InvalidConfig(uint8 code);

    modifier onlyOwner() {
        if (msg.sender != _l().owner) revert NotOwner();
        _;
    }

    modifier inStatus(Status s) {
        Status current = _l().status;
        if (current != s) revert WrongStatus(current);
        _;
    }

    // ------------------------------------------------------------------
    // Pewaris
    // ------------------------------------------------------------------

    /// @notice "Saya masih hidup" lewat transaksi. Cadangan: biasanya bukti hidup datang dari aktivitas dompet atau
    ///         kabar hidup bertanda tangan. Mengulang timer dan menghapus konfirmasi saksi yang sudah masuk.
    ///         Jika sudah DIPICU tetapi masa sanggah belum habis, kembali AKTIF.
    function heartbeat() external onlyOwner {
        _alive(uint64(block.timestamp), VIA_BUTTON);
    }

    /// @notice Kabar hidup yang ditandatangani pewaris (EIP-712 `KabarHidup`), boleh dikirim siapa pun, misalnya
    ///         relayer Pusaka. Pewaris cukup menandatangani dari tautan pengingat, tanpa gas. Efeknya sama dengan
    ///         heartbeat(): timer diulang, dan selama masa sanggah, pemicu dibatalkan.
    /// @param waktu Waktu tanda tangan (detik). Harus lebih baru dari bukti hidup terakhir, sehingga tanda tangan yang
    ///        sama tidak bisa dipakai dua kali. Boleh sedikit di depan jam blok (MAX_CLOCK_SKEW), karena jam blok
    ///        beresolusi 1 detik sementara blok Monad terbentuk tiap ±0,4 detik. Jika pemicu sudah berjalan, harus
    ///        ditandatangani setelah pemicu, agar kabar lama tidak bisa membatalkan konfirmasi saksi.
    function checkIn(uint64 waktu, bytes calldata signature) external {
        Layout storage l = _l();
        bytes32 digest = _hashTypedData(keccak256(abi.encode(CHECKIN_TYPEHASH, CHECKIN_MESSAGE_HASH, waktu)));
        if (!_signedBy(l.owner, digest, signature)) revert BadSignature();
        _cekWaktuKabar(l, waktu);
        _alive(waktu, VIA_SIGNATURE);
    }

    /// @notice Daftarkan passkey pewaris (kunci publik P-256 dari HP: sidik jari atau wajah) untuk kabar hidup.
    ///         Biasanya dikirim lewat execute() dari dompet pewaris. Nol untuk menghapus.
    function aturPasskey(bytes32 x, bytes32 y) external onlyOwner {
        Layout storage l = _l();
        l.passkeyX = x;
        l.passkeyY = y;
        emit PasskeyDiatur(x, y);
    }

    /// @notice Kabar hidup yang ditandatangani passkey pewaris, boleh dikirim siapa pun (relayer). Pewaris cukup
    ///         menyentuh sidik jari; tanpa gas, tanpa kunci dompet di HP. Challenge WebAuthn-nya adalah digest
    ///         EIP-712 `KabarHidup` yang sama dengan checkIn(), jadi aturan waktunya pun sama.
    function checkInPasskey(uint64 waktu, WebAuthnLib.Auth calldata auth) external {
        Layout storage l = _l();
        if (l.passkeyX == 0 && l.passkeyY == 0) revert BadSignature();
        bytes32 digest = _hashTypedData(keccak256(abi.encode(CHECKIN_TYPEHASH, CHECKIN_MESSAGE_HASH, waktu)));
        if (!WebAuthnLib.verify(abi.encodePacked(digest), auth, l.passkeyX, l.passkeyY)) revert BadSignature();
        _cekWaktuKabar(l, waktu);
        _alive(waktu, VIA_PASSKEY);
    }

    function passkey() external view returns (bytes32 x, bytes32 y) {
        Layout storage l = _l();
        return (l.passkeyX, l.passkeyY);
    }

    // ------------------------------------------------------------------
    // Saksi
    // ------------------------------------------------------------------

    /// @param evidenceHash Hash akta kematian, dihitung di browser. File-nya sendiri tidak dikirim.
    function attestDeath(bytes32 evidenceHash) external inStatus(Status.Active) {
        _attest(msg.sender, evidenceHash);
    }

    /// @notice Konfirmasi wafat yang ditandatangani saksi (EIP-712 `KonfirmasiWafat`), boleh dikirim siapa pun.
    ///         Saksi cukup membuka tautan dan menandatangani; gasnya dibayar relayer. Tanda tangan berlaku untuk
    ///         putaran saat ini saja (lihat `Summary.round`), jadi tidak bisa dipakai ulang setelah heartbeat.
    function attestDeathFor(address witness, bytes32 evidenceHash, bytes calldata signature)
        external
        inStatus(Status.Active)
    {
        Layout storage l = _l();
        if (!l.isWitness[witness]) revert NotWitness();
        bytes32 digest = _hashTypedData(keccak256(abi.encode(ATTEST_TYPEHASH, witness, evidenceHash, l.round)));
        if (!_signedBy(witness, digest, signature)) revert BadSignature();
        _attest(witness, evidenceHash);
    }

    // ------------------------------------------------------------------
    // Siapa pun
    // ------------------------------------------------------------------

    function triggerByInactivity() external inStatus(Status.Active) {
        Layout storage l = _l();
        uint64 readyAt = l.lastHeartbeat + l.config.inactivityPeriod;
        if (block.timestamp < readyAt) revert TooEarly(readyAt);
        _trigger(TriggerReason.Inactivity);
    }

    /// @notice Membagikan seluruh saldo setiap token: harta bersama → wasiat → faraid. Hanya sekali,
    ///         setelah masa sanggah habis.
    function finalize() external {
        Layout storage l = _l();
        if (l.status != Status.Triggered) revert WrongStatus(l.status);
        if (block.timestamp < l.challengeEndsAt) revert TooEarly(l.challengeEndsAt);

        // Checks-effects-interactions: status diubah sebelum token dikirim.
        l.status = Status.Distributed;
        l.distributedAt = uint64(block.timestamp);

        FaraidLib.Result memory r = FaraidLib.compute(l.family, l.config.raddToSpouse);
        FaraidLib.Frac[] memory heirShares = _heirShares(l, r);
        FaraidLib.Frac[] memory bequestShares = _bequestShares(l.bequests);
        for (uint256 t; t < l.tokens.length; t++) {
            _distribute(l, IERC20(l.tokens[t]), heirShares, bequestShares, r.flags);
        }
    }

    // ------------------------------------------------------------------
    // Baca
    // ------------------------------------------------------------------

    function owner() external view returns (address) {
        return _l().owner;
    }

    function status() external view returns (Status) {
        return _l().status;
    }

    function isWitness(address account) external view returns (bool) {
        return _l().isWitness[account];
    }

    function getSummary() external view returns (Summary memory s) {
        Layout storage l = _l();
        s.kind = _kind();
        s.owner = l.owner;
        s.status = l.status;
        s.triggerReason = l.triggerReason;
        s.timestamp = uint64(block.timestamp);
        s.lastHeartbeat = l.lastHeartbeat;
        s.inactivityReadyAt = l.lastHeartbeat + l.config.inactivityPeriod;
        s.triggeredAt = l.triggeredAt;
        s.challengeEndsAt = l.challengeEndsAt;
        s.distributedAt = l.distributedAt;
        s.attestations = l.attestations;
        s.witnessCount = uint8(l.witnesses.length);
        s.heirCount = uint8(l.heirs.length);
        s.config = l.config;
        s.lastProofVia = l.lastProofVia;
        s.round = l.round;
        if (l.tokens.length > 0) {
            s.token = l.tokens[0];
            s.balance = IERC20(s.token).balanceOf(address(this));
            s.distributedTotal = l.distributed[s.token];
        }
    }

    function preview() external view returns (Preview memory p) {
        Layout storage l = _l();
        if (l.status == Status.None) return p;

        address token = l.tokens[0];
        p.balance =
            l.status == Status.Distributed ? l.distributed[token] : IERC20(token).balanceOf(address(this));

        FaraidLib.Result memory r = FaraidLib.compute(l.family, l.config.raddToSpouse);
        FaraidLib.Frac[] memory heirShares = _heirShares(l, r);
        EstateLib.Plan memory plan =
            EstateLib.plan(p.balance, l.config.jointProperty, _bequestShares(l.bequests), heirShares);
        p.jointAmount = plan.jointAmount;
        p.faraidPool = plan.faraidPool;
        p.flags = r.flags;

        uint256 spouse = _spouseIndex(l);
        p.heirs = new HeirShare[](l.heirs.length);
        for (uint256 i; i < l.heirs.length; i++) {
            p.heirs[i] = HeirShare({
                wallet: l.heirs[i].wallet,
                relation: l.heirs[i].relation,
                num: heirShares[i].num,
                den: heirShares[i].den,
                faraidAmount: plan.heirAmounts[i],
                jointAmount: i == spouse ? plan.jointAmount : 0
            });
        }
        p.bequests = new BequestShare[](l.bequests.length);
        for (uint256 i; i < l.bequests.length; i++) {
            Bequest storage b = l.bequests[i];
            p.bequests[i] = BequestShare(b.to, b.share.num, b.share.den, plan.bequestAmounts[i]);
        }
    }

    function getTokens() external view returns (address[] memory) {
        return _l().tokens;
    }

    function getHeirs() external view returns (Heir[] memory) {
        return _l().heirs;
    }

    function getBequests() external view returns (Bequest[] memory) {
        return _l().bequests;
    }

    /// @notice Daftar saksi dan apakah masing-masing sudah mengonfirmasi di putaran ini.
    function getWitnesses() external view returns (address[] memory witnesses, bool[] memory attested) {
        Layout storage l = _l();
        witnesses = l.witnesses;
        attested = new bool[](witnesses.length);
        for (uint256 i; i < witnesses.length; i++) {
            attested[i] = l.attestedRound[witnesses[i]] == l.round;
        }
    }

    function getConfig() external view returns (Config memory) {
        return _l().config;
    }

    function getFamily() external view returns (FaraidLib.Family memory) {
        return _l().family;
    }

    /// @notice Domain EIP-712 (ERC-5267) untuk kabar hidup dan konfirmasi saksi bertanda tangan.
    function eip712Domain()
        external
        view
        returns (
            bytes1 fields,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            bytes32 salt,
            uint256[] memory extensions
        )
    {
        return (hex"0f", "Pusaka", "1", block.chainid, address(this), bytes32(0), new uint256[](0));
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    /// @dev 1 = brankas, 2 = dompet pewaris (EIP-7702).
    function _kind() internal pure virtual returns (uint8);

    function _l() internal pure returns (Layout storage l) {
        assembly {
            l.slot := STORAGE_SLOT
        }
    }

    /// @dev Memeriksa semua data, lalu menyimpannya. Keluarga yang tidak valid atau belum didukung langsung ditolak.
    function _init(
        address owner_,
        address[] memory tokens_,
        Heir[] memory heirs_,
        address[] memory witnesses_,
        Bequest[] memory bequests_,
        Config memory cfg
    ) internal {
        Layout storage l = _l();
        if (l.status != Status.None) revert WrongStatus(l.status);
        if (heirs_.length == 0 || heirs_.length > MAX_HEIRS) revert InvalidConfig(1);
        if (witnesses_.length == 0 || witnesses_.length > MAX_WITNESSES) revert InvalidConfig(2);
        if (cfg.witnessThreshold == 0 || cfg.witnessThreshold > witnesses_.length) revert InvalidConfig(3);
        if (cfg.inactivityPeriod == 0 || cfg.challengePeriod == 0) revert InvalidConfig(7);
        _checkTokens(tokens_);

        FaraidLib.Family memory f = _familyOf(heirs_, cfg);
        FaraidLib.compute(f, cfg.raddToSpouse);
        EstateLib.validate(cfg.jointProperty, _bequestShares(bequests_), f);
        _checkAddresses(owner_, heirs_, witnesses_, bequests_);

        l.owner = owner_;
        l.status = Status.Active;
        l.lastHeartbeat = uint64(block.timestamp);
        l.round++;
        l.config = cfg;
        l.family = f;
        for (uint256 i; i < tokens_.length; i++) {
            l.tokens.push(tokens_[i]);
        }
        for (uint256 i; i < heirs_.length; i++) {
            l.heirs.push(heirs_[i]);
        }
        for (uint256 i; i < witnesses_.length; i++) {
            l.witnesses.push(witnesses_[i]);
            l.isWitness[witnesses_[i]] = true;
        }
        for (uint256 i; i < bequests_.length; i++) {
            l.bequests.push(bequests_[i]);
        }
        emit Configured(owner_);
    }

    /// @dev Menghapus semua pengaturan sehingga bisa dipasang ulang. Putaran saksi sengaja tidak direset:
    ///      _init() menaikkannya, jadi konfirmasi dari pengaturan lama tidak pernah berlaku lagi.
    function _clear() internal {
        Layout storage l = _l();
        for (uint256 i; i < l.witnesses.length; i++) {
            l.isWitness[l.witnesses[i]] = false;
        }
        delete l.tokens;
        delete l.heirs;
        delete l.witnesses;
        delete l.bequests;
        delete l.config;
        delete l.family;
        l.owner = address(0);
        l.status = Status.None;
        l.triggerReason = TriggerReason.None;
        l.attestations = 0;
        l.lastHeartbeat = 0;
        l.lastProofVia = 0;
        l.triggeredAt = 0;
        l.challengeEndsAt = 0;
        l.passkeyX = 0;
        l.passkeyY = 0;
    }

    /// @dev Aktivitas pewaris dihitung sebagai bukti hidup. Tidak pernah menggagalkan transaksinya: setelah masa
    ///      sanggah habis atau setelah dibagikan, aktivitas tidak mengubah apa pun.
    function _touch() internal {
        Layout storage l = _l();
        if (l.status == Status.Active || (l.status == Status.Triggered && block.timestamp < l.challengeEndsAt)) {
            _alive(uint64(block.timestamp), VIA_ACTIVITY);
        }
    }

    /// @dev Bukti hidup: timer diulang, konfirmasi saksi hangus, dan pemicu dibatalkan selama masa sanggah.
    ///      Waktu bukti hidup tidak pernah mundur (kabar hidup bisa bertanggal beberapa saat di depan jam blok), agar
    ///      tanda tangan kabar hidup lama tidak bisa dipakai ulang.
    function _alive(uint64 at, uint8 via) private {
        Layout storage l = _l();
        if (l.status == Status.Triggered) {
            if (block.timestamp >= l.challengeEndsAt) revert ChallengeOver();
            l.status = Status.Active;
            l.triggerReason = TriggerReason.None;
            l.triggeredAt = 0;
            l.challengeEndsAt = 0;
            emit TriggerCancelled(uint64(block.timestamp));
        } else if (l.status != Status.Active) {
            revert WrongStatus(l.status);
        }
        l.round++;
        l.attestations = 0;
        if (at > l.lastHeartbeat) l.lastHeartbeat = at;
        l.lastProofVia = via;
        emit Heartbeat(l.lastHeartbeat, via);
    }

    /// @dev Kabar hidup harus lebih baru dari bukti hidup terakhir (tidak bisa diputar ulang), tidak terlalu jauh di
    ///      depan jam blok, dan jika pemicu sudah berjalan, ditandatangani setelah pemicu.
    function _cekWaktuKabar(Layout storage l, uint64 waktu) private view {
        if (waktu > block.timestamp + MAX_CLOCK_SKEW) revert CheckInFromFuture();
        if (waktu <= l.lastHeartbeat) revert StaleCheckIn();
        if (l.status == Status.Triggered && waktu < l.triggeredAt) revert StaleCheckIn();
    }

    function _attest(address witness, bytes32 evidenceHash) private {
        Layout storage l = _l();
        if (!l.isWitness[witness]) revert NotWitness();
        if (l.attestedRound[witness] == l.round) revert AlreadyAttested();
        l.attestedRound[witness] = l.round;
        l.attestations++;
        emit DeathAttested(witness, evidenceHash, l.attestations);
        if (l.attestations >= l.config.witnessThreshold) _trigger(TriggerReason.Witnesses);
    }

    function _hashTypedData(bytes32 structHash) internal view returns (bytes32) {
        bytes32 domain = keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
        return MessageHashUtils.toTypedDataHash(domain, structHash);
    }

    /// @dev Tanda tangan ECDSA biasa, atau ERC-1271 jika penanda tangannya kontrak (mis. dompet pintar).
    function _signedBy(address signer, bytes32 digest, bytes calldata signature) internal view returns (bool) {
        if (signer == address(0)) return false;
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        if (err == ECDSA.RecoverError.NoError && recovered == signer) return true;
        return signer.code.length > 0 && SignatureChecker.isValidERC1271SignatureNow(signer, digest, signature);
    }

    function _trigger(TriggerReason reason) internal {
        Layout storage l = _l();
        l.status = Status.Triggered;
        l.triggerReason = reason;
        l.triggeredAt = uint64(block.timestamp);
        l.challengeEndsAt = l.triggeredAt + l.config.challengePeriod;
        emit Triggered(reason, l.triggeredAt, l.challengeEndsAt);
    }

    function _distribute(
        Layout storage l,
        IERC20 token,
        FaraidLib.Frac[] memory heirShares,
        FaraidLib.Frac[] memory bequestShares,
        uint8 flags
    ) private {
        // Token yang rusak tidak boleh menghalangi pembagian token lain. Alamat tanpa kontrak (salah ketik, bukan
        // token) juga dianggap rusak: `try` tidak menangkap kegagalan membaca hasil dari alamat kosong.
        if (address(token).code.length == 0) {
            emit TransferFailed(address(token), address(0), 0);
            return;
        }
        uint256 balance;
        try token.balanceOf(address(this)) returns (uint256 b) {
            balance = b;
        } catch {
            emit TransferFailed(address(token), address(0), 0);
            return;
        }
        l.distributed[address(token)] = balance;
        emit Distributed(address(token), balance, flags);

        EstateLib.Plan memory p = EstateLib.plan(balance, l.config.jointProperty, bequestShares, heirShares);
        if (p.jointAmount > 0) {
            address spouse = l.heirs[_spouseIndex(l)].wallet;
            if (_pay(token, spouse, p.jointAmount)) emit JointShareSent(address(token), spouse, p.jointAmount);
        }
        for (uint256 i; i < l.bequests.length; i++) {
            address to = l.bequests[i].to;
            if (_pay(token, to, p.bequestAmounts[i])) emit BequestSent(address(token), to, p.bequestAmounts[i]);
        }
        for (uint256 i; i < l.heirs.length; i++) {
            Heir storage h = l.heirs[i];
            if (_pay(token, h.wallet, p.heirAmounts[i])) {
                emit ShareSent(address(token), h.wallet, h.relation, p.heirAmounts[i]);
            }
        }
    }

    /// @dev Mengembalikan false (dan mencatat event) jika transfer gagal, alih-alih membatalkan seluruh pembagian.
    function _pay(IERC20 token, address to, uint256 amount) private returns (bool) {
        if (amount == 0) return true;
        if (token.trySafeTransfer(to, amount)) return true;
        emit TransferFailed(address(token), to, amount);
        return false;
    }

    function _familyOf(Heir[] memory heirs_, Config memory cfg) private pure returns (FaraidLib.Family memory f) {
        f.deceasedMale = cfg.deceasedMale;
        f.siblings = cfg.siblings;
        f.otherRelatives = cfg.otherRelatives;
        uint8 fathers;
        uint8 mothers;
        for (uint256 i; i < heirs_.length; i++) {
            FaraidLib.Relation rel = heirs_[i].relation;
            if (rel == FaraidLib.Relation.Husband) f.husband++;
            else if (rel == FaraidLib.Relation.Wife) f.wives++;
            else if (rel == FaraidLib.Relation.Son) f.sons++;
            else if (rel == FaraidLib.Relation.Daughter) f.daughters++;
            else if (rel == FaraidLib.Relation.Father) fathers++;
            else mothers++;
        }
        if (fathers > 1 || mothers > 1) revert InvalidConfig(6);
        f.father = fathers == 1;
        f.mother = mothers == 1;
    }

    function _checkTokens(address[] memory tokens_) private pure {
        if (tokens_.length == 0 || tokens_.length > MAX_TOKENS) revert InvalidConfig(8);
        for (uint256 i; i < tokens_.length; i++) {
            if (tokens_[i] == address(0)) revert InvalidConfig(4);
            for (uint256 j; j < i; j++) {
                if (tokens_[i] == tokens_[j]) revert InvalidConfig(8);
            }
        }
    }

    /// @dev Pewaris, ahli waris, saksi, dan penerima wasiat harus alamat berbeda dan bukan nol.
    ///      Saksi yang juga penerima bisa tergoda mengonfirmasi palsu.
    function _checkAddresses(
        address owner_,
        Heir[] memory heirs_,
        address[] memory witnesses_,
        Bequest[] memory bequests_
    ) private pure {
        address[] memory seen = new address[](1 + heirs_.length + witnesses_.length + bequests_.length);
        seen[0] = owner_;
        uint256 k = 1;
        for (uint256 i; i < heirs_.length; i++) {
            seen[k++] = heirs_[i].wallet;
        }
        for (uint256 i; i < witnesses_.length; i++) {
            seen[k++] = witnesses_[i];
        }
        for (uint256 i; i < bequests_.length; i++) {
            seen[k++] = bequests_[i].to;
        }
        for (uint256 i; i < seen.length; i++) {
            if (seen[i] == address(0)) revert InvalidConfig(4);
            for (uint256 j; j < i; j++) {
                if (seen[i] == seen[j]) revert InvalidConfig(5);
            }
        }
    }

    function _heirShares(Layout storage l, FaraidLib.Result memory r)
        private
        view
        returns (FaraidLib.Frac[] memory shares)
    {
        shares = new FaraidLib.Frac[](l.heirs.length);
        for (uint256 i; i < l.heirs.length; i++) {
            shares[i] = _shareOf(r, l.heirs[i].relation);
        }
    }

    function _bequestShares(Bequest[] memory bequests_) private pure returns (FaraidLib.Frac[] memory shares) {
        shares = new FaraidLib.Frac[](bequests_.length);
        for (uint256 i; i < bequests_.length; i++) {
            shares[i] = bequests_[i].share;
        }
    }

    /// @dev Indeks suami/istri di daftar ahli waris; type(uint256).max jika tidak ada.
    ///      Jika ada harta bersama, pasangan dijamin tepat satu (EstateLib.validate).
    function _spouseIndex(Layout storage l) private view returns (uint256) {
        for (uint256 i; i < l.heirs.length; i++) {
            FaraidLib.Relation rel = l.heirs[i].relation;
            if (rel == FaraidLib.Relation.Husband || rel == FaraidLib.Relation.Wife) return i;
        }
        return type(uint256).max;
    }

    function _shareOf(FaraidLib.Result memory r, FaraidLib.Relation rel) private pure returns (FaraidLib.Frac memory) {
        if (rel == FaraidLib.Relation.Husband) return r.husband;
        if (rel == FaraidLib.Relation.Wife) return r.wifeEach;
        if (rel == FaraidLib.Relation.Son) return r.sonEach;
        if (rel == FaraidLib.Relation.Daughter) return r.daughterEach;
        if (rel == FaraidLib.Relation.Father) return r.father;
        return r.mother;
    }
}
