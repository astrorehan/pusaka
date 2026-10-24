# Arsitektur Kontrak Pusaka

> Sumber kebenaran tetap kodenya di [`contracts/src`](../contracts/src). Dokumen ini menjelaskan cara kerjanya.
> Aturan faraid ada di [`faraid-spec.md`](faraid-spec.md). Gambaran produk ada di [`PRD.md`](PRD.md).

**Ringkasnya:** ahli waris tidak perlu dompet kripto (rekening bank lewat `MitraCair`, atau amplop digital), dan
pewaris tidak perlu menekan tombol berkala (aktivitas dompet dan kabar hidup bertanda tangan menjadi bukti hidup).
Saksi juga cukup menandatangani. Lihat bagian 4, 5, dan 6.

---

## 1. Dua cara memakai Pusaka

| | **Dompet sendiri** (utama) | **Brankas** (cadangan) |
|---|---|---|
| Kontrak | `PusakaWallet`, dipasang lewat EIP-7702 | `PusakaVault`, dibuat `PusakaFactory` |
| Letak harta | Tetap di dompet pewaris | Dipindah (disetor) ke brankas |
| Cara memasang | 1 transaksi dari dompet pewaris ke alamatnya sendiri, membawa otorisasi EIP-7702 | `factory.createVault(...)`, lalu `approve` + `deposit` |
| Alamat yang dipantau layar | Alamat dompet pewaris | Alamat brankas |
| Token yang dibagikan | Sampai 5 token ERC-20 | 1 token (tIDR) |
| Sehari-hari | Pewaris memakai dompetnya seperti biasa (`execute`), dan itu menjadi bukti hidup | `deposit` / `withdraw`, juga bukti hidup |

Keduanya mewarisi `PusakaCore`, jadi aturan, fungsi saksi, bukti hidup, fungsi baca untuk layar, dan tes alurnya sama
persis. Jika EIP-7702 bermasalah di hari-H, web cukup beralih ke model brankas.

```text
FaraidLib ──┐
EstateLib ──┴─▶ PusakaCore ─┬─▶ PusakaWallet   (EIP-7702, dompet pewaris)
                            └─▶ PusakaVault    (klon, dibuat PusakaFactory)
MockIDR (tIDR, ERC-20 + permit + burn) · PusakaFactory (pembuat brankas + kalkulator)
MitraCair (mitra pencairan: rekening virtual → rupiah) ─▶ RekeningVirtual (klon EIP-1167 per rekening)
```

## 2. EIP-7702 dalam satu paragraf

Dompet biasa (EOA) bisa "memasang" kode sebuah kontrak. Kode itu lalu berjalan **di alamat dompet itu sendiri**, dengan
saldo dan penyimpanan dompet itu. Kunci tetap di tangan pemilik, dan pemilik bisa mencabut pemasangan kapan saja.
Analoginya: rekeningnya tetap sama, hanya ditambah "surat wasiat" yang dijalankan otomatis. Tandanya bisa dilihat di
explorer: kode dompet menjadi `0xef0100` + alamat `PusakaWallet`.

Pemasangan dan pengisian aturan terjadi dalam **satu transaksi**: otorisasi EIP-7702 +
`execute([daftarBanyak(rekening ahli waris) di MitraCair, setup(aturan)])`. Tidak ada celah bagi orang lain untuk
mengisi aturan lebih dulu, karena `setup()` dan `execute()` hanya bisa dipanggil oleh dompet itu sendiri
(`msg.sender == address(this)`).

## 3. Urutan pembagian (KHI)

1. **Harta bersama** (Pasal 96). `jointProperty` = bagian saldo yang merupakan harta bersama, mis. 1/1 (seluruhnya).
   Separuhnya diberikan ke pasangan yang masih hidup. Hanya berlaku jika pasangannya tepat satu orang.
2. **Wasiat** (Pasal 195). Maksimal 3 penerima yang bukan ahli waris, mis. wakaf masjid. Totalnya paling banyak 1/3 dari
   harta warisan (setelah harta bersama dipisah).
