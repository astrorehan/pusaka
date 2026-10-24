# Penilaian Monad Blitz Vol. 2

Sumber: slide panitia, Sabtu 24 Oktober 2026 pagi.

## Aturan main

- **Pengumpulan ditutup 16:45 WIB.** Yang sudah dikumpulkan saat itu yang dinilai.
- Urutan pitch mengikuti urutan submit.
- Demo 3 menit di panggung, tanpa slide. Fokus ke demo live dan inovasi utama.
- Penontonnya semua peserta di ruangan.
- Tidak ada voting peserta.

## Total 400 poin

| Bagian | Poin |
|---|---|
| Basic, syarat bisa menang | 100 |
| Advance: apakah jalan | 100 |
| Advance: build in public | 100 |
| Bonus | 100 |

## Basic (100), syarat bisa menang

| Kriteria | Poin |
|---|---|
| Repo GitHub publik | 25 |
| README yang layak, berisi URL live dan alamat kontrak | 25 |
| Kontrak di-deploy di Monad testnet | 25 |
| Proyek di-hosting publik (host apa saja, tanpa domain custom pun boleh) | 25 |

Saat pitch, **sebutkan dengan jelas** link repo, alamat kontrak, URL live, dan deployment-nya. Tanpa ini tetap boleh pitch, tapi tidak bisa menang.

## Advance: apakah jalan (100)

| Kriteria | Poin |
|---|---|
| Semua fungsi yang diumumkan berjalan | 25 |
| Ada transaksi on-chain live saat demo | 25 |
| Kontrak terverifikasi di explorer (source dipublikasikan) | 25 |
| Orang lain bisa menjalankannya dari README, tanpa bantuan | 25 |

## Advance: build in public (100)

| Kriteria | Poin |
|---|---|
| Posting di X atau LinkedIn dengan tag @monad, @monad_dev, @geeky_kartikey | 25 |
| Video demo diposting di sosmed (minimal 30 detik, produk sedang jalan) | 25 |
| Video iklan kreatif diposting di sosmed | 25 |
| 5.000+ views, total dari semua postingan selama Blitz | 25 |

## Bonus (100)

| Kriteria | Poin | Dinilai oleh |
|---|---|---|
| Kontrak di-deploy di Monad mainnet | 25 | Panitia |
| Halaman publik di domain custom | 15 | Panitia |
| Product-market fit | sampai 20 | Juri |
| Potensi dan strategi revenue | sampai 20 | Juri |
| Inovasi dan orisinalitas | sampai 20 | Juri |

## Catatan untuk Pusaka

- Kunci dompet induk hanya ada di server (relayer `/api/induk`), tidak pernah dikirim ke browser. Versi publik tetap memakai dompet induk terpisah dengan saldo kecil.
- Kontrak di-deploy dan diverifikasi di explorer hari ini.
- Fitur Monad yang sudah dipakai dan bisa ditonjolkan: kontrak lebih besar dari 24 KB (PusakaWallet sekitar 28 KB), precompile P-256 untuk sidik jari, EIP-7702, dan konfirmasi transaksi 1–2 detik.
