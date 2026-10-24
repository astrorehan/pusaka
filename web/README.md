# Pusaka · web

Layar demo Pusaka (Vite + viem + GSAP). Tampilan dan animasinya mengikuti gaya "Nila":
harta digambar sebagai sehelai kain batik, status kontrak sebagai proses membatik. Semua status dibaca dari kontrak asli dan
setiap tombol mengirim transaksi sungguhan.

## Layar

| Berkas | Layar | Perangkat |
|---|---|---|
| `index.html` | Beranda | Laptop |
| `pewaris.html` | Pewaris: aturan, cara terima tiap ahli waris, tanda tangan pemasangan, bukti hidup, pembatalan | Laptop |
| `kabar.html` | HP pewaris: pesan bukti hidup, pengingat, peringatan saksi, "Saya masih hidup" | HP / laptop |
| `saksi.html` | Saksi: tiga kartu, tanda tangan konfirmasi wafat tanpa gas | Laptop |
| `panggung.html` | Panggung untuk proyektor | Proyektor |
| `waris.html` | Ahli waris: bagian, alasan, rekening bank / amplop / dompet kripto | HP penonton |
| `mitra.html` | Mitra pencairan (simulasi bank): rekening virtual, antrean, riwayat BI-FAST | Laptop |
| `hp.html` | Simulasi empat HP berdampingan | Laptop |
| `kalkulator.html` | Kalkulator faraid | HP / laptop |

| Kode | Isi |
|---|---|
| `src/chain.js` | Klien viem, alamat kontrak dari `.env`, kunci demo di browser, dompet induk (relayer), operator mitra, kunci amplop, sidik rekening |
| `src/demo.js` | Status dari kontrak → `window.Demo`, aksi → transaksi, operator mitra (simulasi bank) |
| `src/boot.js` | Dimuat pertama oleh setiap layar |
| `src/abi.js` | ABI hasil `npm run abi` (dari `contracts/out`) |
| `scripts/deploy-lokal.mjs` | Deploy semua kontrak ke anvil dan menulis alamatnya ke `.env.local` |
| `scripts/e2e.mjs` | Uji ujung ke ujung tanpa browser |

## Menjalankan di blockchain lokal (anvil)

```bash
anvil --network monad --block-time 1 --mixed-mining --code-size-limit 131072   # terminal 1
# --network monad: aturan gas dan precompile P-256 (sidik jari) seperti Monad
# --block-time 1 --mixed-mining: jam blockchain berjalan tiap detik, transaksi langsung ditambang
# --code-size-limit: PusakaWallet ±28 KB, di atas batas Ethereum 24 KB; Monad mengizinkan 128 KB
```

```bash
cd contracts && forge build             # terminal 2, sekali setelah kontrak berubah
cd ../web && npm install
node scripts/deploy-lokal.mjs           # menulis VITE_TOKEN, VITE_FACTORY, VITE_WALLET, VITE_MITRA ke .env.local
npm run dev
```

Buka `http://localhost:5180`. Anvil dimulai dari nol setiap kali dinyalakan, jadi jalankan `deploy-lokal.mjs` lagi
setiap kali anvil dinyalakan ulang, lalu muat ulang `npm run dev` (Vite membaca `.env` saat mulai).

HP di Wi-Fi yang sama bisa ikut: jalankan `npm run dev -- --host`, isi `VITE_PUBLIC_URL=http://<IP laptop>:5180`, lalu
pindai QR di Panggung. RPC anvil diteruskan lewat server Vite (`/rpc`), jadi HP tidak perlu akses langsung ke anvil.

## Alur demo

1. **Pewaris**: isi susunan keluarga dan cara terima tiap ahli waris (rekening bank, amplop WhatsApp, dompet kripto),
   lalu tanda tangani. Jika dompet demo belum punya gas, dompet induk mengirim MON dan Rp300 jt tIDR lebih dulu. Satu
   transaksi EIP-7702 memasang aturan sekaligus mendaftarkan rekening bank ahli waris di mitra pencairan.
2. **Panggung**: `Q` menampilkan QR. Penonton memilih peran di HP; tidak perlu aplikasi atau dompet.
3. **Bukti hidup**: `Y` (bayar Rp250 rb dari dompet pewaris) atau `H` (kabar hidup bertanda tangan, Rp0). Lihat juga
   `kabar.html` (HP Pak Budi). Di sana pewaris bisa **mengaktifkan sidik jari** sekali; setelah itu menahan "Saya masih
   hidup" meminta sidik jari atau wajah, dan kabar hidupnya ditandatangani passkey (Panggung: "sidik jari di HP-nya").
4. **Saksi**: tahan tombol di dua kartu saksi. Tanda tangannya dikirim relayer. Masa sanggah dimulai.
5. Pewaris bisa membatalkan dengan satu transaksi atau satu sentuhan "Saya masih hidup".
6. Setelah masa sanggah habis, **Bagikan** (`B`). Operator mitra langsung menyapu rekening virtual dan mencatat transfer
   BI-FAST (simulasi): ±4 detik sampai label istri menunjukkan "Masuk BSI ••••2291".
7. Pemegang amplop membuka HP-nya dan mencairkan ke bank atau e-wallet (±3 detik).