3. **Faraid**. Sisanya dibagi dengan `FaraidLib`.

Jumlah dibulatkan ke bawah, dan sisa pembulatan (beberapa wei) diberikan ke ahli waris pertama. Total yang dikirim
selalu sama dengan saldo. Utang dan biaya jenazah belum didukung.

**Contoh demo.** Harta Rp300 jt, seluruhnya harta bersama, wakaf masjid 1/5, keluarga K01:

| Langkah | Hitungan | Hasil |
|---|---|---|
| Harta bersama | 300 × 1/1 × 1/2 | Istri Rp150 jt |
| Harta warisan | 300 − 150 | Rp150 jt |
| Wakaf masjid | 150 × 1/5 | Masjid Rp30 jt |
| Dibagi faraid | 150 − 30 | Rp120 jt → istri 15 · anak lk 26 ×2 · anak pr 13 · ayah 20 · ibu 20 |

Istri menerima total Rp165 jt (150 + 15).

## 4. Bukti hidup

Timer tidak aktif (`inactivityPeriod`, bawaan web 12 bulan) diulang oleh **bukti hidup** apa pun. Bukti hidup juga
menghapus konfirmasi saksi yang sudah masuk (putaran baru) dan, selama masa sanggah, membatalkan pemicu.

| Sumber | Fungsi | `lastProofVia` | Siapa membayar gas | Catatan |
|---|---|---|---|---|
| **Aktivitas dompet** | `execute(calls)` (dompet), `deposit`/`withdraw` (brankas) | 3 | Pewaris, sebagai bagian dari transaksi yang memang ia lakukan | Tidak pernah menggagalkan transaksinya. Setelah masa sanggah habis atau setelah dibagikan, tidak mengubah apa pun |
| **Kabar hidup bertanda tangan** | `checkIn(waktu, ttd)` | 2 | Relayer (siapa pun boleh mengirim) | Pewaris hanya menandatangani EIP-712 `KabarHidup(string pesan, uint64 waktu)` dengan `pesan = "Saya masih hidup"`. Rp0 untuk pewaris |
| **Sidik jari (passkey)** | `checkInPasskey(waktu, auth)` | 4 | Relayer | Pesan EIP-712 yang sama ditandatangani passkey WebAuthn (P-256) di HP/laptop: sidik jari atau wajah, tanpa kunci dompet. Kunci publik didaftarkan sekali dengan `aturPasskey(x, y)` |
| **Tombol** | `heartbeat()` | 1 | Pewaris | Cadangan |

Aturan `checkIn`:
- Domain EIP-712: `{ name: "Pusaka", version: "1", chainId, verifyingContract: alamat dompet/brankas }`. Domain dihitung
  tanpa slot penyimpanan tambahan (aman untuk ERC-7201 di dompet EIP-7702). `eip712Domain()` (ERC-5267) tersedia.
- Tanda tangan diperiksa dengan ECDSA, lalu ERC-1271 jika pemiliknya kontrak.
- `waktu` harus **lebih baru dari bukti hidup terakhir** (tanda tangan yang sama tidak bisa dipakai dua kali), paling
  jauh `MAX_CLOCK_SKEW` = 10 menit di depan jam blok (jam blok beresolusi 1 detik, blok Monad ±0,4 detik), dan jika
  pemicu sudah berjalan, tidak lebih lama dari `triggeredAt` (kabar lama tidak bisa membatalkan konfirmasi saksi).
- `lastHeartbeat` tidak pernah mundur; nilai yang disimpan = maks(lama, `waktu`).

Aturan `checkInPasskey` (`WebAuthnLib`): aturan `waktu` sama dengan `checkIn`. `challenge` WebAuthn harus digest EIP-712
`KabarHidup` (base64url tanpa padding), `type` = `webauthn.get`, flag User Present dan User Verified wajib, tanda tangan
atas `sha256(authenticatorData || sha256(clientDataJSON))` diperiksa dengan OpenZeppelin `P256.verify`: precompile
P-256 (EIP-7951, alamat `0x…0100`) di Monad, perhitungan Solidity di jaringan tanpa precompile. Tanda tangan dengan s
tinggi ditolak (web menormalkannya). Origin dan `rpIdHash` tidak diperiksa: kunci publiknya hanya bisa didaftarkan
pemilik dompet dan sudah terikat pada satu situs. Kunci passkey dihapus saat `cancelSetup()`.

