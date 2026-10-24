// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

interface IBurnable {
    function burn(uint256 value) external;
}

/// @title RekeningVirtual
/// @notice Alamat setoran untuk satu rekening bank, seperti nomor virtual account. Token yang masuk ke sini hanya bisa
///         dipindahkan oleh MitraCair, yang lalu mencairkannya ke rekening bank pemiliknya.
/// @dev Dibuat sebagai klon deterministik (CREATE2), jadi alamatnya sudah bisa dipakai sebagai alamat ahli waris
///      sebelum kontraknya ada. `mitra` adalah immutable di kontrak cetakan, jadi sama untuk semua klon.
contract RekeningVirtual {
    using SafeERC20 for IERC20;

    address public immutable mitra;

    error BukanMitra();

    constructor() {
        mitra = msg.sender;
    }

    function sapu(IERC20 token) external returns (uint256 jumlah) {
        if (msg.sender != mitra) revert BukanMitra();
        jumlah = token.balanceOf(address(this));
        if (jumlah > 0) token.safeTransfer(msg.sender, jumlah);
    }
}

/// @title MitraCair
/// @notice Simulasi mitra pencairan (off-ramp) rupiah untuk testnet. Di dunia nyata perannya diisi penerbit stablecoin
///         rupiah atau exchange berizin: token ditukar kembali ke rupiah, lalu dikirim ke rekening bank atau e-wallet.
///         Di sini transfer banknya disimulasikan oleh operator. Yang tercatat di blockchain: rekening tujuan (hanya nama
///         bank dan empat digit terakhir), permintaan pencairan, pembakaran token, dan nomor referensi transfer.
///
///         Dua jalan masuk:
///         1. Rekening virtual. Alamat setoran per rekening bank (`alamatVA`). Pewaris memakainya sebagai alamat ahli
///            waris, jadi bagian ahli waris itu langsung menuju rekening banknya tanpa ahli waris melakukan apa pun.
///         2. `cairkan()`. Pemegang token (mis. ahli waris yang membuka amplop digital) mencairkan ke rekening atau
///            e-wallet pilihannya dalam satu transaksi, memakai izin bertanda tangan EIP-2612.
/// @dev Data pribadi tidak disimpan. `sidik` adalah hash rincian rekening (bank, nomor, nama, garam) yang dihitung di
///      perangkat; id rekening = keccak256(pendaftar, sidik), jadi pendaftar lain tidak bisa menyerobot id yang sama.
contract MitraCair {
    using SafeERC20 for IERC20;

    enum Tahap {
        Tidak,
        Diproses,
        Selesai,
        Dikembalikan
    }

    struct Rekening {
        string bank; // nama bank atau e-wallet, mis. "BRI", "GoPay"
        string akhiran; // empat digit terakhir untuk tampilan, mis. "7781"
        address va; // alamat setoran (rekening virtual)
        address cadangan; // ke mana dana dikembalikan jika transfer bank gagal
        uint64 dibuat;
    }

    struct Pencairan {
        bytes32 rekening;
        address dari; // rekening virtual atau pemegang token yang mencairkan
        uint64 diminta;
        uint128 jumlah;
        uint64 selesai;
        Tahap tahap;
        bytes32 bukti; // nomor referensi transfer bank (simulasi)
    }

    /// @notice Semua yang dibutuhkan layar untuk satu alamat penerima, dalam satu panggilan.
    struct StatusPenerima {
        bytes32 rekening; // bukan nol jika alamat ini rekening virtual
        string bank;
        string akhiran;
        uint256 saldo; // tIDR yang masih ada di alamat ini
        bool adaPencairan;
        uint256 no;
        Pencairan pencairan; // pencairan terakhir dari alamat ini
        string bankTujuan;
        string akhiranTujuan;
    }

    uint256 public constant MAKS_BATCH = 20;

    IERC20 public immutable token;
    address public immutable rekeningImpl;
    address public immutable pemilik;
    mapping(address => bool) public isOperator;

    mapping(bytes32 => Rekening) internal _rekening;
    mapping(address => bytes32) public rekeningDariVA;
    bytes32[] internal _semuaRekening;
    Pencairan[] internal _pencairan;
    mapping(address => uint256) internal _terakhir; // alamat → nomor pencairan terakhir + 1
    /// @notice Semua pencairan sebelum nomor ini sudah tuntas.
    uint256 public antreanMulai;

    event OperatorDiatur(address indexed operator, bool aktif);
    event RekeningDidaftarkan(bytes32 indexed id, address indexed va, string bank, string akhiran, address cadangan);
    event PencairanDiminta(uint256 indexed no, bytes32 indexed rekening, address indexed dari, uint256 jumlah);
    event PencairanSelesai(uint256 indexed no, bytes32 indexed rekening, uint256 jumlah, bytes32 bukti);
    event PencairanDikembalikan(uint256 indexed no, address indexed ke, uint256 jumlah);

    error BukanPemilik();
    error BukanOperator();
    error DataTidakValid();
    error RekeningTidakAda(bytes32 id);
    error JumlahNol();
    error SudahTuntas(uint256 no);
    error TanpaCadangan(uint256 no);

    modifier hanyaOperator() {
        if (!isOperator[msg.sender]) revert BukanOperator();
        _;
    }

    constructor(IERC20 token_, address pemilik_) {
        if (address(token_) == address(0) || pemilik_ == address(0)) revert DataTidakValid();
        token = token_;
        pemilik = pemilik_;
        isOperator[pemilik_] = true;
        rekeningImpl = address(new RekeningVirtual());
        emit OperatorDiatur(pemilik_, true);
    }

    /// @notice Operator adalah pihak mitra yang benar-benar mentransfer rupiah. Di demo: kunci di laptop presenter.
    function aturOperator(address operator, bool aktif) external {
        if (msg.sender != pemilik) revert BukanPemilik();
        emit OperatorDiatur(operator, aktif);
        // forge-lint: disable-next-line(missing-events-access-control)
        isOperator[operator] = aktif;
    }

    // ------------------------------------------------------------------
    // Rekening
    // ------------------------------------------------------------------

    function idRekening(address pendaftar, bytes32 sidik) public pure returns (bytes32) {
        return keccak256(abi.encode(pendaftar, sidik));
    }

    function alamatVA(bytes32 id) public view returns (address) {
        return Clones.predictDeterministicAddress(rekeningImpl, id, address(this));
    }

    /// @notice Alamat rekening virtual untuk beberapa rekening sekaligus, sebelum didaftarkan.
    function alamatVAUntuk(address pendaftar, bytes32[] calldata sidik) external view returns (address[] memory va) {
        va = new address[](sidik.length);
        for (uint256 i; i < sidik.length; i++) {
            va[i] = alamatVA(idRekening(pendaftar, sidik[i]));
        }
    }

    /// @notice Mendaftarkan rekening tujuan. Di dunia nyata ini dilakukan mitra setelah verifikasi identitas; di simulasi
    ///         siapa pun boleh, dan id-nya terikat pada pendaftar. Mendaftar ulang rekening yang sama tidak mengubah apa pun.
    /// @param cadangan Alamat pengembalian jika transfer bank gagal (mis. amplop digital ahli waris). 0 = tidak ada.
    function daftar(bytes32 sidik, string calldata bank, string calldata akhiran, address cadangan)
        public
        returns (bytes32 id, address va)
    {
        id = idRekening(msg.sender, sidik);
        Rekening storage r = _rekening[id];
        if (r.va != address(0)) return (id, r.va);
        uint256 nb = bytes(bank).length;
        if (sidik == bytes32(0) || nb == 0 || nb > 24 || bytes(akhiran).length > 8) revert DataTidakValid();
        va = alamatVA(id);
        r.bank = bank;
        r.akhiran = akhiran;
        r.va = va;
        r.cadangan = cadangan;
        r.dibuat = uint64(block.timestamp);
        rekeningDariVA[va] = id;
        _semuaRekening.push(id);
        emit RekeningDidaftarkan(id, va, bank, akhiran, cadangan);
    }

    function daftarBanyak(
        bytes32[] calldata sidik,
        string[] calldata bank,
        string[] calldata akhiran,
        address[] calldata cadangan
    ) external returns (address[] memory va) {
        uint256 n = sidik.length;
        if (n > MAKS_BATCH || bank.length != n || akhiran.length != n || cadangan.length != n) revert DataTidakValid();
        va = new address[](n);
        for (uint256 i; i < n; i++) {
            (, va[i]) = daftar(sidik[i], bank[i], akhiran[i], cadangan[i]);
        }
    }

    // ------------------------------------------------------------------
    // Pencairan
    // ------------------------------------------------------------------

    /// @notice Siapa pun boleh memanggil: isi rekening virtual dipindah ke mitra dan dicatat sebagai permintaan
    ///         pencairan ke rekening banknya. Rekening virtual yang kosong dilewati.
    /// @return no Nomor pencairan, atau type(uint256).max jika rekening virtual kosong.
    function sapu(bytes32 id) public returns (uint256 no) {
        address va = _rekening[id].va;
        if (va == address(0)) revert RekeningTidakAda(id);
        // Kosong berarti tidak ada yang perlu disapu; bukan pemeriksaan keamanan.
        // forge-lint: disable-next-line(incorrect-strict-equality)
        if (token.balanceOf(va) == 0) return type(uint256).max;
        if (va.code.length == 0) Clones.cloneDeterministic(rekeningImpl, id);
        uint256 jumlah = RekeningVirtual(va).sapu(token);
        no = _catat(id, va, jumlah);
    }

    /// @return dibuat Jumlah permintaan pencairan baru.
    function sapuBanyak(bytes32[] calldata ids) external returns (uint256 dibuat) {
        if (ids.length > MAKS_BATCH) revert DataTidakValid();
        for (uint256 i; i < ids.length; i++) {
            if (sapu(ids[i]) != type(uint256).max) dibuat++;
        }
    }

    /// @notice Pemegang token mencairkan ke rekening bank atau e-wallet dalam satu transaksi: rekening didaftarkan
    ///         (jika belum), izin EIP-2612 dipakai, lalu token ditarik ke mitra. Jika gagal dibayar, dana kembali ke
    ///         pengirim.
    function cairkan(
        bytes32 sidik,
        string calldata bank,
        string calldata akhiran,
        uint256 jumlah,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 no) {
        if (jumlah == 0) revert JumlahNol();
        (bytes32 id,) = daftar(sidik, bank, akhiran, msg.sender);
        // Izin yang sudah dipakai orang lain lebih dulu tidak menggagalkan, selama allowance-nya cukup.
        try IERC20Permit(address(token)).permit(msg.sender, address(this), jumlah, deadline, v, r, s) {} catch {}
        token.safeTransferFrom(msg.sender, address(this), jumlah);
        no = _catat(id, msg.sender, jumlah);
    }

    /// @notice Setor ke rekening yang sudah terdaftar, dengan approve biasa. Untuk dompet yang tidak mendukung izin.
    function setor(bytes32 id, uint256 jumlah) external returns (uint256 no) {
        if (_rekening[id].va == address(0)) revert RekeningTidakAda(id);
        if (jumlah == 0) revert JumlahNol();
        token.safeTransferFrom(msg.sender, address(this), jumlah);
        no = _catat(id, msg.sender, jumlah);
    }

    /// @notice Operator menandai pencairan sudah ditransfer ke bank. Token yang ditukar dibakar.
    /// @param bukti Nomor referensi transfer bank untuk tiap pencairan.
    function selesaikan(uint256[] calldata nos, bytes32[] calldata bukti) external hanyaOperator {
        if (nos.length != bukti.length || nos.length > MAKS_BATCH) revert DataTidakValid();
        uint256 bakar;
        for (uint256 i; i < nos.length; i++) {
            Pencairan storage p = _pencairan[nos[i]];
            if (p.tahap != Tahap.Diproses) revert SudahTuntas(nos[i]);
            p.tahap = Tahap.Selesai;
            p.selesai = uint64(block.timestamp);
            p.bukti = bukti[i];
            bakar += p.jumlah;
            emit PencairanSelesai(nos[i], p.rekening, p.jumlah, bukti[i]);
        }
        _majukanAntrean();
        if (bakar > 0) IBurnable(address(token)).burn(bakar);
    }

    /// @notice Transfer bank gagal (mis. rekening sudah ditutup): dana dikembalikan ke alamat cadangan rekening itu,
    ///         atau ke pengirimnya jika ia bukan rekening virtual.
    function kembalikan(uint256 no) external hanyaOperator {
        Pencairan storage p = _pencairan[no];
        if (p.tahap != Tahap.Diproses) revert SudahTuntas(no);
        address ke = _rekening[p.rekening].cadangan;
        if (ke == address(0)) ke = p.dari;
        if (rekeningDariVA[ke] != bytes32(0)) revert TanpaCadangan(no);
        p.tahap = Tahap.Dikembalikan;
        p.selesai = uint64(block.timestamp);
        _majukanAntrean();
        emit PencairanDikembalikan(no, ke, p.jumlah);
        token.safeTransfer(ke, p.jumlah);
    }

    // ------------------------------------------------------------------
    // Baca
    // ------------------------------------------------------------------

    function getRekening(bytes32 id) external view returns (Rekening memory) {
        return _rekening[id];
    }

    function jumlahRekening() external view returns (uint256) {
        return _semuaRekening.length;
    }

    function getPencairan(uint256 no) external view returns (Pencairan memory) {
        return _pencairan[no];
    }

    function jumlahPencairan() external view returns (uint256) {
        return _pencairan.length;
    }

    /// @notice Pencairan yang masih diproses (paling banyak MAKS_BATCH), untuk operator.
    function antrean() external view returns (uint256[] memory nos) {
        uint256[] memory buf = new uint256[](MAKS_BATCH);
        uint256 k;
        for (uint256 i = antreanMulai; i < _pencairan.length && k < MAKS_BATCH; i++) {
            if (_pencairan[i].tahap == Tahap.Diproses) buf[k++] = i;
        }
        nos = new uint256[](k);
        for (uint256 i; i < k; i++) {
            nos[i] = buf[i];
        }
    }

    /// @notice Rekening virtual yang berisi token dan perlu disapu, dari rekening ke-`dari` sampai sebelum `sampai`.
    function vaBerisi(uint256 dari, uint256 sampai) external view returns (bytes32[] memory ids) {
        if (sampai > _semuaRekening.length) sampai = _semuaRekening.length;
        bytes32[] memory buf = new bytes32[](sampai > dari ? sampai - dari : 0);
        uint256 k;
        for (uint256 i = dari; i < sampai; i++) {
            bytes32 id = _semuaRekening[i];
            if (token.balanceOf(_rekening[id].va) > 0) buf[k++] = id;
        }
        ids = new bytes32[](k);
        for (uint256 i; i < k; i++) {
            ids[i] = buf[i];
        }
    }

    function statusPenerima(address a) public view returns (StatusPenerima memory st) {
        st.rekening = rekeningDariVA[a];
        if (st.rekening != bytes32(0)) {
            Rekening storage r = _rekening[st.rekening];
            st.bank = r.bank;
            st.akhiran = r.akhiran;
        }
        st.saldo = token.balanceOf(a);
        uint256 t = _terakhir[a];
        if (t > 0) {
            st.adaPencairan = true;
            st.no = t - 1;
            st.pencairan = _pencairan[t - 1];
            Rekening storage tujuan = _rekening[st.pencairan.rekening];
            st.bankTujuan = tujuan.bank;
            st.akhiranTujuan = tujuan.akhiran;
        }
    }

    function statusBanyak(address[] calldata a) external view returns (StatusPenerima[] memory st) {
        st = new StatusPenerima[](a.length);
        for (uint256 i; i < a.length; i++) {
            st[i] = statusPenerima(a[i]);
        }
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    function _catat(bytes32 id, address dari, uint256 jumlah) private returns (uint256 no) {
        no = _pencairan.length;
        _pencairan.push(
            Pencairan({
                rekening: id,
                dari: dari,
                diminta: uint64(block.timestamp),
                jumlah: SafeCast.toUint128(jumlah),
                selesai: 0,
                tahap: Tahap.Diproses,
                bukti: bytes32(0)
            })
        );
        _terakhir[dari] = no + 1;
        emit PencairanDiminta(no, id, dari, jumlah);
    }

    function _majukanAntrean() private {
        uint256 i = antreanMulai;
        uint256 n = _pencairan.length;
        while (i < n && _pencairan[i].tahap != Tahap.Diproses) {
            i++;
        }
        antreanMulai = i;
    }
}
