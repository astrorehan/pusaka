# Relayer Pusaka

Dompet induk dan operator mitra hanya ada di server. Browser tidak pernah memegang kunci itu: halaman cukup memanggil
`/api/induk`. Pewaris, saksi dan ahli waris tetap menandatangani sendiri di perangkatnya (kunci demo di browser);
relayer hanya mengirim transaksi yang sudah ditandatangani dan membayar gasnya.

## Kode

| Berkas | Isi |
|---|---|
| `relayer/inti.js` | Logika server, tanpa framework: klien viem, dompet induk + operator dari `INDUK_KEY`, semua aksi di bawah |
| `relayer/serial.js` | `ke(obj)` / `dari(teks)`: JSON yang membawa `bigint` sebagai `{"$b":"123"}`. Dipakai browser dan server |
| `relayer/http.js` | Pembungkus HTTP untuk Node, `layani(req, res)`: dipakai fungsi Vercel dan middleware dev server Vite |
| `api/induk.js` | Fungsi Vercel di akar repo (bukan `web/api/`): `export { layani as default } from '../relayer/http.js'` |
| `web-next/app/api/induk/route.js` | Route Next.js: membungkus `inti.js` yang sama |

`inti.js` mengekspor `async function tangani(permintaan)`, `async function info()`, dan `atur(env)` (opsional: objek env sendiri, bawaannya `process.env`). Ketiganya tidak pernah melempar galat. Modul ini butuh `viem`, jadi harus bisa ditemukan dari folder `relayer/` (di akar repo: `npm install`). Pembungkus HTTP cuma
`dari(body)` → `tangani()` → `ke(hasil)`, status 200 untuk `{ ok: true }`, 400 untuk `{ ok: false, pesan, kode }`. `kode` menamai galat (nama revert kontrak seperti `WrongStatus`, atau `BukanPewaris`, `FungsiDitolak`, `AmplopKosong`, `Dibatasi`, `SaldoRelayer`, `Konfigurasi`, `Permintaan`, `Galat`); browser memakainya untuk memilih pesan.

## Variabel lingkungan server (bukan `VITE_` / `NEXT_PUBLIC_`)

`INDUK_KEY`, `RPC_URL`, `TOKEN`, `WALLET`, `MITRA`, `GAS_MON` (0.2), `GAS_AMPLOP` (0.08), `CHAIN_ID` (10143 atau 31337).

## Permintaan

`GET /api/induk` → `{ ok, induk, operator, saldoInduk }` (alamat, dan saldo MON induk sebagai `bigint`; tanpa kunci).

`POST /api/induk`, body JSON lewat `serial.ke`:

| `aksi` | Isi | Yang dilakukan server |
|---|---|---|
| `gas` | `{ pewaris, amplop: [alamat], tidr: bool, hanyaPewaris: bool }` | Sama dengan `isiDompetDemo()` lama: MON ke pewaris (sampai `GAS_MON`), operator (1,5×), tiap amplop (`GAS_AMPLOP`); faucet tIDR pewaris sampai Rp300 jt; daftarkan operator di MitraCair bila perlu. Maks 6 amplop. |
| `relay` | `{ pewaris, fungsi, args, gas }` | `fungsi` hanya salah satu dari `attestDeathFor`, `checkIn`, `checkInPasskey`, `triggerByInactivity`, `finalize`. `to` selalu `pewaris`, dan `pewaris` wajib punya kode delegasi EIP-7702 ke `WALLET` (`0xef0100` + alamat). Simulasi dulu, lalu kirim. |
| `faucet` | `{ pewaris }` | Isi tIDR dompet pewaris sampai Rp300 jt (setelah demo bayar). `pewaris` wajib ber-EIP-7702. Hasil `{ ok, tx: [hash...] }`; `tx` kosong bila sudah cukup. |
| `amplop` | `{ alamat }` | Isi gas satu amplop sampai `GAS_AMPLOP` (sebelum cairkan). Hanya amplop yang berisi tIDR (`AmplopKosong` bila tidak). Hasil `{ ok, tx: [hash...] }`. |
| `mitra` | `{}` | Satu putaran operator mitra (`detakOperator` lama: `sapuBanyak` lalu penyelesaian transfer ±1,4 detik setelah terlihat). Hasil `{ ok, tx: [hash...], hasil: [{tx, blok, detik, gas}], catatan: [{jenis: 'sapu' atau 'selesai', teks, tx}], menunggu }`. `menunggu` > 0: ada transfer yang belum waktunya, panggil lagi ±1 detik kemudian. `siap: false` bila operator belum terdaftar; `sibuk: true` bila putaran lain sedang berjalan. |

Hasil transaksi: `{ ok: true, tx, blok, detik, gas }` (bentuk yang sama dengan `kirim()` lama, supaya struk tetap jalan).
Untuk `gas`: `{ ok: true, tx: [hash...] }` (`tx` kosong bila semua sudah terisi).

Batas gas dari `relay` hanya dipakai bila tidak lebih dari 2× angka tabel `GAS` di server; selain itu angka tabel yang dipakai. `args` dengan `bigint` memakai `serial.ke` (struct passkey `auth` juga lewat sini).

## Aturan Monad yang tetap berlaku di server

- Reserve balance: kiriman MON dari induk diberi jeda 4 blok dan dicoba ulang (lihat `kirimMON`).
- Biaya = batas gas: selalu pakai batas gas eksplisit dari tabel `GAS`.
- maxFee: `dompet()` di `chain.js` (base + 15 % + 2 gwei).
- Nonce: satu antrean per kunci di dalam proses; bila bentrok dengan instance lain, coba ulang dengan nonce baru.

## Anvil

Di anvil (`CHAIN_ID` 31337) server memakai akun anvil nomor 0 bila `INDUK_KEY` kosong. Web Vite lokal menjalankan
relayer lewat middleware dev server, jadi `npm run dev` tetap satu perintah.