Catatan jujur: transaksi yang dikirim langsung dari EOA ke kontrak lain (mis. transfer token dari aplikasi dompet yang
tidak memakai `execute`) tidak terlihat oleh `PusakaWallet`. Untuk pewaris seperti itu, bukti hidupnya adalah kabar hidup
bertanda tangan, yang cukup dilakukan sekali sebelum batas (mis. setahun sekali) setelah pengingat.

## 5. Saksi

`attestDeath(bukti)` (saksi mengirim sendiri) atau `attestDeathFor(saksi, bukti, ttd)` (siapa pun mengirim tanda tangan
saksi). Tanda tangan EIP-712 `KonfirmasiWafat(address saksi, bytes32 bukti, uint256 putaran)` terikat pada putaran saat
ini (`Summary.round`), jadi setelah bukti hidup, tanda tangan lama tidak berlaku lagi. Saat jumlah konfirmasi mencapai
ambang, status menjadi DIPICU.

## 6. Mitra pencairan (`MitraCair`)

Ahli waris menerima rupiah di rekening bank tanpa dompet kripto. Di produk, mitra adalah penukar stablecoin rupiah
berizin yang mentransfer lewat BI-FAST. Di testnet, operator mitra (laptop presenter) mensimulasikan transfer dan
**membakar** tIDR sebagai tanda sudah ditukar.

**Rekening virtual.** Tiap rekening bank ahli waris didaftarkan pewaris saat pemasangan dan mendapat alamat setoran
sendiri, yaitu klon EIP-1167 `RekeningVirtual` yang dibuat dengan CREATE2. Alamatnya bisa dihitung sebelum klonnya ada,
jadi `setup()` memakai alamat itu sebagai alamat ahli waris.

```text
id     = keccak256(abi.encode(pendaftar, sidik))
sidik  = keccak256(abi.encode("pusaka-rekening-v1", bank, nomor (angka saja), nama, garam))
garam  = keccak256("pusaka-garam:" + alamat pendaftar dalam huruf kecil)
alamat = CREATE2(MitraCair, salt = id, init code EIP-1167 dengan rekeningImpl)
```

Di blockchain hanya tercatat **nama bank, 4 digit terakhir, dan sidik**. Nomor rekening lengkap dan nama pemilik tidak
pernah dikirim.

**Alur.**

```text
pemasangan:  dompet pewaris ─execute─▶ MitraCair.daftarBanyak(sidik[], bank[], akhiran[], cadangan[])
pembagian:   finalize() ─▶ tIDR masuk alamat rekening virtual
operator:    sapuBanyak(ids) ─▶ klon dibuat bila perlu, saldo ditarik ke MitraCair, Pencairan "Diproses" dicatat
             selesaikan(nos, bukti) ─▶ "Selesai" + bukti transfer (bytes32), tIDR dibakar
amplop:      kunci amplop ahli waris ─▶ cairkan(sidik, bank, akhiran, jumlah, deadline, v, r, s)
             (izin EIP-2612 + daftar rekening + tarik token dalam satu transaksi; gas disponsori)
gagal:       kembalikan(no) ─▶ tIDR dikembalikan ke `cadangan` (kunci amplop ahli waris) atau ke pengirim
```

