# Pusaka — Product Requirements Document (PRD)

> **Harta pusaka digital, dibagi sesuai faraid. Tanpa seed phrase.**

| | |
|---|---|
| **Tanggal** | 24 Oktober 2026 |
| **Acara** | Monad Blitz Jogja Vol. 2 · Sabtu, 24 Oktober 2026 · GIK UGM |
| **Tim** | Solo |
| **Status** | Kontrak dan web jalan ujung ke ujung di anvil dan di Monad testnet (`web/scripts/e2e.mjs` lulus). Deploy resmi, verifikasi kontrak, dan hosting publik dikerjakan hari ini |
| **Dokumen pendamping** | [`faraid-spec.md`](faraid-spec.md): aturan faraid, algoritma, dan 24 kasus uji · [`arsitektur.md`](arsitektur.md): cara kerja kontrak · [`penilaian.md`](penilaian.md): penilaian panitia |

## Fitur utama

Dua hal biasanya membuat produk warisan kripto sulit dipakai keluarga Indonesia, dan Pusaka menghapus keduanya:

1. **"Tiap anggota keluarga harus punya dompet kripto?"** Ibu, ayah, atau istri pewaris umumnya tidak punya.
2. **"Kenapa pewaris harus menekan 'Saya masih hidup' berkala?"** Dengan tombol tiap 8 menit (setelan demo), setahun ada
   ±65.700 transaksi × ±Rp2,40 ≈ **Rp158 ribu per tahun**, belum termasuk repotnya.

Kalimat inti untuk juri: **"Ahli waris tidak perlu dompet. Pewaris tidak perlu menekan tombol."**

| Fitur | Isi |
|---|---|
| **Dompet sendiri jadi pusaka** (EIP-7702) | Model utama: aturan warisan dipasang langsung di dompet pewaris, jadi harta tidak perlu dipindah. Model brankas (`PusakaVault`) tetap ada sebagai cadangan. |
| **Urutan harta sesuai KHI** | Harta bersama (Pasal 96) → wasiat paling banyak 1/3 (Pasal 195) → faraid. |
| **Ahli waris tanpa dompet** | Untuk tiap penerima, pewaris memilih cara terima: **rekening bank/e-wallet** (ahli waris tidak melakukan apa pun: rekening virtual di mitra pencairan, lalu transfer BI-FAST), **amplop digital** (tautan WhatsApp, dibuka setelah pembagian, dicairkan ke bank/e-wallet dari HP tanpa membeli MON), atau **dompet kripto**. Kontrak `MitraCair` + `RekeningVirtual` (klon EIP-1167 lewat CREATE2). Di blockchain hanya nama bank, 4 digit terakhir, dan sidik bergaram. |
| **Bukti hidup tanpa tombol** | Setiap transaksi lewat dompet Pusaka (`execute`) otomatis menjadi bukti hidup. Jika dompet lama diam, pengingat datang ±1 bulan sebelum batas; pewaris cukup menandatangani "Saya masih hidup" (EIP-712) dan relayer mengirim `checkIn`. **Biaya untuk pewaris Rp0.** `heartbeat()` tinggal cadangan. Batas bawaan **12 bulan**. |
| **Kabar hidup dengan sidik jari** | Pewaris bisa mendaftarkan passkey (sidik jari atau wajah di HP/laptop) sekali dengan `aturPasskey`. Setelah itu menahan "Saya masih hidup" meminta sentuhan sidik jari; passkey menandatangani pesan EIP-712 yang sama dan relayer mengirim `checkInPasskey`. Diverifikasi precompile P-256 Monad (±77 rb gas, ±Rp8 dibayar relayer). Kunci passkey tidak pernah keluar dari perangkat. |
| **Saksi tanpa biaya** | Konfirmasi wafat ditandatangani (EIP-712, terikat putaran); relayer mengirim `attestDeathFor`. |
| **Pembatalan dari HP** | Jika saksi keliru, satu transaksi apa pun atau satu sentuhan "Saya masih hidup" di HP pewaris membatalkan pemicu. |
| **Satu transaksi pemasangan** | Otorisasi EIP-7702 + `execute([daftarkan rekening ahli waris di mitra, setup aturan])`. |
| **Kalkulator faraid** | Seisi ruangan bisa mencoba susunan keluarga sendiri dan melihat pembagiannya. |
| **Layar** | 9 layar: Beranda, Pewaris, HP pewaris, Saksi, Panggung, Ahli waris, Mitra pencairan (simulasi bank), Simulasi HP (peran campuran), dan Kalkulator. |
| **Angka demo** | Rp300 jt, seluruhnya harta bersama, wakaf masjid 1/5 → istri Rp165 jt (150 + 15), masjid Rp30 jt, sisanya Rp120 jt dibagi persis seperti K01. |

**Biaya bukti hidup** (Monad: base fee 100 gwei, gas dihitung dari batas gas; MON ≈ Rp392 pada 23 Oktober 2026):
pewaris yang aktif bertransaksi: **Rp0 tambahan**. Pewaris yang dompetnya diam: satu `checkIn` setahun (batas gas
80.000 × 102 gwei ≈ 0,008 MON ≈ **Rp3**), dibayar relayer.

**Jujur soal demo.** Di testnet, transfer bank **disimulasikan**: operator mitra di laptop presenter mencatat transfer,
membakar tIDR sebagai tanda sudah ditukar, dan membuat nomor referensi. Mekanismenya meniru alur *redeem* stablecoin
rupiah yang sudah ada (contoh: IDRX membakar token lalu mentransfer lewat BI-FAST, biaya Rp5.000, maksimal 24 jam). Di
produk, mitranya penukar berizin yang memverifikasi nama rekening (dan KYC sesuai aturan) sebelum transfer.