Panel demo (tombol `` ` `` atau tab kecil di pojok) berisi semua aksi. *Majukan waktu* hanya ada di anvil. *Pewaris
baru* membuat kunci pewaris baru, karena warisan yang sudah dibagikan bersifat final.

Pintasan Panggung: `Q` QR · `Y` bayar · `H` kabar hidup · `T` tombol cadangan · `1` `2` `3` saksi · `L` majukan waktu ·
`B` bagikan · `M` proses mitra · `R` pewaris baru.

## Monad testnet

Isi `.env.local` (atau variabel lingkungan di Vercel):

```text
VITE_CHAIN=monad
VITE_TOKEN=0x…        # dari forge script script/Deploy.s.sol (lihat contracts/README.md)
VITE_FACTORY=0x…
VITE_WALLET=0x…
VITE_MITRA=0x…
VITE_INDUK_KEY=0x…    # dompet induk berisi MON dari faucet; juga relayer dan pemilik MitraCair. KHUSUS TESTNET: ikut terbawa ke browser
VITE_GAS_MON=0.2      # MON untuk kunci pewaris dan operator mitra
VITE_GAS_AMPLOP=0.08  # MON yang disponsori untuk tiap amplop (cairkan ±560 rb gas; Monad menagih batas gas)
VITE_PUBLIC_URL=https://<domain>   # untuk QR di Panggung
VITE_RPC=https://…    # disarankan: RPC berkunci. RPC publik ±25 eth_call/detik per IP, dan HP penonton di satu Wi-Fi berbagi IP
```

Jalankan dengan `npm run dev -- --mode monad` (membaca `.env.monad.local`), lalu cek dulu dengan
`ENV_FILE=.env.monad.local node scripts/cek-siap.mjs`.

Aturan Monad yang tidak ada di anvil (sudah ditangani `src/chain.js` dan `kirimMON` di `src/demo.js`):

- **Reserve balance**: dompet bersaldo di bawah 10 MON hanya boleh mengirim MON jika tidak mengirim transaksi lain dalam
  3 blok terakhir. Kiriman beruntun dibatalkan di blockchain. Dompet induk karena itu mengirim MON satu per satu
  dengan jeda.
- **Saldo diperiksa dengan keadaan ±3 blok lalu**: penerima MON baru bisa bertransaksi beberapa blok kemudian.
- **Batas gas × harga maksimum harus tertutup saldo**: harga maksimum dipasang base fee + 15% + tip 2 gwei, bukan 2×
  base fee bawaan viem, supaya dompet kecil (operator, amplop) tidak ditolak.
- **Biaya = batas gas**, bukan gas terpakai. Satu putaran demo memakai ±0,7 MON dari dompet induk.
- Dompet pewaris yang sudah memakai EIP-7702 punya kode, jadi menerima MON butuh sedikit di atas 21.000 gas.

## Yang perlu diketahui

- Kunci demo (pewaris dan 3 saksi) dibuat dan disimpan di `localStorage` browser ini. Jangan pernah memakai kunci
  dompet asli.
- Dompet induk menjadi relayer: ia mengirim kabar hidup dan konfirmasi saksi yang sudah ditandatangani, jadi pewaris dan
  saksi tidak membayar gas. Operator mitra memakai kunci turunan dompet induk dan didaftarkan saat *Bagikan gas*.
- Operator mitra berjalan di layar presenter (Pewaris, Panggung, Saksi, Mitra, Simulasi HP, Beranda), satu tab sebagai
  pemimpin. HP penonton tidak menjalankannya.
- Kunci amplop diturunkan dari satu benih milik pewaris. Benih itu ikut di bagian `#` tautan QR (tidak pernah dikirim ke
  server), supaya HP penonton bisa memerankan siapa pun dan mencairkan amplop. Di produk, tiap ahli waris menerima
  kuncinya sendiri.
- Nomor rekening tidak pernah dikirim ke blockchain: hanya nama bank, 4 digit terakhir, dan sidik bergaram.
- Transfer bank disimulasikan: tIDR dibakar dan nomor referensi BI-FAST dibuat dari bukti `bytes32`.
- Panggung dan HP penonton disiapkan untuk keluarga contoh (istri, 2 putra, 1 putri, ayah, ibu, wakaf masjid 1/5).
  Susunan lain tetap dipasang dan dibagikan dengan benar oleh kontrak, tetapi hanya tampil penuh di layar Pewaris.
- Sidik jari (passkey) hanya jalan di HTTPS atau `localhost`, di perangkat yang punya Windows Hello, Touch ID, atau
  kunci layar Android. Lewat `http://<IP laptop>:5180` di HP, kartu sidik jari tidak muncul. Passkey terikat pada nama
  domain: yang dibuat di `localhost` tidak berlaku di domain Vercel, dan sebaliknya. Ia juga terikat pada pewaris, jadi
  setelah *Pewaris baru* perlu diaktifkan lagi.
- Kalkulator masih menghitung di browser dengan salinan JS aturan faraid (`assets/data.js`).
- Huruf masih dimuat dari CDN Fontshare dan Google Fonts. Jika tidak ada internet, tampilan memakai huruf cadangan.