| Fungsi | Siapa | Catatan |
|---|---|---|
| `daftar(sidik, bank, akhiran, cadangan)` / `daftarBanyak(...)` | Siapa pun (biasanya dompet pewaris lewat `execute`) | Idempoten. Bank 1–24 byte, akhiran ≤ 8 |
| `alamatVA(id)`, `alamatVAUntuk(pendaftar, sidik[])`, `idRekening(pendaftar, sidik)` | Baca | Untuk web dan `setup()` |
| `sapu(id)` / `sapuBanyak(ids)` | Siapa pun | Maks. 20 per panggilan; rekening kosong dilewati |
| `cairkan(...)` | Pemegang token (amplop, dompet kripto) | Mendaftarkan rekening tujuan dengan `cadangan = pengirim` |
| `setor(id, jumlah)` | Pemegang token | Tanpa izin EIP-2612 (pakai `approve`) |
| `selesaikan(nos[], bukti[])` | Operator | Membakar jumlah yang selesai |
| `kembalikan(no)` | Operator | Menolak jika tujuannya rekening virtual (`TanpaCadangan`) |
| `aturOperator(op, aktif)` | Pemilik | Pemilik juga operator |
| `statusPenerima(a)` / `statusBanyak(a[])` | Baca | Untuk layar: rekening, bank, akhiran, saldo, pencairan terakhir dan tujuannya |
| `antrean()`, `vaBerisi(dari, sampai)`, `getRekening`, `getPencairan`, `jumlahRekening`, `jumlahPencairan` | Baca | Untuk operator dan layar Mitra |

Event: `OperatorDiatur`, `RekeningDidaftarkan`, `PencairanDiminta`, `PencairanSelesai`, `PencairanDikembalikan`.
Error: `BukanPemilik`, `BukanOperator`, `DataTidakValid`, `RekeningTidakAda(id)`, `JumlahNol`, `SudahTuntas(no)`,
`TanpaCadangan(no)`.

**Kepercayaan.** Operator mitra dipercaya untuk benar-benar mentransfer rupiah (sama seperti bank atau penukar
stablecoin hari ini). Kontrak menjamin uangnya hanya bisa pergi ke rekening yang didaftarkan pewaris (atau kembali ke
cadangan), dan setiap langkah tercatat publik. Aturan warisan sendiri tidak bergantung pada mitra: penerima kripto dan
amplop tetap bisa memakai tokennya tanpa mitra.

## 7. Siklus status

```text
TIDAK ADA ──setup()/createVault()──▶ AKTIF ──2 dari 3 saksi / tidak aktif──▶ DIPICU ──masa sanggah habis, finalize()──▶ DIBAGIKAN
 (None, 0)                           (1)  ◀── bukti hidup apa pun sebelum masa sanggah habis ──  (2)                       (3)
```

Bukti hidup = `execute` / `deposit` / `withdraw` (aktivitas), `checkIn` (kabar hidup), `checkInPasskey` (sidik jari),
atau `heartbeat()`.
`cancelSetup()` (khusus dompet) mengembalikan status ke TIDAK ADA agar aturan bisa dipasang ulang.

## 8. Fungsi

| Fungsi | Siapa | Kapan | Catatan |
|---|---|---|---|
| `setup(tokens, heirs, witnesses, bequests, cfg)` | Dompet pewaris sendiri | TIDAK ADA | Khusus `PusakaWallet`; kirim bersama otorisasi EIP-7702, biasanya di dalam `execute` |
| `execute(calls)` | Dompet pewaris sendiri | Kapan pun | Khusus `PusakaWallet`. Banyak panggilan sekaligus; bukti hidup saat AKTIF / masa sanggah. `CallFailed(i, alasan)` jika satu gagal |
| `cancelSetup()` | Pewaris | AKTIF | Khusus `PusakaWallet` |
| `factory.createVault(heirs, witnesses, bequests, cfg)` | Siapa pun (menjadi pewaris) | — | Membuat klon `PusakaVault` |
| `deposit(amount)` / `withdraw(amount)` | Siapa pun / pewaris | AKTIF | Khusus `PusakaVault`; setoran pewaris dan penarikan adalah bukti hidup |
| `heartbeat()` | Pewaris | AKTIF, atau DIPICU sebelum masa sanggah habis | Cadangan |
| `checkIn(waktu, ttd)` | Siapa pun (relayer) | Sama dengan `heartbeat()` | Lihat bagian 4 |
| `aturPasskey(x, y)` | Pewaris | Kapan pun | Khusus dompet/brankas yang sudah dipasang; `(0, 0)` menghapus. `passkey()` membaca kunci publiknya |
| `checkInPasskey(waktu, auth)` | Siapa pun (relayer) | Sama dengan `heartbeat()` | Lihat bagian 4 |
| `attestDeath(bukti)` | Saksi | AKTIF | Sekali per saksi per putaran |
| `attestDeathFor(saksi, bukti, ttd)` | Siapa pun (relayer) | AKTIF | Lihat bagian 5 |
| `triggerByInactivity()` | Siapa pun | AKTIF, setelah batas tidak aktif | |
| `finalize()` | Siapa pun | DIPICU, setelah masa sanggah habis | Membagikan semua token |

