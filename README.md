# Pusaka

Warisan kripto yang dibagi sesuai KHI (harta bersama → wasiat → faraid) di blockchain Monad. Aturannya dipasang
langsung di dompet pewaris lewat EIP-7702, jadi hartanya tidak perlu dipindah.
Dibuat di **Monad Blitz Jogja Vol. 2**, Sabtu 24 Oktober 2026, GIK UGM.

**Ahli waris tidak perlu dompet. Pewaris tidak perlu menekan tombol.**

- Ahli waris menerima lewat **rekening bank** (rekening virtual di mitra pencairan → transfer BI-FAST; di testnet
  disimulasikan), **amplop digital** (tautan WhatsApp, dicairkan ke bank atau e-wallet dari HP), atau dompet kripto.
- Bukti hidup datang dari **aktivitas dompet**, **kabar hidup bertanda tangan** yang dikirim relayer (Rp0 untuk
  pewaris), atau **sidik jari** (passkey, diverifikasi precompile P-256 Monad). Batas bawaan 12 bulan. Saksi juga
  cukup menandatangani.

## Demo dan kontrak

| | |
|---|---|
| Demo live | _menyusul_ |
| Jaringan | Monad testnet (chain id 10143) |
| `PusakaWallet` | _menyusul_ |
| `MitraCair` | _menyusul_ |
| `MockIDR` (tIDR) | _menyusul_ |

## Isi folder

| Path | Isi |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Dokumen produk. **Mulai baca di sini**, termasuk naskah pitch dan jawaban untuk juri |
| [`docs/arsitektur.md`](docs/arsitektur.md) | Cara kerja kontrak: model dompet EIP-7702 dan brankas, urutan KHI, bukti hidup, mitra pencairan, fungsi, error, gas |
| [`docs/faraid-spec.md`](docs/faraid-spec.md) | Aturan faraid, algoritma, dan 24 kasus uji |
| [`docs/penilaian.md`](docs/penilaian.md) | Kriteria penilaian Monad Blitz Jogja Vol. 2 |
| [`contracts/`](contracts/README.md) | Kontrak Solidity (Foundry) |
| [`web/`](web/README.md) | Aplikasi web (Vite + viem + GSAP): 9 layar yang tersambung ke kontrak |

## Menjalankan

Butuh [Foundry](https://getfoundry.sh) dan Node.js 20+.

```bash
git clone --recurse-submodules <url repo>
cd pusaka-blitz/contracts && forge test     # semua tes kontrak
```

Menjalankan web di blockchain lokal (anvil) atau di Monad testnet dijelaskan di [`web/README.md`](web/README.md).
Uji ujung ke ujung dengan transaksi sungguhan:

```bash
anvil --network monad --block-time 1 --mixed-mining --code-size-limit 131072   # terminal 1
cd web && npm install && node scripts/e2e.mjs                                  # terminal 2
```

## Urutan membaca untuk pemula

1. PRD bagian "Fitur utama", lalu bagian 1–2: apa masalahnya dan apa yang dibangun.
2. PRD bagian 6: konsep web3 yang dipakai proyek ini.
3. `arsitektur.md` bagian 1–6: dua model, EIP-7702, urutan pembagian, bukti hidup, saksi, mitra pencairan.
4. `faraid-spec.md` bagian 3 dan 8: istilah faraid dan contoh pembagian.
5. PRD bagian 13: naskah demo 3 menit dan pertanyaan juri.

> Prototipe di Monad testnet dengan rupiah mainan (tIDR). Bukan nasihat hukum atau fatwa.