> **Baru di web3?** Baca [Bagian 6](#6-konsep-web3-untuk-proyek-ini) dulu. Istilah asing dijelaskan di
> [Glosarium](#18-glosarium).

---

## Daftar isi

[Fitur utama](#fitur-utama) ada di atas, sebelum bagian 1.

1. [Ringkasan](#1-ringkasan)
2. [Masalah](#2-masalah)
3. [Lanskap solusi & keaslian ide](#3-lanskap-solusi--keaslian-ide)
4. [Tujuan, bukan tujuan, dan ukuran keberhasilan](#4-tujuan-bukan-tujuan-dan-ukuran-keberhasilan)
5. [Pengguna & peran](#5-pengguna--peran)
6. [Konsep web3 untuk proyek ini](#6-konsep-web3-untuk-proyek-ini)
7. [Solusi & alur](#7-solusi--alur)
8. [Kebutuhan fungsional](#8-kebutuhan-fungsional)
9. [Kebutuhan non-fungsional](#9-kebutuhan-non-fungsional)
10. [Desain teknis](#10-desain-teknis)
11. [Desain layar](#11-desain-layar)
12. [Rencana hari-H (solo)](#12-rencana-hari-h-solo)
13. [Demo & pitch](#13-demo--pitch)
14. [Aturan Blitz & checklist pengumpulan](#14-aturan-blitz--checklist-pengumpulan)
15. [Risiko & mitigasi](#15-risiko--mitigasi)
16. [Roadmap setelah hackathon & model bisnis](#16-roadmap-setelah-hackathon)
17. [Keputusan yang masih terbuka](#17-keputusan-yang-masih-terbuka)
18. [Glosarium](#18-glosarium)
19. [Sumber](#19-sumber)

---

## 1. Ringkasan

**Pusaka** adalah aturan warisan yang dipasang di dompet kripto pewaris sendiri (EIP-7702) di blockchain Monad.

1. Pemilik aset (**pewaris**) memasang aturan warisan di dompetnya, mendaftarkan ahli waris dan 3 saksi, dan memilih
   cara terima tiap ahli waris: **rekening bank**, **amplop digital** (tautan WhatsApp), atau dompet kripto.
2. Selama masih hidup, pewaris memakai dompetnya seperti biasa. **Setiap transaksi otomatis menjadi bukti hidup.** Jika
   dompetnya lama diam, ia mendapat pengingat dan cukup menandatangani "Saya masih hidup" (Rp0).
3. Jika 2 dari 3 saksi mengonfirmasi wafat (cukup tanda tangan), atau tidak ada bukti hidup selama batas waktu, aturan
   masuk **masa sanggah**. Pewaris yang ternyata masih hidup membatalkannya dengan satu transaksi atau satu sentuhan.
4. Setelah masa sanggah lewat, kontrak **menghitung bagian tiap ahli waris sesuai faraid (KHI)** dan langsung
   mengirimkannya: rupiah masuk ke rekening bank lewat mitra pencairan, atau ke amplop yang bisa dicairkan dari HP.

Ahli waris tidak perlu tahu private key atau seed phrase pewaris, dan tidak perlu punya dompet kripto.

**Pernyataan posisi.** Untuk Muslim Indonesia pemilik aset kripto *self-custody* yang khawatir hartanya hilang saat
wafat, Pusaka adalah brankas warisan on-chain yang membagi aset otomatis sesuai faraid setelah wafat dikonfirmasi saksi.
Berbeda dengan *dead man's switch* biasa, Pusaka menghitung bagian waris Islam di dalam kontrak, mewajibkan saksi dan
masa sanggah, dan **menolak kasus yang belum didukung** alih-alih salah menghitung diam-diam.

**Cakupan hackathon (solo):**
- Aturan warisan di dompet pewaris (EIP-7702) + mesin faraid untuk ahli waris inti (suami/istri, anak laki-laki, anak
  perempuan, ayah, ibu), termasuk aturan *'aul*, *radd*, dan *gharrawain*, dengan urutan KHI: harta bersama → wasiat →
  faraid. Model brankas tersedia sebagai cadangan.
- Konfirmasi wafat oleh saksi (2 dari 3), timer tidak aktif, bukti hidup tanpa tombol, dan masa sanggah.
- Mitra pencairan (simulasi bank), amplop digital, dan kabar hidup dengan sidik jari (passkey).
- Token rupiah mainan **tIDR** di Monad testnet.
- 9 layar web, termasuk Pewaris, Saksi, Ahli Waris (HP), Panggung (layar besar untuk demo), dan Kalkulator.
- Demo langsung: penonton memindai QR, menjadi "ahli waris", dan melihat bagiannya di HP dalam ±1 detik.

---

## 2. Masalah

### 2.1 Harta tercatat, tapi tidak bisa diambil siapa pun

Aset kripto di dompet pribadi (*self-custody*) hanya bisa dipindahkan dengan private key pemiliknya. Jika pemilik wafat
tanpa meninggalkan kunci, asetnya tetap tercatat di blockchain selamanya, tetapi tidak ada orang yang bisa memakainya.
Tidak ada bank, notaris, atau pengadilan yang bisa "mereset password".

Tulisan di **Dandapala**, majalah Badan Peradilan Umum MA (3 Agustus 2026), menyebut kondisi ini kekosongan hukum:
sampai sekarang *"belum terdapat pengaturan yang secara khusus membahas keadaan tersebut"*. Penulisnya juga
mengingatkan bahwa hakim bisa saja mengakui hak waris atas aset itu, tetapi tidak bisa memaksakan eksekusinya.

### 2.2 Seberapa besar

- **22,69 juta** investor kripto terdaftar di Indonesia per Juni 2026 (Bisnis.com, 10 Agustus 2026).
- Mayoritas pemiliknya Muslim. Pembagian warisan mereka di Pengadilan Agama merujuk **Kompilasi Hukum Islam (KHI)**.
- Aset di exchange lokal masih bisa diklaim ahli waris lewat prosedur exchange (akta kematian + surat keterangan ahli
  waris). Aset di dompet pribadi dan protokol DeFi **tidak punya jalur apa pun**.

### 2.3 Kenapa belum terpecahkan

| Hambatan | Penjelasan |
|---|---|
| Kunci hanya di pemilik | Membagikan seed phrase semasa hidup berisiko dicuri; tidak membagikannya berarti hilang saat wafat. |
| Blockchain tidak tahu seseorang wafat | Disebut *oracle problem*: fakta dunia nyata harus dibawa masuk oleh pihak yang dipercaya. |
| Faraid rumit | Bagian berubah tergantung siapa saja yang ada (*hajb*); total bisa lebih dari 1 (*'aul*) atau kurang dari 1 (*radd*). Salah hitung memicu sengketa keluarga. |
| Ahli waris awam teknologi | Ibu atau orang tua pewaris biasanya tidak punya dompet kripto. |
| Regulasi kosong | Belum ada aturan khusus pewarisan aset kripto (Dandapala, 2026). |

### 2.4 Ilustrasi

Pak Budi (45), karyawan di Sleman, menyimpan Rp120 juta dalam kripto di dompet pribadinya. Ia wafat mendadak. Istrinya
tahu "ada kripto", tetapi tidak tahu di mana seed phrase-nya. Hartanya terkunci selamanya.

**Dengan Pusaka:** semasa hidup Pak Budi sudah memasang aturan warisan di dompetnya, mendaftarkan istri, 2 anak laki-laki, 1 anak
perempuan, ayah, dan ibu, serta 3 saksi (adik, sahabat, ustaz). Setelah 2 saksi mengonfirmasi dan masa sanggah lewat,
setiap ahli waris menerima bagiannya: istri Rp15 jt, ayah Rp20 jt, ibu Rp20 jt, tiap anak laki-laki Rp26 jt, dan anak
perempuan Rp13 jt (kasus K01 di `faraid-spec.md`).

---

## 3. Lanskap solusi & keaslian ide

| Solusi yang ada | Yang dilakukan | Celahnya |
|---|---|---|
| Prosedur klaim ahli waris di exchange | Exchange mencairkan saldo ke ahli waris dengan dokumen | Hanya aset di exchange itu; tidak berlaku untuk dompet pribadi atau DeFi |
| Surat wasiat / notaris | Mencatat kehendak dan lokasi aset | Tidak bisa memindahkan aset; seed phrase yang ditulis di kertas rawan dicuri |
| *Dead man's switch* generik: WillVault (Monad Blitz Toronto), DeadMan (Monad testnet), Trustchain, InheritChain | Mengirim aset ke penerima jika pemilik tidak aktif | Pembagian manual atau persentase bebas; tidak ada faraid; umumnya tanpa saksi |
| Pemulihan sosial (Safe, Argent) | Penjaga bisa memulihkan akses dompet | Untuk kunci yang hilang, bukan untuk pembagian warisan |
| Warisan dompet (Nunchuk, Uphold Vault) | Kunci warisan + timelock; ahli waris menerima kripto | Timer diperpanjang manual; ahli waris tetap perlu dompet dan frasa pemulihan |
| *Safe Dead Man's Switch* (Blockful, 2026) | Setiap transaksi pemilik Safe mengulang timer | Khusus Safe, tanpa faraid, ahli waris mengambil alih dompet |
| Tautan klaim (Peanut) | Token dikirim lewat tautan berkata sandi; relayer membayar gas | Bukan warisan; dipakai Pusaka sebagai pola amplop digital |
| Kajian akademik faraid + blockchain | Konsep di jurnal dan skripsi | Belum ada produk yang bisa dipakai |

**Cek keaslian (20 Oktober 2026).** Dari ±1.765 entri di Blitz Portal (semua edisi Monad Blitz di seluruh dunia),
**tidak ada satu pun** yang menyebut faraid. Satu-satunya proyek bertema syariah adalah Sahih (pembiayaan sukuk UMKM,
Blitz Jakarta). Pencarian umum juga tidak menemukan produk warisan kripto berbasis faraid.

**Pembeda Pusaka:**
1. Mesin faraid **on-chain** sesuai KHI, termasuk *'aul*, *radd*, *gharrawain*, dan pengurangan bagian ibu oleh saudara.
2. Konfirmasi wafat oleh **saksi** (2 dari 3) + **masa sanggah**. Ini sejalan dengan tradisi dua saksi untuk wasiat
   (KHI Pasal 195).
3. **Menolak dengan jelas** kasus yang belum didukung (mis. saudara ikut mewarisi), bukan membagi dengan salah.
4. **Ahli waris tidak perlu dompet kripto.** Bagian mereka masuk ke rekening bank (lewat mitra pencairan) atau ke amplop
   digital yang dicairkan dari HP. Belum ditemukan produk warisan kripto lain yang membayar ahli waris dalam rupiah ke
   rekening bank.
5. **Bukti hidup tanpa tombol.** Aktivitas dompet dan kabar hidup bertanda tangan (Rp0) menggantikan "check-in" berkala.
   Produk lain umumnya meminta pemilik memperpanjang timer secara manual (mis. Nunchuk, Liana, DeadMan); satu-satunya
   yang otomatis, *Safe Dead Man's Switch* (Blockful, Maret 2026), khusus dompet Safe dan tanpa faraid.

---

## 4. Tujuan, bukan tujuan, dan ukuran keberhasilan

### 4.1 Tujuan hackathon

- **G1.** Demo langsung di Monad testnet: brankas → konfirmasi saksi → masa sanggah → pembagian faraid ke HP penonton.
- **G2.** Mesin faraid lulus semua 24 kasus uji di `faraid-spec.md`.
- **G3.** Pitch 3 menit yang menjelaskan masalah, solusi, dan alasan memakai Monad.
- **G4.** Lulus syarat Blitz: repo GitHub publik, kontrak ter-deploy di Monad testnet, submit sebelum 16.45 WIB.

### 4.2 Tujuan produk jangka panjang

- Menjadi "tombol warisan" untuk dompet dan exchange di Indonesia.
- Divalidasi ahli faraid dan praktisi hukum (Pengadilan Agama, notaris).
- Mendukung lebih banyak jenis ahli waris dan aset, lalu berjalan di mainnet dengan stablecoin rupiah setelah aturannya
  terbit.

### 4.3 Bukan tujuan (MVP)

- Bukan nasihat hukum atau fatwa, dan tidak menggantikan penetapan ahli waris oleh Pengadilan Agama.
- Tidak mendukung saudara, kakek/nenek, cucu (ahli waris pengganti), atau kerabat lain sebagai penerima.
- Tidak menyimpan data pribadi (nama, NIK, akta) di blockchain.
- Tidak memakai uang asli; hanya testnet.
- Tidak menangani utang, biaya jenazah, atau perdamaian ahli waris (*islah*, masuk P2). Harta bersama dan wasiat sudah ditangani.

### 4.4 Ukuran keberhasilan (hari-H)

| Ukuran | Target |
|---|---|
| Kasus uji faraid lulus | 24/24 |
| Kontrak di Monad testnet | Ter-deploy dan alamatnya tercantum di README |
| Waktu dari "Bagikan" sampai saldo muncul di HP | ≤ 2 detik |
| Penonton yang ikut demo | ≥ 3 HP |
| Submit | Sebelum 16.45 WIB |
| Durasi pitch | ≤ 3 menit |

---

## 5. Pengguna & peran

| Peran | Siapa | Kebutuhan | Yang dilakukan di Pusaka |
|---|---|---|---|
| **Pewaris** | Pemilik aset kripto, Muslim, 25–60 tahun | Hartanya sampai ke keluarga dengan pembagian yang benar, tanpa membagikan seed phrase semasa hidup | Memasang aturan, memilih cara terima tiap ahli waris, memakai dompet seperti biasa (bukti hidup otomatis), menandatangani pengingat bila dompet lama diam, membatalkan pemicu yang keliru |
| **Ahli waris** | Istri/suami, anak, ayah, ibu | Menerima bagian tanpa harus paham kripto, dan tahu alasan besar bagiannya | Rekening bank: tidak melakukan apa pun. Amplop: membuka tautan, memilih bank/e-wallet, mencairkan. Melihat bagian dan alasannya |
| **Saksi** | Keluarga dekat, sahabat, ustaz, notaris | Cara sederhana untuk mengonfirmasi wafat | Menandatangani "Konfirmasi wafat" (tanpa biaya) dengan hash akta kematian |
| **Mitra pencairan** | Penukar stablecoin rupiah berizin (di demo: simulasi) | Menukar token ke rupiah dengan aman | Menyapu rekening virtual, mentransfer lewat BI-FAST, mencatat bukti |
| **Relayer Pusaka** | Layanan Pusaka | Pewaris dan saksi tidak perlu gas | Mengirim tanda tangan kabar hidup dan konfirmasi saksi, mensponsori gas amplop |
| **Siapa pun** | Ahli waris, saksi, atau orang lain | Proses tidak macet jika satu pihak diam | Memicu karena tidak aktif; menjalankan pembagian setelah masa sanggah |
| **Juri & penonton** (demo) | Juri Monad Foundation dan Dev Web3 Jogja, peserta | Paham dalam 3 menit dan bisa ikut mencoba | Memindai QR dan melihat bagian masuk di HP |

---

## 6. Konsep web3 untuk proyek ini

Bagian ini untuk pemula. Setiap konsep dikaitkan langsung dengan Pusaka.

### 6.1 Blockchain = buku kas bersama
Bayangkan buku kas yang salinannya dipegang ribuan komputer. Setiap perubahan dicatat berurutan di dalam **blok**. Karena
semua pihak memegang salinan, catatan lama praktis tidak bisa diubah. **Monad** adalah blockchain yang sangat cepat: satu
blok baru tiap ±0,3 detik.

### 6.2 Alamat, private key, seed phrase
- **Alamat** (mis. `0x12ab…9f3c`) = nomor rekening. Aman dibagikan.
- **Private key** = tanda tangan sekaligus PIN. Siapa pun yang memegangnya menguasai isi alamat itu.
- **Seed phrase** (12 atau 24 kata) = kunci induk untuk membuat ulang private key.
- **Dompet (wallet)** = aplikasi yang menyimpan kunci dan menandatangani transaksi, mis. MetaMask.
- Tidak ada "lupa password". Kunci hilang berarti aset hilang. **Inilah akar masalah yang dipecahkan Pusaka.**

### 6.3 Transaksi & gas
Setiap perubahan di blockchain adalah **transaksi** yang ditandatangani. Pengirimnya membayar biaya **gas** dalam koin
**MON**. Di Monad biayanya sangat murah (±Rp0,8 untuk transfer biasa). Di testnet, MON gratis dari **faucet**.

### 6.4 Smart contract
Program yang tinggal di blockchain. Ia bisa memegang uang dan menjalankan aturan secara otomatis, dan tidak bisa diubah
diam-diam setelah dipasang. Analogi: "notaris robot" yang pasti menjalankan isi akta. **PusakaVault** adalah brankas
berprogram yang aturan faraidnya tertulis di dalam kode.

### 6.5 Token
Aset digital yang mengikuti standar **ERC-20**. Untuk demo kita membuat **tIDR** (rupiah mainan di testnet), bukan uang
asli.

### 6.6 Testnet vs mainnet
**Testnet** adalah jaringan latihan dengan uang mainan. **Mainnet** memakai uang asli. Blitz mewajibkan deploy di
**Monad testnet**.

### 6.7 Finalitas & explorer
**Finalitas** adalah saat transaksi pasti tidak bisa dibatalkan; di Monad ±0,6 detik. **Explorer** (MonadVision)
adalah situs untuk melihat semua transaksi publik, mirip mutasi rekening yang bisa dilihat siapa saja.

### 6.8 Oracle problem
Blockchain tidak tahu kejadian di dunia nyata, misalnya seseorang wafat. Pusaka memasukkan fakta ini lewat 2 dari 3
saksi atau timer tidak aktif, lalu memberi masa sanggah agar kesalahan bisa dibatalkan.

### 6.9 Yang on-chain dan yang off-chain

| Di blockchain (publik) | Di luar blockchain (privat) |
|---|---|
| Alamat ahli waris dan perannya (istri, anak, …) | Nama, NIK, nomor HP |
| Saldo brankas, status, dan waktu | File akta kematian (hanya *hash*-nya yang dicatat) |
| Hash dokumen bukti | Foto dan dokumen keluarga |

*Hash* adalah sidik jari digital sebuah file. Dari hash, orang tidak bisa membaca isi file, tetapi bisa mengecek bahwa
file yang ditunjukkan nanti sama persis dengan yang dicatat.

### 6.10 Alat yang dipakai

| Alat | Fungsi | Analogi |
|---|---|---|
| Solidity | Bahasa untuk menulis smart contract | "Bahasa akta" |
| Foundry | Mengompilasi, menguji, dan memasang kontrak | Bengkel + alat uji |
| viem | Pustaka JavaScript untuk membaca dan menulis ke blockchain | Kabel penghubung web ↔ blockchain |
| Vite | Membuat aplikasi web | Etalase toko |
| Vercel | Menaruh web di internet agar bisa dibuka dari HP | Hosting |

---

## 7. Solusi & alur

### 7.1 Gambaran besar

```text
 PEWARIS                                         SAKSI (2 dari 3)
 pasang aturan di dompet sendiri (EIP-7702),     tanda tangan konfirmasi wafat
 pilih cara terima tiap ahli waris               (+ hash akta), relayer mengirim
 bukti hidup: transaksi biasa / tanda tangan             │
        │                                                │
        ▼                                                ▼
 ┌──────────────────────────────────────────────────────────────┐
 │      Dompet pewaris + PusakaWallet (Monad testnet)           │
 │   status: AKTIF → DIPICU → masa sanggah → DIBAGIKAN          │
 │   urutan KHI: harta bersama → wasiat → faraid (FaraidLib)    │
 └──────────────────────────────────────────────────────────────┘
        │  finalize(): kirim bagian masing-masing
        ├─▶ rekening virtual ─▶ MitraCair ─▶ BI-FAST ─▶ rekening bank ahli waris
        ├─▶ amplop digital ─▶ ahli waris memilih bank/e-wallet ─▶ MitraCair ─▶ rekening
        └─▶ dompet kripto ahli waris
```

### 7.2 Siklus hidup brankas

```text
             bukti hidup → timer diulang
             (execute / checkIn / heartbeat)
               ┌───────┐
               ▼       │
           ┌─────────┐─┘
 dibuat ─▶ │  AKTIF  │
           └─────────┘
               │  2 dari 3 saksi (attestDeath/attestDeathFor)   ATAU   triggerByInactivity()
               ▼
           ┌─────────┐    bukti hidup apa pun sebelum masa sanggah habis
           │ DIPICU  │ ─────────────────────────────────────▶ kembali AKTIF
           └─────────┘
               │  masa sanggah habis → finalize()
               ▼
           ┌───────────┐
           │ DIBAGIKAN │  final, tidak bisa diulang
           └───────────┘
```

| Dari | Ke | Pemicu | Siapa |
|---|---|---|---|
| — | AKTIF | `setup()` lewat EIP-7702 (dompet) atau `createVault()` (brankas) | Pewaris |
| AKTIF | AKTIF | Bukti hidup: `execute()` (aktivitas), `checkIn()` (kabar hidup bertanda tangan), `heartbeat()`; brankas: `deposit()`, `withdraw()` | Pewaris (kabar hidup dikirim relayer) |
| AKTIF | DIPICU | Konfirmasi saksi mencapai ambang (default 2) | Saksi (tanda tangan dikirim relayer) |
| AKTIF | DIPICU | `triggerByInactivity()` setelah batas tanpa bukti hidup | Siapa pun |
| DIPICU | AKTIF | Bukti hidup apa pun sebelum masa sanggah habis | Pewaris |
| DIPICU | DIBAGIKAN | `finalize()` setelah masa sanggah habis | Siapa pun |

### 7.3 Alur per peran

**Pewaris**
1. Buka halaman Pewaris, lalu isi: jenis kelamin pewaris, susunan keluarga, harta bersama, wasiat, 3 saksi, ambang
   saksi (2), batas tanpa bukti hidup (bawaan 12 bulan), dan masa sanggah.
2. Untuk tiap penerima, pilih cara terima: rekening bank/e-wallet (bank + nomor), amplop WhatsApp (nomor WA), atau
   dompet kripto (alamat).
3. Lihat pratinjau pembagian faraid, lalu tanda tangani satu transaksi: aturan terpasang dan rekening bank ahli waris
   terdaftar di mitra pencairan.
4. Pakai dompet seperti biasa. Setiap transaksi lewat dompet Pusaka adalah bukti hidup.
5. Jika dompet lama diam, pengingat datang ±1 bulan sebelum batas. Sentuh "Saya masih hidup" (tanda tangan, Rp0).
6. Jika terpicu padahal masih hidup, satu transaksi apa pun atau satu sentuhan "Saya masih hidup" membatalkannya.

**Saksi**
1. Buka halaman Saksi untuk pewaris tertentu.
2. Pilih file akta kematian (file tidak dikirim; hanya hash-nya yang dihitung di browser), lalu tahan tombol untuk
   menandatangani konfirmasi wafat. Relayer mengirimnya; saksi tidak butuh gas.
3. Lihat berapa saksi yang sudah mengonfirmasi.

**Ahli waris**
1. Pindai QR atau buka tautan untuk melihat peran, bagian (pecahan + rupiah), cara terima, dan alasannya.
2. Rekening bank: setelah dibagikan, rupiah masuk ke rekening tanpa ahli waris melakukan apa pun.
3. Amplop: setelah dibagikan, pilih bank atau e-wallet, ketik nomornya, tahan tombol "Cairkan". Tanpa aplikasi, tanpa
   dompet, tanpa membeli MON.

**Siapa pun**
- Menekan "Picu karena tidak aktif" jika batas waktu terlewati.
- Menekan "Bagikan warisan" setelah masa sanggah habis.

### 7.4 Aturan faraid (ringkas)

Detail lengkap, algoritma, dan kasus uji ada di [`faraid-spec.md`](faraid-spec.md).

| Ahli waris | Bagian |
|---|---|
| Suami | 1/2; 1/4 jika ada anak |
| Istri (dibagi rata jika lebih dari satu) | 1/4; 1/8 jika ada anak |
| Ibu | 1/3; 1/6 jika ada anak atau ≥ 2 saudara; 1/3 dari sisa jika bersama ayah + suami/istri tanpa anak (*gharrawain*) |
| Ayah | 1/6 jika ada anak laki-laki; 1/6 + sisa jika hanya ada anak perempuan; sisa jika tidak ada anak |
| Anak perempuan (tanpa anak laki-laki) | 1/2 jika seorang; 2/3 jika dua atau lebih |
| Anak laki-laki (+ anak perempuan) | Sisa, laki-laki 2 : perempuan 1 |
| Total > 1 | *'Aul*: semua bagian dikurangi proporsional |
| Total < 1, tanpa penerima sisa | *Radd*: sisa dikembalikan proporsional (default tanpa suami/istri) |

### 7.5 Parameter waktu

| Parameter | Demo | Nyata (saran) |
|---|---|---|
| Batas tanpa bukti hidup | 12 bulan (pilihan "10 menit (demo)" hanya untuk menunjukkan jalur tidak aktif) | 12 bulan, pengingat ±1 bulan sebelumnya |
| Masa sanggah | 20–30 detik | 30 hari |
| Ambang saksi | 2 dari 3 | 2 dari 3 |

---

## 8. Kebutuhan fungsional

Prioritas: **P0** = wajib ada di hari-H · **P1** = kalau waktu cukup · **P2** = setelah hackathon.

### 8.1 Kontrak

| ID | Kebutuhan | Prio | Kriteria terima |
|---|---|---|---|
| FR-01 | Buat brankas lewat factory | P0 | `createVault()` memancarkan `VaultCreated`. Data keluarga yang tidak valid atau belum didukung langsung ditolak dengan error yang jelas. |
| FR-02 | Setor tIDR | P0 | Saldo brankas bertambah; hanya saat AKTIF. |
| FR-03 | Tarik tIDR | P0 | Hanya pewaris; hanya saat AKTIF. |
| FR-04 | Bukti hidup | P0 | `execute()` (aktivitas), `checkIn()` (kabar hidup bertanda tangan), dan `heartbeat()` mengulang timer. Jika DIPICU dan masa sanggah belum habis → kembali AKTIF dan konfirmasi saksi direset. Setelah masa sanggah habis → aktivitas tidak mengubah apa pun, `checkIn`/`heartbeat` ditolak. `lastProofVia` mencatat sumbernya. |
| FR-05 | Konfirmasi wafat oleh saksi | P0 | Hanya saksi terdaftar, sekali per saksi per putaran. Langsung (`attestDeath`) atau tanda tangan EIP-712 yang dikirim siapa pun (`attestDeathFor`, terikat putaran). Hash bukti tercatat di event. Saat jumlah konfirmasi = ambang → DIPICU (alasan: saksi). |
| FR-06 | Pemicu karena tidak aktif | P0 | Siapa pun, hanya jika `sekarang ≥ heartbeat terakhir + batas`. Sebelum itu ditolak dengan info waktu siap. |
| FR-07 | Pembagian (finalize) | P0 | Siapa pun, hanya jika DIPICU dan masa sanggah habis. Mengirim bagian sesuai faraid; total terkirim = saldo; status menjadi DIBAGIKAN; tidak bisa diulang. |
| FR-08 | Mesin faraid | P0 | 18 kasus K01–K16 menghasilkan pecahan yang sama persis dengan `faraid-spec.md`; 6 kasus X1–X6 ditolak dengan kode error yang benar. |
| FR-09 | Pratinjau bagian | P0 | `previewShares()` bisa dipanggil kapan saja dan mengembalikan pecahan + jumlah berdasarkan saldo saat itu. |
| FR-10 | Ringkasan brankas | P0 | `getSummary()` mengembalikan semua data yang dibutuhkan layar dalam satu panggilan. |
| FR-11 | Token tIDR + faucet | P0 | Siapa pun bisa mencetak tIDR testnet, dengan batas per panggilan. |
| FR-12 | Mode radd ke pasangan | P0 (kontrak) · P1 (UI) | Konfigurasi `raddToSpouse`; default `false` (jumhur). |
| FR-13 | Harta bersama (KHI Pasal 96) | P0 | Porsi yang ditandai sebagai harta bersama: separuhnya diberikan dulu ke pasangan yang masih hidup, sisanya dibagi faraid. |
| FR-14 | Wasiat ≤ 1/3 untuk non-ahli waris (mis. wakaf) | P0 | Dijalankan sebelum faraid; ditolak jika lebih dari 1/3. |
| FR-15 | Perdamaian ahli waris (*islah*) | P2 | Semua ahli waris menyetujui pembagian lain sebelum `finalize()`. |
| FR-16 | Kabar hidup bertanda tangan | P0 | `checkIn(waktu, ttd)`: tanda tangan pewaris EIP-712 `KabarHidup`, dikirim siapa pun. Ditolak jika `waktu` tidak lebih baru dari bukti terakhir, > 10 menit di depan jam blok, atau lebih lama dari pemicu. |
| FR-17 | Rekening virtual ahli waris | P0 | `MitraCair.daftarBanyak` di transaksi pemasangan; alamat rekening virtual (CREATE2) dipakai sebagai alamat ahli waris; hanya nama bank, 4 digit terakhir, dan sidik yang tercatat. |
| FR-18 | Pencairan ke bank | P0 | Operator menyapu rekening virtual (`sapuBanyak`), lalu `selesaikan` dengan bukti transfer; token dibakar; status per penerima terbaca lewat `statusBanyak`. |
| FR-19 | Amplop digital | P0 | Pemegang kunci amplop mencairkan lewat `cairkan` (izin EIP-2612 + daftar rekening + tarik) dalam satu transaksi; gas disponsori. |

### 8.2 Aplikasi web

| ID | Kebutuhan | Prio | Kriteria terima |
|---|---|---|---|
| FR-20 | Dompet demo | P0 | Membuat dan menyimpan kunci pewaris + 3 saksi di browser. Tombol "Bagikan gas" mengirim MON dari dompet induk. Ada peringatan "khusus testnet". |
| FR-21 | Halaman Pewaris | P0 | Form aturan + pratinjau faraid + cara terima per penerima; panel bukti hidup (sumber terakhir, sisa batas, contoh transaksi, kabar hidup Rp0); pembatalan dengan tahan tombol saat masa sanggah; status pencairan per penerima. |
| FR-22 | Halaman Saksi | P0 | 3 kartu saksi; tahan tombol untuk menandatangani (tanpa gas); progres x/ambang. |
| FR-23 | Halaman Ahli Waris (HP) | P0 | Peran, pecahan, rupiah, alasan, dan cara terima. Rekening bank: urutan "dibagikan → diterima mitra → BI-FAST → masuk rekening" dengan nomor referensi. Amplop: formulir pencairan ke bank/e-wallet. Diperbarui tiap ≤ 2 detik. |
| FR-24 | Layar Panggung | P0 | QR menuju pemilih peran (membawa benih amplop di `#`); status besar + hitung mundur; kain dengan label per penerima, cara terima, dan status pencairan; narasi bukti hidup; linimasa transaksi. |
| FR-25 | Tautan explorer di setiap transaksi | P1 | Membuka transaksi di MonadVision. |
| FR-26 | Hash akta di browser | P1 | File dipilih, hash dihitung di browser, lalu dikirim sebagai `evidenceHash`. Untuk P0 boleh memakai hash tetap. |
| FR-27 | Halaman kalkulator faraid | P0 | Isi komposisi keluarga dan lihat pembagiannya. Web menghitung dengan salinan JS aturan faraid; di blockchain tersedia `previewFaraid()` di factory. |
| FR-28 | Ahli waris dan saksi tanpa dompet kripto | P0 | Rekening bank, amplop, dan tanda tangan saksi yang dikirim relayer. Kabar hidup pewaris dengan sidik jari (passkey, precompile P-256) sudah ada. Passkey untuk saksi: P2. |
| FR-29 | Layar Mitra pencairan | P1 | Rekening virtual terdaftar, antrean dan riwayat pencairan dengan nomor referensi, operator, penjelasan simulasi. |
| FR-30 | HP pewaris | P1 | Pesan bukti hidup, pengingat ±1 bulan sebelum batas, peringatan saat saksi mengonfirmasi, pembatalan dengan tahan tombol. |

---

## 9. Kebutuhan non-fungsional

| Aspek | Kebutuhan |
|---|---|
| Keamanan kontrak | Tanpa admin dan tanpa upgrade. Urutan *checks-effects-interactions*: status diubah sebelum mengirim token. Pakai SafeERC20. Batas ukuran: ≤ 20 ahli waris, ≤ 5 saksi. Validasi semua input. Custom error. Event untuk setiap perubahan penting. |
| Kebenaran faraid | Aritmetika pecahan eksak, bukan desimal. Total bagian selalu tepat 1. Kasus di luar cakupan ditolak. |
| Keandalan demo | Minimal 2 RPC (fallback). Data layar diambil dengan 1–2 panggilan per siklus. Kunci demo sudah berisi MON sebelum tampil. Ada video cadangan. |
| Kinerja | Status terlihat di layar panggung ≤ 1 detik setelah transaksi final; di HP penonton ≤ 2 detik. Transfer bank (simulasi) selesai ≤ 5 detik setelah pembagian. |
| Privasi | Tidak ada data pribadi di blockchain (selaras UU PDP No. 27 Tahun 2022). Hanya alamat, peran, hash, serta nama bank dan 4 digit terakhir rekening. |
| Hukum & etika | Label "Prototipe testnet — bukan nasihat hukum/fatwa". Bahasa yang menghormati suasana duka. Aset dibagikan sebagai warisan, bukan dipakai sebagai alat pembayaran. |
| UX | Bahasa Indonesia sederhana. Halaman ahli waris *mobile-first* dan bisa dipahami tanpa pengetahuan kripto. Setiap angka disertai alasannya. |
| Biaya (mainnet, 23 Okt 2026: 102 gwei, MON ≈ Rp392; Monad menagih batas gas) | Transaksi 60 rb gas ±Rp2,40 · kabar hidup (batas 80 rb, dibayar relayer) ±Rp3 · pemasangan dengan 4 rekening (batas 1,64 jt) ±Rp66 · kabar sidik jari (batas 200 rb, dibayar relayer) ±Rp8 · pembagian (batas 600 rb) ±Rp24 · pencairan amplop (batas 560 rb) ±Rp22. Di testnet gratis. |

---

## 10. Desain teknis

### 10.1 Stack

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Kontrak | Solidity 0.8.x + Foundry + OpenZeppelin | Standar EVM; tes cepat dan ditulis di Solidity; dipakai di dokumentasi Monad |
| Web | Vite multi-halaman + JavaScript biasa + GSAP | Sederhana (tanpa server); cepat di-build; animasi kain batik |
| Koneksi blockchain | viem | Ringan; menyediakan definisi chain Monad testnet |
| QR | `qrcode-generator` | Kecil dan mudah dipakai |
| Hosting | Vercel | Gratis; tautan publik untuk HP penonton |
| Jaringan | Monad testnet | Wajib untuk Blitz |

### 10.2 Jaringan Monad testnet

| Item | Nilai |
|---|---|
| Chain ID | 10143 |
| RPC publik | `https://testnet-rpc.monad.xyz` (±50 request/detik; `eth_call` ±25/detik) |
| Faucet | https://faucet.monad.xyz |
| Explorer | https://testnet.monadvision.com |
| Waktu blok | ±300 ms (sejak upgrade MIP-12, 23 Juli 2026) |
| Finalitas | ±600 ms |
| Dokumentasi | https://docs.monad.xyz (untuk asisten AI: https://docs.monad.xyz/llms.txt) |

Angka-angka ini berasal dari dokumentasi Monad; cek lagi di sana jika ada yang berubah (dan jalankan `node scripts/cek-siap.mjs` di `web/`).

**Jebakan khusus Monad**
1. **Gas dibayar berdasarkan *gas limit*, bukan gas yang terpakai.** Tetapkan gas limit yang wajar (perkiraan × 1,2);
   jangan biarkan dompet menebak terlalu besar.
2. **Akun yang baru diisi MON** perlu menunggu ±1 detik sebelum bisa mengirim transaksi (aturan *reserve balance*).
   Isi semua kunci demo jauh sebelum tampil.
3. **Jangan mengirim transaksi beruntun dari akun yang sama** tanpa menunggu receipt.
4. **`block.timestamp` beresolusi 1 detik**, padahal blok terbentuk tiap 0,3 detik. Untuk timer warisan (detik/menit)
   ini tidak masalah.
5. **`eth_getLogs` dibatasi ±100 blok** di sebagian RPC publik. Ambil data layar dari fungsi *view* (`getSummary()`),
   bukan dari riwayat event.
6. **Testnet pernah direset** (16 Desember 2025). Jangan mengandalkan alamat kontrak lama.
7. **Akun EIP-7702 dan *reserve balance*.** Transaksi yang menurunkan saldo MON akun terdelegasi di bawah 10 MON gagal,
   kecuali penurunannya hanya untuk biaya gas transaksi itu. Pusaka tidak memindahkan MON dari dompet pewaris, jadi
   dompet demo dengan 0,2 MON tetap bisa membayar gasnya sendiri.
8. **Tidak ada `eth_getProof`**, dan kontrak tidak bisa membaca nonce akun lain. Bukti hidup otomatis hanya bisa dari
   transaksi yang lewat kode Pusaka (`execute`) atau dari tanda tangan.

### 10.3 Struktur folder

```text
pusaka-blitz\
├── README.md
├── docs\
│   ├── PRD.md                    ← dokumen ini
│   ├── arsitektur.md             ← cara kerja kontrak
│   ├── faraid-spec.md            ← aturan faraid & kasus uji
│   └── penilaian.md              ← penilaian panitia
├── contracts\                    ← proyek Foundry
│   ├── src\     MockIDR · FaraidLib · EstateLib · PusakaCore · PusakaWallet · PusakaVault
│   │            PusakaFactory · MitraCair (+ RekeningVirtual) · WebAuthnLib
│   ├── test\    FaraidLib · EstateLib · PusakaVault · PusakaWallet · MitraCair · Passkey (+ PusakaFlowBase)
│   ├── script\  Deploy.s.sol · e2e-anvil.sh
│   └── lib\     forge-std · openzeppelin-contracts
└── web\                          ← aplikasi Vite multi-halaman
    ├── *.html   index · pewaris · kabar · saksi · panggung · waris · mitra · hp · kalkulator
    ├── src\     chain · demo · boot · abi · passkey · globals
    ├── assets\  tokens.css · base.css · fonts.css · kain.js · ui.js · data.js
    └── scripts\ deploy-lokal · e2e · cek-siap · abi
```

### 10.4 Kontrak

Rincian lengkap (fungsi, struktur data, error, gas, dan batasan) ada di [`arsitektur.md`](arsitektur.md); sumber
kebenarannya tetap kode di [`contracts/src`](../contracts/src). Ringkasannya:

| Kontrak | Peran |
|---|---|
| `MockIDR` | tIDR, rupiah mainan di testnet (ERC-20 + permit + burn + faucet, maksimal Rp1 miliar per panggilan) |
| `FaraidLib` | Fungsi murni penghitung faraid dengan pecahan eksak (*furud*, *'aul*, *radd*, *gharrawain*); menolak keluarga yang tidak valid (`InvalidFamily`) atau belum didukung (`UnsupportedCase`) |
| `EstateLib` | Urutan KHI: harta bersama (Pasal 96) → wasiat paling banyak 1/3 (Pasal 195) → faraid |
| `PusakaCore` | Inti bersama: aturan, saksi (`attestDeath`, `attestDeathFor`), bukti hidup (`heartbeat`, `checkIn`, `checkInPasskey`, aktivitas), pemicu, `finalize()`, dan fungsi baca untuk layar |
| `PusakaWallet` | **Model utama.** Dipasang di dompet pewaris lewat EIP-7702: `setup`, `execute` (transaksi biasa = bukti hidup), `cancelSetup`, ERC-1271 |
| `PusakaVault` + `PusakaFactory` | **Model cadangan (brankas).** Harta disetor ke brankas klon yang dibuat factory; factory juga menyediakan kalkulator faraid on-chain (`previewFaraid`, `previewEstate`). Dipakai jika EIP-7702 bermasalah |
| `MitraCair` + `RekeningVirtual` | Mitra pencairan: rekening virtual per rekening bank ahli waris (klon EIP-1167 lewat CREATE2), penyapuan, pencairan amplop dengan izin EIP-2612, pencatatan bukti transfer, pembakaran token |
| `WebAuthnLib` | Memeriksa tanda tangan passkey (WebAuthn, P-256) untuk kabar hidup dengan sidik jari |

**Aturan penting**
- Tanpa admin dan tanpa upgrade. Aturan hanya bisa diubah pewaris semasa AKTIF.
- `finalize()` mengubah status ke DIBAGIKAN **sebelum** mengirim token, untuk mencegah serangan *reentrancy*.
- Jumlah per ahli waris dibulatkan ke bawah; sisa pembulatan (beberapa *wei*) diberikan ke ahli waris pertama, jadi total
  terkirim selalu sama dengan saldo.
- Model dompet membagikan sampai 5 token ERC-20; model brankas membagikan 1 token (tIDR).
- Saksi tidak boleh sekaligus penerima.

### 10.5 Mesin faraid

Fungsi menerima komposisi keluarga, menghitung bagian pasti (*furud*), menerapkan *'aul* jika total > 1, memberi sisa
ke anak laki-laki (2 : 1 dengan anak perempuan) atau ke ayah, lalu menerapkan *radd* jika tidak ada penerima sisa. Semua
perhitungan memakai pecahan eksak yang disederhanakan dengan FPB. Kode semu lengkap dan 24 kasus uji ada di
[`faraid-spec.md`](faraid-spec.md).

### 10.6 Aplikasi web

Web ada di [`web/`](../web): Vite **multi-halaman** dengan JavaScript biasa (tanpa React dan tanpa server), viem untuk
membaca dan menulis ke blockchain, GSAP untuk animasi, dan `qrcode-generator` untuk QR. Daftar layar ada di bagian 11;
cara menjalankannya ada di [`web/README.md`](../web/README.md).

| Berkas | Isi |
|---|---|
| `*.html` (9 layar) | `index`, `pewaris`, `kabar`, `saksi`, `panggung`, `waris`, `mitra`, `hp`, `kalkulator` |
| `src/chain.js` | Klien viem, alamat kontrak dari `.env`, kunci demo di browser, dompet induk (relayer), operator mitra, kunci amplop, sidik rekening |
| `src/demo.js` | Status dari kontrak → `window.Demo`; aksi → transaksi; operator mitra (simulasi bank) |
| `src/passkey.js` | Pendaftaran dan tanda tangan passkey (WebAuthn) untuk kabar hidup dengan sidik jari |
| `src/abi.js` | ABI hasil `npm run abi` (dari `contracts/out`) |
| `assets/` | Gaya Nila (`tokens.css`, `base.css`, `fonts.css`), gambar kain (`kain.js`), komponen layar (`ui.js`), salinan JS aturan faraid untuk kalkulator (`data.js`) |
| `scripts/` | `deploy-lokal.mjs` (deploy ke anvil), `e2e.mjs` (uji ujung ke ujung tanpa browser), `cek-siap.mjs` (cek saldo, harga gas, dan alamat sebelum tampil), `abi.mjs` |

**Dompet demo (khusus testnet).** Agar demo cepat tanpa MetaMask:
- Browser laptop membuat kunci acak (*burner wallet*) untuk pewaris + 3 saksi dan menyimpannya di `localStorage`.
- Satu **dompet induk** diisi MON dari faucet. Ia juga menjadi **relayer** (mengirim kabar hidup dan konfirmasi saksi
  yang sudah ditandatangani) dan pemilik `MitraCair`. Tombol "Bagikan gas" mengirim MON ke tiap kunci demo.
- Ahli waris **tidak butuh kunci sendiri**. Kunci amplop diturunkan dari satu benih yang ikut di bagian `#` tautan QR
  (tidak dikirim ke server), jadi penonton yang memindai QR bisa "menjadi" ahli waris mana pun.
- Peringatan wajib di layar: "Kunci demo hanya untuk testnet. Jangan pernah memakai private key dompet asli."
- Kunci dompet induk (`VITE_INDUK_KEY`) ikut terbawa ke browser. Versi yang di-hosting publik harus memakai kunci
  terpisah dengan saldo kecil.

**Membaca data.** Layar memanggil fungsi *view* (`getSummary()`, `preview()`, `statusBanyak()`) secara berkala, bukan
membaca riwayat event (lihat jebakan Monad no. 5).

**Menulis data.** Transaksi dikirim dengan gas limit eksplisit (Monad menagih batas gas), lalu menunggu receipt dan
memperbarui layar. Satu akun hanya mengirim satu transaksi pada satu waktu.

**Konfigurasi (`.env`).** `VITE_CHAIN` (anvil atau `monad`), `VITE_TOKEN`, `VITE_FACTORY`, `VITE_WALLET`, `VITE_MITRA`,
`VITE_INDUK_KEY`, `VITE_PUBLIC_URL` (untuk QR di Panggung), dan `VITE_RPC` (disarankan RPC berkunci). Daftar lengkapnya ada
di `web/README.md`.

### 10.7 Pengujian

| Tes | Isi |
|---|---|
| `forge test` di `contracts/` | Tes untuk `FaraidLib` (K01–K16 harus sama persis, X1–X6 harus ditolak, total selalu = 1), `EstateLib` (harta bersama dan wasiat), `PusakaVault`, `PusakaWallet` (alur EIP-7702), `MitraCair`, dan `Passkey` (WebAuthn/P-256). `PusakaFlowBase.sol` memuat alur bersama |
| `web/scripts/e2e.mjs` | Alur lengkap dengan transaksi sungguhan di anvil tanpa browser: pasang → bukti hidup → saksi → masa sanggah → bagikan → pencairan bank dan amplop. `GAS_LOG=1` menambah ringkasan gas |
| Uji manual web | Pasang aturan → pindai QR dari 2 HP → konfirmasi 2 saksi → batalkan → konfirmasi ulang → bagikan → saldo dan status pencairan muncul di HP |

### 10.8 Deploy

1. Isi MON dompet induk dari faucet.
2. Pastikan `forge test` lulus semua.
3. Deploy dengan `forge script script/Deploy.s.sol --rpc-url <RPC Monad testnet> --broadcast --code-size-limit 131072`.
   `PusakaWallet` ±28 KB, di atas batas Ethereum 24 KB, sedangkan Monad mengizinkan 128 KB. Skrip ini ikut men-deploy
   `PusakaVault` + `PusakaFactory` (model brankas, cadangan); isi `BRANKAS=false` untuk melewatinya. Catat alamatnya.
4. Verifikasi source semua kontrak di explorer (MonadVision).
5. Isi `.env` web dengan alamat kontrak, cek dengan `node scripts/cek-siap.mjs`, lalu `npm run build` dan host web
   secara publik.
6. Uji tautan dari HP memakai data seluler (bukan Wi-Fi yang sama dengan laptop).
7. Tulis alamat kontrak dan URL live di README.

---

## 11. Desain layar

Gaya visualnya bernama **Nila**: harta digambar sebagai sehelai kain batik, dan status warisan digambar sebagai proses
membatik. Semua angka dan status dibaca dari kontrak asli, dan setiap tombol mengirim transaksi sungguhan.

| Layar | Berkas | Perangkat | Isi |
|---|---|---|---|
| Beranda | `index.html` | Laptop | Ringkasan, kain contoh, daftar layar |
| Pewaris | `pewaris.html` | Laptop | Aturan + pratinjau faraid, cara terima per penerima, lembar tanda tangan, panel bukti hidup, pembatalan |
| HP pewaris | `kabar.html` | HP/laptop | Pesan bukti hidup, pengingat, peringatan saksi, "Saya masih hidup" dengan tahan tombol, pendaftaran sidik jari |
| Saksi | `saksi.html` | Laptop | Tiga kartu saksi, cap kawung di kain akta, tanda tangan tanpa gas |
| Panggung | `panggung.html` | Proyektor | Kain besar, label per penerima dengan cara terima dan status pencairan, QR, narasi, linimasa |
| Ahli waris | `waris.html` | HP penonton | Pemilih peran, bagian dan alasannya, rekening bank / amplop / dompet kripto |
| Mitra pencairan | `mitra.html` | Laptop | Simulasi bank: rekening virtual, antrean, riwayat BI-FAST, operator |
| Simulasi HP | `hp.html` | Laptop | Empat HP berdampingan dengan peran yang bisa dipilih |
| Kalkulator | `kalkulator.html` | HP/laptop | Faraid untuk keluarga sendiri |

**Prinsip tampilan**
- Halaman ahli waris *mobile-first*: peran, pecahan, rupiah, dan alasannya terlihat tanpa menggulir jauh.
- Status besar dan hitung mundur di Panggung, supaya terbaca dari belakang ruangan.
- Setiap angka disertai alasannya (mis. "anak perempuan mendapat separuh bagian anak laki-laki, 2 : 1").
- Setelah dibagikan, label tiap penerima di kain berubah menurut cara terimanya, mis. "Masuk BSI ••••2291".

---

## 12. Rencana hari-H (solo)

Jadwal mengikuti penilaian panitia ([`penilaian.md`](penilaian.md)): coding mulai 10.15 WIB, pengumpulan ditutup 16.45
WIB. Kontrak dan web sudah jalan ujung ke ujung di anvil, jadi hari ini fokus ke deploy, verifikasi, hosting, dan bahan
pengumpulan.

| Waktu (WIB) | Kegiatan | Hasil |
|---|---|---|
| 09.00–10.15 | Registrasi, pembukaan, dan penjelasan penilaian dari panitia | Aturan jelas |
| 10.15–11.00 | Mulai coding. Cek saldo MON dompet induk (faucet); `forge test`; `node scripts/e2e.mjs` di anvil sebagai cek terakhir | Kode terbukti jalan |
| 11.00–12.00 | Deploy ke Monad testnet (`forge script script/Deploy.s.sol` dengan `--code-size-limit 131072`), catat alamat, verifikasi source di explorer | Kontrak ter-deploy dan terverifikasi |
| 12.00–13.00 | Hosting web publik (dompet induk terpisah, saldo kecil); `node scripts/cek-siap.mjs`; isi README (URL live + alamat kontrak); push repo publik | **Checkpoint 1 (13.00): repo + deploy + hosting** |
| 13.00–14.00 | Uji ujung ke ujung di testnet dengan HP asli; rekam video demo dan video iklan | **Checkpoint 2 (14.00): demo + video iklan** |
| 14.00–16.00 | Poles: perbaiki bug, posting di X/LinkedIn dengan tag panitia, siapkan layar presenter | Siap tampil |
| 16.00–16.45 | Cek checklist (bagian 14.2), lalu submit | Terkumpul |
| **16.45** | **Pengumpulan ditutup** | |
| Setelah itu | Pitch live 3 menit tanpa slide, sesuai urutan submit | |

**Jika terlambat, potong dalam urutan ini:**
1. Bonus: mainnet dan domain custom.
2. Video iklan dibuat sederhana, tanpa polesan.
3. Layar Panggung terpisah → pakai halaman Pewaris di proyektor.
4. QR untuk HP → buka halaman ahli waris di tab laptop (`hp.html`).
5. Tombol "Picu karena tidak aktif" di UI (fungsinya tetap ada di kontrak).

**Jangan dipotong:** repo publik, README dengan URL live dan alamat kontrak, deploy + verifikasi kontrak, hosting
publik, serta demo live (saksi → masa sanggah → pembagian).

---

## 13. Demo & pitch

### 13.1 Naskah 3 menit

**Sebelum naik panggung:** aturan keluarga K01 sudah terpasang di dompet Pak Budi (Rp300 jt tIDR, batas 12 bulan,
masa sanggah 20 detik), gas sudah dibagikan, operator mitra jalan (layar Panggung atau Mitra terbuka di laptop), dan
`hp.html` atau `kabar.html` siap di tab kedua. Pintasan Panggung: `q` QR, `y` bayar, `h` kabar hidup, `1–3` saksi,
`b` bagikan, `m` proses mitra.

| Waktu | Yang kamu katakan | Yang kamu lakukan | Yang penonton lihat |
|---|---|---|---|
| 0:00–0:20 | "Bayangkan ayahmu menyimpan Rp300 juta dalam kripto, lalu wafat mendadak. Hartanya masih ada di blockchain, tapi tidak ada satu orang pun yang bisa mengambilnya. Agustus lalu, majalah Badan Peradilan Umum MA menyebut ini kekosongan hukum." | Layar Panggung terbuka (tanpa slide) | Kain batik di layar besar |
| 0:20–0:40 | "Pusaka memasang aturan warisan sesuai KHI langsung di dompet Pak Budi. Dan dua hal yang biasanya membuat produk seperti ini gagal di keluarga Indonesia kami hapus: **ahli waris tidak perlu dompet kripto, dan pewaris tidak perlu menekan tombol.**" | Panggung: kain dengan label per penerima | Label "BSI ••••2291", "Amplop WhatsApp" |
| 0:40–1:00 | "Silakan pindai dan pilih peran. Tidak perlu aplikasi, tidak perlu dompet." | `q` | HP penonton: bagian, alasan, dan cara terimanya |
| 1:00–1:20 | "Pak Budi tidak perlu lapor hidup. Ia bayar di warung" — `y` — "dan itu sudah bukti hidup. Kalau dompetnya diam sebelas bulan, ia dapat pengingat; satu sentuhan, cuma tanda tangan, biayanya nol rupiah." | `y`, lalu tunjukkan HP Pak Budi | Narasi "bukti hidup", pesan di HP Pak Budi |
| 1:20–1:45 | "Dua dari tiga saksi menandatangani konfirmasi wafat, juga tanpa biaya." *(Opsional: "Kalau keliru, Pak Budi cukup menyentuh 'Saya masih hidup'" lalu batalkan dan konfirmasi ulang.)* | `1`, `2` | Cap kawung, kain terendam, hitung mundur |
| 1:45–2:15 | "Masa sanggah habis. Bagikan." | `b` | Kain dicelup menurut urutan KHI; dalam ±4 detik label istri: "Masuk BSI ••••2291" |
| 2:15–2:30 | "Yang memegang amplop, buka dan cairkan ke GoPay atau bank apa pun." | (penonton) | "Dicairkan ke GoPay ••••…" di Panggung |
| 2:30–2:45 | "Kenapa Monad: final dalam 0,6 detik, satu transaksi sekitar dua rupiah, jadi relayer bisa menanggung kabar hidup dan konfirmasi saksi, dan EIP-7702 sudah aktif." | Tunjukkan transaksi di explorer | |
| 2:45–3:00 | "Berikutnya: mitra pencairan berizin, konfirmasi saksi dengan sidik jari, dan validasi ahli faraid. Terima kasih. Repo, alamat kontrak, dan URL live ada di README." | Sebut link repo, alamat kontrak, dan URL live | |

### 13.2 Tanpa slide

Panitia meminta demo 3 menit tanpa slide. Pitch dimulai langsung dari layar Panggung. Urutan bicara tetap: masalah dan data
(Dandapala 2026; 22,69 juta investor), cara kerja (diagram 7.1) dan alasan faraid dihitung on-chain, **demo live**,
lalu alasan memakai Monad dan roadmap. Di akhir, sebut link repo, alamat kontrak, dan URL live.

### 13.3 Rencana cadangan

| Masalah | Cadangan |
|---|---|
| RPC lambat, mati, atau kena batas (banyak HP di belakang satu IP Wi-Fi) | `VITE_RPC` ke RPC berkunci; laptop presenter memakai hotspot sendiri; jika tetap gagal, putar video cadangan |
| HP penonton tidak bisa membuka tautan | `hp.html` di laptop (empat HP berdampingan) |
| Transfer bank tidak bergerak | Tekan `m` di Panggung (operator mitra), atau buka `mitra.html` dan "Proses sekarang" |
| Wi-Fi venue buruk | Hotspot HP sendiri |
| Waktu pitch dipotong | Lewati demo pembatalan dan amplop |

### 13.4 Pertanyaan juri & jawaban

| Pertanyaan | Jawaban singkat |
|---|---|
| Bagaimana kontrak tahu seseorang wafat? | Kontrak tidak bisa tahu sendiri (*oracle problem*). Ada dua jalur: 2 dari 3 saksi (+ hash akta), atau tidak aktif dalam waktu lama. Keduanya diikuti masa sanggah. |
| Kalau pewaris cuma koma atau hilang? | Ada masa sanggah (saran 30 hari). Setiap bukti hidup membatalkan: transaksi apa pun, atau satu sentuhan "Saya masih hidup" di HP-nya (tanda tangan, Rp0). |
| Ahli waris tidak punya dompet kripto. Bagaimana menerimanya? | Pewaris memilih cara terima per orang. Rekening bank: alamat penerimanya rekening virtual di mitra pencairan; setelah dibagikan, mitra menukar dan mentransfer lewat BI-FAST, ahli waris tidak melakukan apa pun. Amplop: tautan WhatsApp, dicairkan ke bank atau e-wallet dari HP, gasnya disponsori. |
| Siapa yang menukar ke rupiah? Itu legal? | Di testnet disimulasikan. Di produk: mitra berizin yang sudah punya alur *redeem* stablecoin rupiah ke bank (contoh mekanisme: IDRX membakar token lalu mentransfer lewat BI-FAST, biaya Rp5.000, maks. 24 jam). Pengawasan aset kripto ada di OJK sejak Januari 2025; POJK stablecoin dijadwalkan Januari 2027. Mitra tetap memverifikasi nama rekening dan KYC. |
| Nomor rekening ahli waris disimpan di blockchain? | Tidak. Hanya nama bank, 4 digit terakhir, dan sidik (hash bergaram). Nomor lengkap hanya diketahui pewaris dan mitra. |
| Kalau Pak Budi memakai dompet biasa, bukan dompet Pusaka? | Kontrak tidak bisa melihat transaksi yang tidak lewat kodenya (kontrak tidak bisa membaca nonce akun lain, dan `eth_getProof` tidak tersedia di Monad). Karena itu ada kabar hidup bertanda tangan: cukup sekali sebelum batas, setelah pengingat. |
| Relayer bisa curang? | Tidak bisa memalsukan apa pun; ia hanya mengirim tanda tangan pewaris atau saksi. Tanda tangan kabar hidup tidak bisa diputar ulang, tanda tangan saksi terikat putaran. Jika relayer mati, pewaris dan saksi tetap bisa mengirim sendiri. |
| Bagaimana jika tautan amplop jatuh ke orang lain? | Amplop baru berisi setelah warisan dibagikan, dan siapa pun yang memegang tautan bisa mencairkannya (seperti amplop fisik). Di produk: tautan pribadi per ahli waris + verifikasi nomor WhatsApp atau passkey. Di demo semua amplop diturunkan dari satu benih agar penonton bisa memilih peran. |
| Bagaimana kalau saksi bersekongkol? | Pewaris memilih saksinya sendiri; butuh ambang 2 dari 3; masa sanggah memberi waktu untuk membatalkan; semua konfirmasi tercatat publik. |
| Apakah sah secara hukum? | Ini prototipe. Pembagian mengikuti KHI, dan penetapan ahli waris tetap bisa lewat Pengadilan Agama. Target berikutnya adalah validasi dengan ahli dan notaris. |
| Kenapa harus blockchain? | Asetnya sudah ada di blockchain. Untuk dompet pribadi, hanya kode yang bisa memindahkannya tanpa kunci pemilik. Tidak ada pihak tengah yang memegang aset. |
| Kenapa Monad, bukan chain lain? | Logikanya bisa jalan di EVM mana pun. Tapi Pusaka membuat pihak lain menanggung biaya atas nama keluarga (relayer kabar hidup dan saksi, gas amplop, penyapuan rekening virtual), jadi butuh biaya hampir nol dan finalitas cepat: di Monad satu transaksi ±Rp2,40 (60 rb gas × 102 gwei, MON ≈ Rp392) dan final dalam 0,6 detik. EIP-7702 aktif di Monad sejak Oktober 2025, dan precompile P-256 membuat kabar hidup dengan sidik jari (passkey) murah: ±77 rb gas, sedangkan tanpa precompile ±365 rb. |
| Berapa biaya setahun untuk pewaris? | Nol. Transaksi biasanya sudah menjadi bukti hidup. Jika dompetnya diam, satu kabar hidup setahun (batas gas 80 rb ≈ Rp3) dibayar relayer. Bandingkan dengan tombol tiap 8 menit: ±65.700 transaksi, ±Rp158 ribu per tahun. |
| Faraid itu rumit. Bagaimana dengan saudara atau cucu? | MVP mendukung ahli waris inti sesuai KHI Pasal 174 ayat (2): anak, ayah, ibu, janda/duda. Kasus lain ditolak dengan jelas, tidak dibagi dengan salah. |
| Pusaka dapat uang dari mana? Warisannya dipotong? | Tidak dipotong: kontrak membagi 100% sesuai faraid. Pendapatan dari biaya pencairan ke bank (flat, seperti biaya transfer, dibagi dengan mitra berizin) dan dari lisensi ke exchange atau dompet yang ingin menawarkan "warisan sesuai faraid" ke penggunanya. Fitur tambahan untuk pewaris bisa berlangganan, dibayar semasa hidup. Rincian di bagian 16.1. |
| Bagaimana jika ahli waris sepakat membagi dengan cara lain? | Perdamaian ahli waris (*islah*) ada di roadmap: semua ahli waris menandatangani pembagian yang berbeda. |

---

## 14. Aturan Blitz & checklist pengumpulan

### 14.1 Aturan yang relevan

| Sumber | Aturan |
|---|---|
| Halaman Luma Vol. 2 | Belajar, build, dan deploy app di hari yang sama. Tim maksimal 3 orang. Boleh pakai AI. Pendaftaran butuh persetujuan host. |
| Aturan Blitz (info pack Ankara, Monad Foundation) | Riset dan brainstorming dianjurkan, tetapi kode ditulis di acara. Tidak boleh proyek lama atau fork (kecuali library dan boilerplate standar). Repo GitHub publik. Deploy di Monad testnet. |
| Penilaian panitia (slide Sabtu 24 Oktober 2026 pagi; lengkapnya di [`penilaian.md`](penilaian.md)) | **Pengumpulan ditutup 16.45 WIB**; yang sudah terkumpul saat itu yang dinilai. Demo 3 menit di panggung, **tanpa slide**, fokus ke demo live dan inovasi utama. Urutan pitch mengikuti urutan submit. Tidak ada voting peserta. Total 400 poin: Basic 100, Advance (apakah jalan) 100, Advance (build in public) 100, Bonus 100. |

### 14.2 Checklist pengumpulan (batas 16.45 WIB)

**Basic (100)**
- [ ] Repo GitHub publik
- [ ] README yang layak: URL live, alamat kontrak, dan cara menjalankan
- [ ] Kontrak ter-deploy di Monad testnet
- [ ] Web di-hosting publik (kunci dompet induk untuk versi publik dibuat terpisah, saldonya kecil)

**Advance: apakah jalan (100)**
- [ ] Semua fungsi yang diumumkan berjalan
- [ ] Ada transaksi on-chain live saat demo
- [ ] Kontrak terverifikasi di explorer (source dipublikasikan)
- [ ] Orang lain bisa menjalankannya dari README tanpa bantuan

**Advance: build in public (100)**
- [ ] Posting di X atau LinkedIn dengan tag @monad, @monad_dev, @geeky_kartikey
- [ ] Video demo (minimal 30 detik, produk sedang jalan) diposting
- [ ] Video iklan kreatif diposting
- [ ] Target 5.000+ views dari semua postingan

**Saat pitch**
- [ ] Sebutkan dengan jelas link repo, alamat kontrak, URL live, dan deployment-nya (tanpa ini tetap boleh pitch, tapi tidak bisa menang)

**Bonus (100):** kontrak di Monad mainnet (25), domain custom (15), serta nilai juri untuk product-market fit, potensi revenue, dan inovasi (masing-masing sampai 20).

---

## 15. Risiko & mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Aturan faraid salah | Kredibilitas runtuh di depan juri lokal | 24 kasus uji; validasi ahli; kasus di luar cakupan ditolak; asumsi ditulis di spec |
| Kehabisan waktu (solo) | Demo tidak jalan | P0 ketat; urutan potong (bagian 12); semua alur sudah diuji ujung ke ujung dengan `e2e.mjs` |
| RPC kena batas atau mati | Layar macet saat demo | RPC fallback; polling hemat; video cadangan |
| Faucet dibatasi | Tidak bisa bertransaksi | Isi MON dompet induk di awal hari (bagian 12) dan sediakan 1–2 dompet cadangan |
| Juri menganggapnya "dead man's switch biasa" | Nilai orisinalitas rendah | Tekankan mesin faraid, saksi, masa sanggah, dan penolakan kasus |
| Juri bertanya "kenapa Monad?" | Nilai kecocokan Monad rendah | Siapkan angka biaya dan finalitas; tunjukkan explorer |
| Topik sensitif (kematian, agama) | Penonton tidak nyaman | Bahasa yang hormat; disclaimer; fokus pada manfaat untuk keluarga |
| Bug keamanan kontrak | Uang mainan hilang (testnet); citra buruk | CEI, SafeERC20, batas loop, tanpa admin |
| HP penonton gagal membuka tautan | Momen demo hilang | Uji dengan data seluler; cadangan `hp.html` di laptop |
| Juri menganggap transfer bank "palsu" | Kepercayaan turun | Sebut simulasi dengan jujur di layar dan lisan; tunjukkan bahwa kontraknya sama dengan alur *redeem* sungguhan (token dibakar, bukti transfer dicatat) |
| Banyak HP di belakang satu IP Wi-Fi kena batas RPC | Layar HP macet | Polling hemat, `VITE_RPC` berkunci, hotspot sendiri untuk laptop presenter |
| Operator mitra atau relayer mati saat demo | Rupiah tidak "masuk" | Operator jalan di setiap layar presenter dan bisa dipicu manual (`m`); pewaris dan saksi bisa mengirim sendiri tanpa relayer |

---

## 16. Roadmap setelah hackathon

| Tahap | Isi |
|---|---|
| 1 (bulan 1) | Konfirmasi saksi dengan passkey (kabar hidup pewaris sudah memakai passkey); pengingat lewat WhatsApp; kerja sama mitra pencairan berizin (redeem stablecoin rupiah ke BI-FAST) |
| 2 (bulan 2–3) | Validasi dengan ahli faraid, hakim Pengadilan Agama, dan notaris; dukungan saudara, kakek/nenek, dan ahli waris pengganti (Pasal 185); utang dan biaya jenazah; banyak jenis aset (ERC-20, NFT) |
| 3 (2027) | Mainnet dengan stablecoin rupiah setelah aturan stablecoin OJK terbit (diperkirakan Januari 2027); kerja sama dengan exchange/dompet sebagai "tombol warisan"; audit keamanan |

### 16.1 Model bisnis

**Prinsipnya: warisan tidak dipotong.** Kontrak membagi 100% harta sesuai urutan KHI (harta bersama → wasiat →
faraid). Pusaka tidak dibayar dari kematian, tetapi dari layanan yang dipakai keluarga dan dari mitra.

| Sumber | Cara kerja | Kenapa masuk akal |
|---|---|---|
| **Biaya pencairan (utama)** | Tiap transfer rupiah ke rekening ahli waris atau pencairan amplop kena biaya flat (patokan: redeem IDRX Rp5.000 per transfer). Mitra pencairan berizin menagihnya; Pusaka mendapat bagi hasil per transfer. | Dibayar untuk jasa transfer, seperti biaya antarbank. Tidak mengubah bagian faraid. Langsung terlihat di demo (`MitraCair`). |
| **Lisensi B2B** | Exchange dan dompet di Indonesia memasang Pusaka sebagai fitur "Warisan sesuai faraid". Biaya integrasi plus biaya per pengguna aktif per tahun. | Exchange tidak punya solusi warisan untuk penggunanya. Pusaka mendapat pengguna dari mereka, jadi biaya akuisisi rendah. |
| **Langganan pewaris (opsional)** | Biaya kecil per tahun untuk fitur tambahan: pengingat WhatsApp, dokumen pendukung penetapan ahli waris, lebih dari satu jenis aset. Fitur dasar tetap gratis. | Dibayar semasa hidup dengan akad ijarah (sewa jasa) yang jelas; harta warisan tidak disentuh. |
| **Kemitraan lembaga (roadmap)** | Notaris, lembaga zakat dan wakaf, bank syariah: rujukan, layanan dokumen, penyaluran wasiat dan wakaf. | Memperluas jangkauan ke keluarga yang mengurus warisan secara formal. |

**Kenapa tidak memotong persentase dari warisan.** Dalam urutan fikih, harta waris dipakai untuk biaya jenazah, lalu
utang, lalu wasiat, baru dibagi faraid. Potongan dari penyedia layanan hanya sah jika sudah disepakati pewaris semasa
hidup sebagai upah (dihitung seperti utang), dan tetap terdengar seperti "untung dari orang meninggal". Biaya
pencairan dan lisensi menghindari keduanya.

**Hitungan kasar.** Satu keluarga contoh di demo punya 4 penerima lewat bank dan 1 amplop, jadi 5 pencairan × Rp5.000 =
Rp25.000 per warisan yang dibagikan. Angka utamanya datang dari lisensi: pengguna exchange yang memasang Pusaka membayar
lewat exchange, bukan saat wafat.

---

## 17. Keputusan yang masih terbuka

| # | Keputusan | Saran |
|---|---|---|
| 1 | Nama produk | "Pusaka" (harta pusaka = harta warisan). Alternatif: Tirkah, Amanah |
| 2 | Mode radd default | Jumhur (pasangan tidak mendapat radd); konfirmasi ke ahli |
| 3 | Harta bersama masuk MVP? | Sudah masuk (P0), untuk satu pasangan |
| 4 | Token demo | tIDR mock (paling sederhana). Alternatif: USDC testnet dari Circle |
| 5 | Tim | Solo; aturan Blitz membolehkan sampai 3 orang |
| 6 | Menyebut nama mitra di pitch? | Jangan mengklaim kerja sama. Boleh menyebut IDRX sebagai contoh mekanisme *redeem* di sesi tanya jawab |
| 7 | Demo jalur "tidak aktif" | Hanya jika ditanya: pilih batas "10 menit (demo)" di Pewaris, atau `Majukan waktu` di anvil |

---

## 18. Glosarium

| Istilah | Arti |
|---|---|
| *'Ashabah* | Ahli waris penerima sisa setelah bagian pasti diambil |
| Amplop digital | Kunci sekali pakai milik satu ahli waris, dikirim lewat tautan. Setelah warisan dibagikan, isinya bisa dicairkan ke bank atau e-wallet tanpa dompet kripto |
| BI-FAST | Sistem transfer antarbank Bank Indonesia: 24 jam, maks. Rp250 jt per transaksi, biaya nasabah maks. Rp2.500 |
| Bukti hidup | Apa pun yang membuktikan pewaris masih hidup dan mengulang timer: transaksi lewat dompet Pusaka, kabar hidup bertanda tangan, atau tombol |
| EIP-712 | Format tanda tangan terstruktur. Dompet menampilkan isi yang ditandatangani (mis. "Saya masih hidup") alih-alih deretan heksa |
| Kabar hidup | Tanda tangan "Saya masih hidup" dari pewaris; relayer yang mengirimnya, jadi pewaris tidak membayar gas |
| Mitra pencairan | Pihak berizin yang menukar stablecoin rupiah menjadi rupiah dan mentransfernya ke rekening bank. Di demo: kontrak `MitraCair` + operator simulasi |
| Passkey / P-256 | Kunci di HP yang dibuka dengan sidik jari atau wajah. Monad punya precompile P-256 untuk memeriksa tanda tangannya dengan murah |
| Rekening virtual | Alamat setoran khusus untuk satu rekening bank ahli waris. Token yang masuk ke sana disapu mitra lalu dikirim sebagai rupiah |
| Relayer | Layanan yang mengirim transaksi berisi tanda tangan orang lain dan membayar gasnya |
| *'Aul* | Penyesuaian saat total bagian pasti lebih dari 1: semua bagian dikurangi proporsional |
| Alamat (*address*) | "Nomor rekening" di blockchain, mis. `0x12ab…9f3c` |
| *Ashabul furud* | Ahli waris dengan bagian pasti (1/2, 1/4, 1/8, 2/3, 1/3, 1/6) |
| Blok | Kumpulan transaksi yang dicatat bersamaan; di Monad terbentuk tiap ±0,3 detik |
| Brankas (*vault*) | Smart contract yang memegang aset pewaris |
| Dompet (*wallet*) | Aplikasi penyimpan kunci, mis. MetaMask |
| Dompet demo (*burner wallet*) | Kunci sementara di browser, khusus testnet |
| ERC-20 | Standar token di blockchain berbasis EVM |
| EVM | "Mesin" yang menjalankan smart contract; Monad kompatibel dengan EVM |
| Explorer | Situs untuk melihat transaksi publik (MonadVision) |
| Faucet | "Keran" MON gratis untuk testnet |
| Finalitas | Saat transaksi pasti tidak bisa dibatalkan (±0,6 detik di Monad) |
| Gas | Biaya transaksi, dibayar dalam MON |
| *Gharrawain* | Kasus suami/istri + ayah + ibu tanpa anak; ibu mendapat 1/3 dari sisa |
| *Hajb* | Penghalang atau pengurang bagian waris |
| Hash | Sidik jari digital sebuah data |
| Heartbeat | Sinyal "Saya masih hidup" dari pewaris |
| KHI | Kompilasi Hukum Islam, rujukan hukum waris di Pengadilan Agama |
| Mainnet / testnet | Jaringan uang asli / jaringan latihan |
| Masa sanggah | Jeda sebelum pembagian; pewaris masih bisa membatalkan |
| MON | Koin asli Monad, dipakai untuk membayar gas |
| Oracle | Sumber data dunia nyata untuk blockchain |
| Passkey | Login dengan sidik jari atau wajah, tanpa seed phrase |
| Private key | Kunci rahasia yang menguasai sebuah alamat |
| *Radd* | Pengembalian sisa harta ke *ashabul furud* jika tidak ada *'ashabah* |
| RPC | "Pintu" untuk berkomunikasi dengan blockchain |
| Seed phrase | 12/24 kata kunci induk dompet |
| *Self-custody* | Menyimpan kunci sendiri (lawan: aset dipegang exchange) |
| Smart contract | Program di blockchain yang menjalankan aturan otomatis |
| Solidity · Foundry · viem | Bahasa kontrak · alat uji/deploy · pustaka JavaScript |
| tIDR | Rupiah mainan untuk demo di testnet |
| Transaksi | Perubahan di blockchain yang ditandatangani pengirimnya |

---

## 19. Sumber

**Acara dan aturan**
- Luma, Monad Blitz Jogja Vol. 2: https://luma.com/blitz-jogja-okt-2026
- Info pack Monad Blitz Ankara (aturan Blitz): https://monad-foundation.notion.site/Monad-Blitz-Ankara-Info-Pack-2726367594f280199841cab7df002fef
- Blitz Portal API (daftar proyek semua edisi): https://blitz.devnads.com/api/showcase?limit=100&offset=0
- UGM, juara Monad Blitz Jogja Vol. 1: https://jteti.ugm.ac.id/2026/05/06/mahasiswa-dteti-dominasi-monad-blitz-hackathon-2026-melalui-ugm-blockchain-club/
- Repo PassChick (riwayat commit): https://github.com/wngstnr-code/pass-chick

**Masalah**
- Dandapala, "Kekosongan Hukum Waris atas Aset Kripto" (3 Agustus 2026): https://dandapala.com/article/detail/kekosongan-hukum-waris-atas-aset-kripto
- Bisnis.com, "Investor Kripto Tembus 22,69 Juta" (10 Agustus 2026): https://market.bisnis.com/read/20260810/94/1995826/investor-kripto-tembus-2269-juta-pemahaman-risiko-kian-genting
- Jurnal UIN Sunan Gunung Djati, aset kripto sebagai objek harta waris: https://journal.uinsgd.ac.id/index.php/kl/article/view/18147
- UPN Veteran Jatim, tinjauan yuridis pewarisan aset kripto: https://vjj.upnjatim.ac.id/index.php/vjj/article/view/320

**Pembanding**
- DeadMan (dead man's switch di Monad testnet): https://hackquest.io/projects/DeadMan
- WillVault (Monad Blitz Toronto): lihat Blitz Portal API di atas

**Monad**
- Informasi jaringan: https://docs.monad.xyz/getting-started/network-information
- Harga gas: https://docs.monad.xyz/developer-essentials/gas-pricing
- Reserve balance: https://docs.monad.xyz/developer-essentials/reserve-balance
- Blok 300 ms: https://monad.xyz/blog/300ms-block-times

**Regulasi**
- Investortrust, POJK stablecoin diperkirakan Januari 2027: https://investortrust.id/market/118744/pojk-stablecoin-terbit-januari-2027-begini-kabar-terbaru-dari-ojk-termasuk-soal-rupiah-digital
- Sumber hukum faraid: lihat [`faraid-spec.md`](faraid-spec.md) bagian 10