**Fungsi baca (untuk layar):** `getSummary()`, `preview()`, `getHeirs()`, `getWitnesses()` (beserta status konfirmasi),
`getBequests()`, `getTokens()`, `getConfig()`, `getFamily()`, `owner()`, `status()`, `isWitness(alamat)`,
`eip712Domain()`. **Factory:** `previewFaraid(f, radd)`, `previewEstate(saldo, f, radd, joint, wasiat)`,
`vaultsOf(pewaris)`.

## 9. Struktur data (untuk web)

| Tipe | Isi |
|---|---|
| `Relation` | 0 suami · 1 istri · 2 anak lk · 3 anak pr · 4 ayah · 5 ibu |
| `Status` | 0 tidak ada · 1 aktif · 2 dipicu · 3 dibagikan |
| `Heir` | `{wallet, relation}`; `wallet` boleh alamat rekening virtual, kunci amplop, atau dompet kripto |
| `Bequest` | `{to, share: {num, den}}`; `share` dihitung dari harta warisan |
| `Config` | `{deceasedMale, siblings, otherRelatives, raddToSpouse, inactivityPeriod, challengePeriod, witnessThreshold, jointProperty: {num, den}}` |
| `Summary` | `kind` (1 brankas, 2 dompet), pemilik, token utama, status, alasan pemicu, saldo, waktu blok, waktu-waktu penting, jumlah konfirmasi, jumlah saksi/ahli waris, `config`, `lastProofVia` (0 pemasangan · 1 tombol · 2 kabar hidup · 3 aktivitas · 4 sidik jari), `round` |
| `Preview` | saldo, harta bersama, harta yang dibagi faraid, flag faraid, per ahli waris `{wallet, relation, num, den, faraidAmount, jointAmount}`, per wasiat `{to, num, den, amount}` |
| `MitraCair.StatusPenerima` | `{rekening, bank, akhiran, saldo, adaPencairan, no, pencairan, bankTujuan, akhiranTujuan}` |
| `MitraCair.Pencairan` | `{rekening, dari, diminta, jumlah, selesai, tahap (0 tidak · 1 diproses · 2 selesai · 3 dikembalikan), bukti}` |

Flag faraid: 1 *'aul* · 2 *radd* · 4 *radd* ke pasangan · 8 *gharrawain* · 16 ayah menerima sisa.

## 10. Error

| Error | Kode |
|---|---|
| `InvalidConfig` | 1 ahli waris 0 atau > 20 · 2 saksi 0 atau > 5 · 3 ambang saksi tidak valid · 4 alamat nol · 5 alamat ganda (pewaris, ahli waris, saksi, dan penerima wasiat harus berbeda semua) · 6 ayah/ibu lebih dari satu · 7 batas waktu 0 · 8 jumlah token 0, > 5, atau ganda |
| `InvalidEstate` | 1 pecahan harta bersama tidak valid · 2 harta bersama tanpa tepat satu pasangan · 3 wasiat > 3 atau bagian 0 · 4 wasiat > 1/3 |
| `InvalidFamily`, `UnsupportedCase` | Lihat `faraid-spec.md` bagian 2 |
| Bukti hidup dan saksi | `BadSignature`, `StaleCheckIn` (kabar hidup tidak lebih baru dari bukti terakhir, atau lebih lama dari pemicu), `CheckInFromFuture` (> 10 menit di depan jam blok) |
| Lainnya | `NotOwner`, `NotWitness`, `AlreadyAttested`, `WrongStatus(status)`, `TooEarly(siapPada)`, `ChallengeOver`, `NotSelf` (setup/execute bukan dari dompet sendiri), `CallFailed(i, alasan)` |
| `MitraCair` | Lihat bagian 6 |

## 11. Keamanan

- Tanpa admin dan tanpa upgrade di `PusakaCore`. Tidak ada pihak yang bisa mengubah aturan selain pewaris semasa AKTIF.
- `setup()` dan `execute()` hanya dari dompet itu sendiri; pemasangan dalam transaksi yang sama dengan otorisasi
  EIP-7702.
- Relayer tidak bisa memalsukan apa pun: ia hanya mengirim tanda tangan pewaris atau saksi. Jika relayer berhenti,
  pewaris tetap bisa `heartbeat()` atau bertransaksi, dan saksi tetap bisa `attestDeath()` sendiri.
- Tanda tangan kabar hidup tidak bisa diputar ulang (`waktu` harus naik), tidak bisa dibuat untuk masa depan jauh, dan
  tidak bisa membatalkan pemicu yang terjadi setelah tanda tangan itu dibuat. Tanda tangan saksi terikat putaran.
- Data disimpan di slot bernama (ERC-7201) agar tidak bertabrakan dengan kontrak lain yang pernah dipasang di dompet.
- Cetakan `PusakaVault` dikunci; klonnya dibuat dan diisi dalam satu transaksi oleh factory.
- *Checks-effects-interactions*: status DIBAGIKAN ditulis sebelum token dikirim.
- Transfer yang gagal dicatat (`TransferFailed`) dan tidak membatalkan transfer lain. Satu token rusak tidak bisa
  mengunci warisan.
- Saksi tidak boleh sekaligus penerima, agar tidak tergoda mengonfirmasi palsu.
- `RekeningVirtual` hanya bisa disapu oleh `MitraCair` (immutable `mitra`), dan `MitraCair` hanya mengeluarkan token
  dengan cara membakarnya (selesai) atau mengembalikannya ke cadangan/pengirim.
- Dompet tetap berfungsi normal: bisa menerima MON (`receive`), NFT (ERC-721/1155), dan tanda tangannya tetap sah
  untuk aplikasi yang memeriksa lewat kontrak (ERC-1271).

## 12. Gas

Diukur dengan `anvil --network monad` (Foundry 1.8.5: harga opcode Monad, termasuk akses penyimpanan dingin per
halaman) lewat `GAS_LOG=1 node scripts/e2e.mjs`. Batas gas di web (`GAS` di `web/src/demo.js`) diberi ruang ≥ 25%.

| Transaksi | Gas (mode Monad) | Batas gas di web |
|---|---|---|
| Pasang: otorisasi + `daftarBanyak` 4 rekening + `setup` (K01, 3 saksi) | 1.257.711 (tanpa rekening 669.878; ±147 rb per rekening) | 1.000.000 + 160.000 per rekening |
| `checkIn` (relayer) | 45.317 · membatalkan pemicu 47.003 | 80.000 |
| `aturPasskey` · `checkInPasskey` (relayer, precompile P-256) | 68.948 · 76.601–93.613 | 150.000 · 200.000 (anvil tanpa `--network monad`: ±365 rb, batas 450.000) |
| `attestDeathFor` (relayer) | 82.504 · yang memicu masa sanggah 102.555 | 150.000 |
| `attestDeath` (saksi sendiri) | 71.935 · yang memicu 91.986 | 140.000 |
| `heartbeat` | 52.184 · membatalkan 36.723 | 90.000 |
| `execute` 1 transfer token (aktivitas) | 73.928–108.391 · membatalkan 93.056 | 180.000 |
| `triggerByInactivity` | 52.852 | 120.000 |
| `finalize` (6 ahli waris + 1 wasiat, 1 token) | 395.101 | 600.000 |
| `sapuBanyak` 4 rekening (termasuk membuat klon) | 751.982 (±170 rb per rekening) | 220.000 per rekening + 80.000 |
| `selesaikan` | 4 pencairan 191.856 · 1 pencairan 109.489 | 70.000 per pencairan + 90.000 |
| `cairkan` amplop (izin + daftar + tarik) | 391.074 | 560.000 |
| `cancelSetup` | 137.831 | 300.000 |
| `aturOperator` · `faucet` | 51.678 · 46.285–80.297 | 80.000 · 120.000 |

Di Monad, biaya dihitung dari **batas** gas, bukan gas terpakai, jadi batasnya sengaja dekat dengan pemakaian. Dengan
base fee 100 gwei (`eth_gasPrice` 102 gwei) dan MON ≈ Rp392 (Oktober 2026), 10.000 gas ≈ Rp0,40: kabar hidup
(batas 80.000) ≈ Rp3, pemasangan dengan 4 rekening (batas 1,64 jt) ≈ Rp66, pembagian ≈ Rp24. Cek angka terbaru dengan
`node scripts/cek-siap.mjs`.

## 13. Batasan yang diketahui

- Hanya token ERC-20 yang dibagikan, bukan MON. Di Monad, transaksi yang menurunkan saldo MON akun EIP-7702 di bawah
  10 MON gagal (*reserve balance*), kecuali penurunannya hanya untuk biaya gas. Pusaka tidak memindahkan MON dari
  dompet pewaris; pembagian MON nanti harus menyisakan 10 MON.
- Token yang masuk setelah DIBAGIKAN tertinggal di alamat itu.
- `PusakaWallet` ±28 KB dan `PusakaVault` ±26 KB (sejak `WebAuthnLib` + cadangan P-256 Solidity), di atas batas EIP-170
  24 KB. Monad mengizinkan kode kontrak sampai 128 KB, jadi deploy ke Monad dan anvil memakai `--code-size-limit 131072`.
  Di jaringan dengan batas Ethereum, kontrak perlu dirampingkan (mis. memisahkan `WebAuthnLib` menjadi library eksternal).
- Di dunia nyata, model dompet butuh dukungan aplikasi dompet untuk memasang delegasi ke `PusakaWallet` dan mengirim
  transaksi lewat `execute` (agar aktivitas terhitung). Demo memakai dompet demo di browser.
- Transfer bank di testnet disimulasikan; nomor referensi BI-FAST dibuat dari bukti `bytes32`.
- Kunci amplop di demo diturunkan dari satu benih pewaris yang ikut di bagian `#` tautan QR, supaya HP penonton bisa
  memerankan siapa pun. Di produk, tiap ahli waris menerima kuncinya sendiri lewat tautan pribadi.
- Kontrak lain yang mengirim MON dengan `transfer()` (jatah gas 2.300) bisa gagal mengirim ke dompet EIP-7702.
- Jika pewaris mencabut delegasi semasa hidup, aturan berhenti berlaku. Ini disengaja: hartanya tetap milik pewaris.
- Utang dan biaya jenazah belum didukung. Harta bersama dengan lebih dari satu istri ditolak.
- Keluarga di luar ahli waris inti ditolak (lihat `faraid-spec.md` bagian 2), termasuk kasus anak perempuan bersama
  saudara, karena Yurisprudensi MA 86 K/AG/1994 dan jumhur ulama berbeda pendapat.

## 14. Cara menguji

```bash
cd contracts
forge test                         # faraid, urutan KHI, alur brankas, alur dompet EIP-7702, bukti hidup, MitraCair
anvil --network monad --block-time 1 --mixed-mining --code-size-limit 131072   # terminal lain
cd ../web && node scripts/e2e.mjs  # alur lengkap dengan transaksi sungguhan (RPC=http://127.0.0.1:8545)
GAS_LOG=1 node scripts/e2e.mjs     # ditambah ringkasan gas per fungsi
```
